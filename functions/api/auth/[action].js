// Accounts without email: a passkey (Face ID, Touch ID, Windows Hello, or a phone
// scanned from a QR code) plus a backup code shown once at signup.
//   POST /api/auth/register-options   start adding a passkey (new account or signed in)
//   POST /api/auth/register           finish it
//   POST /api/auth/login-options      start a passkey sign-in
//   POST /api/auth/login              finish it
//   POST /api/auth/code-signup        account with only a backup code (no passkey support)
//   POST /api/auth/recover            sign in with the backup code
//   POST /api/auth/logout
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { json, sign, verify, cookie, setCookie, liveUser, sha256, randomId, b64u } from "../../../lib/core.js";

const YEAR = 60 * 60 * 24 * 365;
const CODE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let s = "";
  for (let i = 0; i < 16; i++) s += CODE_ALPHA[b[i] % CODE_ALPHA.length];
  return s.match(/.{4}/g).join("-");
}
const cleanCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").match(/.{1,4}/g)?.join("-") || "";

const fromB64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

async function session(uid, env, extra = {}, headers = []) {
  headers.push(["set-cookie", setCookie("nl_s", await sign(env, { uid }, YEAR), YEAR)]);
  headers.push(["set-cookie", "nl_c=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax"]);
  return new Response(JSON.stringify({ ok: true, ...extra }), {
    headers: [["content-type", "application/json"], ...headers],
  });
}

async function createUser(env, data) {
  const uid = randomId(12), code = newCode();
  await env.DB.prepare("INSERT INTO users (id, created, data, recovery_hash) VALUES (?, ?, ?, ?)")
    .bind(uid, Date.now(), JSON.stringify(data || {}).slice(0, 200000), await sha256(cleanCode(code))).run();
  return { uid, code };
}

export async function onRequestPost(ctx) {
  const { request, env, params } = ctx;
  const url = new URL(request.url);
  const rpID = url.hostname, origin = url.origin;
  const body = await request.json().catch(() => ({}));
  const me = await liveUser(env, request);

  switch (params.action) {
    case "register-options": {
      const uid = me || randomId(12);
      const existing = me
        ? (await env.DB.prepare("SELECT id, transports FROM creds WHERE uid = ?").bind(me).all()).results
        : [];
      const opts = await generateRegistrationOptions({
        rpName: "Nomad Library", rpID,
        // The date tells passkeys apart if a device ever lists more than one.
        userName: `Nomad Library (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})`,
        userDisplayName: "Nomad Library member",
        userID: new TextEncoder().encode(uid),
        attestationType: "none",
        excludeCredentials: existing.map(c => ({ id: c.id, transports: JSON.parse(c.transports || "[]") })),
        authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
      });
      const c = await sign(env, { ch: opts.challenge, uid, fresh: !me }, 600);
      return json(opts, { headers: { "set-cookie": setCookie("nl_c", c, 600) } });
    }

    case "register": {
      const st = await verify(env, cookie(request, "nl_c"));
      if (!st) return json({ error: "That took too long. Try again." }, { status: 400 });
      let v;
      try {
        v = await verifyRegistrationResponse({
          response: body.response, expectedChallenge: st.ch, expectedOrigin: origin, expectedRPID: rpID,
          requireUserVerification: false,
        });
      } catch (e) { return json({ error: "That passkey didn't verify. Try again." }, { status: 400 }); }
      if (!v.verified) return json({ error: "That passkey didn't verify. Try again." }, { status: 400 });
      const cred = v.registrationInfo.credential;
      let uid = st.uid, code = null;
      if (st.fresh) {
        if (me) uid = me;
        else ({ uid, code } = await createUser(env, body.data));
      }
      await env.DB.prepare("INSERT INTO creds (id, uid, pk, counter, transports, created, label) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(cred.id, uid, b64u(cred.publicKey), cred.counter || 0, JSON.stringify(cred.transports || []), Date.now(),
          String(body.label || "").slice(0, 60)).run();
      return session(uid, env, { code });
    }

    case "login-options": {
      const opts = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
      const c = await sign(env, { ch: opts.challenge }, 600);
      return json(opts, { headers: { "set-cookie": setCookie("nl_c", c, 600) } });
    }

    case "login": {
      const st = await verify(env, cookie(request, "nl_c"));
      if (!st) return json({ error: "That took too long. Try again." }, { status: 400 });
      const id = body.response?.id;
      const row = id && await env.DB.prepare("SELECT * FROM creds WHERE id = ?").bind(id).first();
      if (!row) return json({ error: "That passkey's account no longer exists. Create a new free account, or sign in with your backup code.", unknown: id, rpID }, { status: 400 });
      let v;
      try {
        v = await verifyAuthenticationResponse({
          response: body.response, expectedChallenge: st.ch, expectedOrigin: origin, expectedRPID: rpID,
          credential: { id: row.id, publicKey: fromB64u(row.pk), counter: row.counter, transports: JSON.parse(row.transports || "[]") },
          requireUserVerification: false,
        });
      } catch (e) { return json({ error: "That passkey didn't verify. Try again." }, { status: 400 }); }
      if (!v.verified) return json({ error: "That passkey didn't verify. Try again." }, { status: 400 });
      await env.DB.prepare("UPDATE creds SET counter = ?, used = ? WHERE id = ?")
        .bind(v.authenticationInfo.newCounter, Date.now(), row.id).run();
      return session(row.uid, env);
    }

    case "code-signup": {
      if (me) return json({ error: "You're already signed in." }, { status: 400 });
      const { uid, code } = await createUser(env, body.data);
      return session(uid, env, { code });
    }

    case "recover": {
      const h = await sha256(cleanCode(body.code));
      const u = await env.DB.prepare("SELECT id FROM users WHERE recovery_hash = ?").bind(h).first();
      if (!u) return json({ error: "That code doesn't match an account." }, { status: 400 });
      return session(u.id, env);
    }

    case "new-code": {
      if (!me) return json({ error: "Sign in first." }, { status: 401 });
      const code = newCode();
      await env.DB.prepare("UPDATE users SET recovery_hash = ? WHERE id = ?").bind(await sha256(cleanCode(code)), me).run();
      return json({ code });
    }

    case "logout":
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json", "set-cookie": "nl_s=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax" },
      });

    case "delete": {
      if (!me) return json({ error: "Sign in first." }, { status: 401 });
      await env.DB.batch([
        env.DB.prepare("DELETE FROM creds WHERE uid = ?").bind(me),
        env.DB.prepare("DELETE FROM users WHERE id = ?").bind(me),
      ]);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json", "set-cookie": "nl_s=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax" },
      });
    }
  }
  return json({ error: "Unknown action" }, { status: 404 });
}
