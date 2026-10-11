// Which libraries visitors have asked to have copied. The copier on GitHub (nomad-library-data) reads this list.
//   GET  /api/want              -> { wanted: [[slug, name, askedAt], ...] }  oldest request first
//   POST /api/want  {lib}       -> { ok: true }  marks one library wanted (idempotent, one atomic statement)
// The seeded libraries stay unwanted until a visitor actually opens one that has no copy yet.
import { json, libraryInfo, SLUG_RE } from "../../lib/core.js";

const MAX_WANTED = 600;   // a ceiling so nobody can queue the whole world

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT slug, name, wanted_at FROM libs WHERE wanted = 1 AND name IS NOT NULL ORDER BY wanted_at, slug").all();
  return json({ wanted: results.map(r => [r.slug, r.name, r.wanted_at]) }, { headers: { "cache-control": "no-store" } });
}

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  let lib = "";
  try { lib = String((await request.json()).lib || "").toLowerCase(); } catch {}
  if (!SLUG_RE.test(lib)) return json({ error: "Pick a library first." }, { status: 400 });
  const have = await env.DB.prepare("SELECT slug, name, wanted FROM libs WHERE slug = ?").bind(lib).first();
  if (have?.wanted) return json({ ok: true }, { headers: { "cache-control": "no-store" } });
  let name = have?.name;
  if (!name) {
    const info = await libraryInfo(ctx, lib);
    if (!info) return json({ error: "That library wasn't found." }, { status: 404 });
    name = info.name;
  }
  const { n } = await env.DB.prepare("SELECT count(*) n FROM libs WHERE wanted = 1").first();
  if (n >= MAX_WANTED) return json({ ok: true, queued: false }, { headers: { "cache-control": "no-store" } });
  const now = Date.now();
  // one statement, so two visitors registering the same library at once cannot undo each other
  await env.DB.prepare(
    "INSERT INTO libs (slug, name, last_opened, wanted, wanted_at) VALUES (?1, ?2, ?3, 1, ?3) " +
    "ON CONFLICT(slug) DO UPDATE SET wanted = 1, wanted_at = CASE WHEN libs.wanted = 0 THEN ?3 ELSE libs.wanted_at END, name = COALESCE(libs.name, ?2)"
  ).bind(lib, name, now).run();
  return json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
