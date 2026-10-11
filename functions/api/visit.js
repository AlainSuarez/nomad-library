// POST /api/visit  {new: bool}  -> adds 1 to today's device count. A count only: no cookie, no ID, no IP, nothing about who.
// The browser sends this at most once per device per day (see countVisit in app.js).
import { json } from "../../lib/core.js";

export async function onRequestPost({ request, env }) {
  let fresh = 0;
  try { fresh = (await request.json()).new ? 1 : 0; } catch {}
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    "INSERT INTO visits (day, devices, new_devices) VALUES (?1, 1, ?2) ON CONFLICT(day) DO UPDATE SET devices = devices + 1, new_devices = new_devices + ?2"
  ).bind(day, fresh).run();
  return json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
