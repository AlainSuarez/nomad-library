// POST /api/feedback { message, email?, lib?, page?, website } -> { ok }
// The Feedback button (Chris 11.1.26): people tell us what's broken, confusing or missing. Saved to D1 `feedback` only;
// nobody is emailed. Read it with tools/feedback.sh. Caps: 4,000 characters, 10 messages per address per day, 20,000 rows.
import { json, currentUser, sha256 } from "../../lib/core.js";

const MAX_ROWS = 20000, PER_DAY = 10;
const EMAIL = /^[^\s@<>()",;:]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}$/i;
const clip = (v, n) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch {}
  if (b.website) return json({ ok: true });                          // the hidden field only robots fill in
  const message = clip(b.message, 4000);
  if (message.length < 3) return json({ error: "Write a few words first." }, { status: 400 });
  const email = clip(b.email, 254).toLowerCase();
  if (email && !EMAIL.test(email)) return json({ error: "That email doesn't look right. Check it, or leave it empty." }, { status: 400 });
  const day = new Date().toISOString().slice(0, 10);
  const ipDay = (await sha256((request.headers.get("cf-connecting-ip") || "") + "|" + day)).slice(0, 24);
  const { n, mine } = await env.DB.prepare("SELECT count(*) n, sum(ip_day = ?1) mine FROM feedback").bind(ipDay).first();
  if (n >= MAX_ROWS || (mine || 0) >= PER_DAY) return json({ error: "Thanks, we've got plenty from you today. Try again tomorrow." }, { status: 429 });
  const uid = await currentUser(env, request).catch(() => null);
  const device = clip(request.headers.get("user-agent"), 300);
  await env.DB.prepare("INSERT INTO feedback (created, message, email, lib, page, device, uid, ip_day) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
    .bind(Date.now(), message, email || null, clip(b.lib, 120) || null, clip(b.page, 60) || null, device, uid, ipDay).run();
  return json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
