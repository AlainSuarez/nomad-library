// POST /api/request {name, city, st, host, vendor, url} -> counts one more person asking for a library we cannot show yet.
// A count per library only: no cookie, no ID. The browser sends it at most once per library per device per day.
// With a catalog link for a library from the directory, the link is remembered for the next visitor from that library.
import { json } from "../../lib/core.js";
import { readCatalogLink } from "../../public/catalog.js";

const clip = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const MAX_ROWS = 20000;

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch {}
  const name = clip(b.name, 120), host = clip(b.host, 80).toLowerCase();
  if (!name && !host) return json({ error: "Nothing to count." }, { status: 400 });
  const city = clip(b.city, 60), st = clip(b.st, 3).toUpperCase(), vendor = clip(b.vendor, 40);
  const key = (host || `${name}|${st}`).toLowerCase().slice(0, 160);
  const { n } = await env.DB.prepare("SELECT count(*) n FROM requests").first();
  if (n >= MAX_ROWS) return json({ ok: true }, { headers: { "cache-control": "no-store" } });
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO requests (key, name, city, st, host, vendor, n, first, last) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7) " +
    "ON CONFLICT(key) DO UPDATE SET n = n + 1, last = ?7, vendor = CASE WHEN ?6 <> '' THEN ?6 ELSE requests.vendor END"
  ).bind(key, name, city, st, host, vendor, now).run();
  const cat = name && st && readCatalogLink(clip(b.url, 400));
  if (cat && cat.system !== "bibliocommons") {
    // the first link given stays, unless it was a plain website and this one is a catalog we recognize
    await env.DB.prepare(
      "INSERT INTO catalogs (key, url, system, n, updated) VALUES (?1, ?2, ?3, 1, ?4) " +
      "ON CONFLICT(key) DO UPDATE SET n = n + 1, updated = ?4, " +
      "url = CASE WHEN catalogs.system = '' AND ?3 <> '' THEN ?2 ELSE catalogs.url END, system = CASE WHEN catalogs.system = '' THEN ?3 ELSE catalogs.system END"
    ).bind(`${name}|${st}`, cat.url, cat.system, now).run().catch(() => {});
  }
  return json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
