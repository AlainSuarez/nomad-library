// GET  /api/me  -> { uid, data, passkeys } or { uid: null }
// PUT  /api/me  { data }  saves your library, favorites, watchlist and settings
import { json, currentUser } from "../../lib/core.js";

export async function onRequestGet({ request, env }) {
  const uid = await currentUser(env, request);
  if (!uid) return json({ uid: null }, { headers: { "cache-control": "no-store" } });
  const u = await env.DB.prepare("SELECT data FROM users WHERE id = ?").bind(uid).first();
  if (!u) return json({ uid: null }, { headers: { "cache-control": "no-store" } });
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM creds WHERE uid = ?").bind(uid).first();
  return json({ uid, data: JSON.parse(u.data || "{}"), passkeys: n?.n || 0 }, { headers: { "cache-control": "no-store" } });
}

export async function onRequestPut({ request, env }) {
  const uid = await currentUser(env, request);
  if (!uid) return json({ error: "Sign in first." }, { status: 401 });
  const text = await request.text();
  if (text.length > 200000) return json({ error: "That's more than an account can hold." }, { status: 413 });
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: "Bad data" }, { status: 400 }); }
  await env.DB.prepare("UPDATE users SET data = ?, updated = ? WHERE id = ?")
    .bind(JSON.stringify(body.data || {}), Date.now(), uid).run();
  return json({ ok: true });
}
