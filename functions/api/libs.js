// GET /api/libs  -> libraries people have opened, so the name search keeps growing.
import { json } from "../../lib/core.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT slug, name FROM libs WHERE name IS NOT NULL ORDER BY name").all();
  return json(results.map(r => [r.slug, r.name]), { headers: { "cache-control": "public, max-age=3600" } });
}
