// GET /api/catalogs -> { "Name|ST": "catalog link", ... }  catalog links visitors gave for libraries in the directory.
// The page adds these to its own list (public/catalogs.json), so the next person from that library goes straight to browsing.
import { json } from "../../lib/core.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT key, url FROM catalogs ORDER BY n DESC LIMIT 5000").all();
  const out = {};
  for (const r of results) out[r.key] = r.url;
  return json(out, { headers: { "cache-control": "public, max-age=600" } });
}
