// Which libraries visitors have asked to have copied. The copier on GitHub (nomad-library-data) reads this list.
//   GET  /api/want              -> { wanted: [[slug, name, askedAt, url], ...] }  oldest request first (url: catalog link, readers only)
//   POST /api/want  {lib}       -> { ok: true }  marks one library wanted (idempotent, one atomic statement)
// The seeded libraries stay unwanted until a visitor actually opens one that has no copy yet.
import { json, libraryInfo, SLUG_RE } from "../../lib/core.js";
import { isReaderLib, READER_SYSTEMS, readerId, readCatalogLink } from "../../public/catalog.js";

const MAX_WANTED = 3000;  // a ceiling so nobody can queue the whole world (600 until 11.1.26, when ~430 Vega/Polaris/Enterprise/CARL libraries were queued)

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT slug, name, wanted_at, url FROM libs WHERE wanted = 1 AND name IS NOT NULL ORDER BY wanted_at, slug").all();
  return json({ wanted: results.map(r => r.url ? [r.slug, r.name, r.wanted_at, r.url] : [r.slug, r.name, r.wanted_at]) }, { headers: { "cache-control": "no-store" } });
}

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  let lib = "", given = "", url = "";
  try {
    const b = await request.json(); lib = String(b.lib || "").toLowerCase();
    given = String(b.name || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
    url = String(b.url || "").trim().slice(0, 400);
  } catch {}
  // catalogs we copy ourselves ("vega.sdpl.na5.iiivega.com"): no BiblioCommons lookup, the visitor's name for it (or its address) stands
  const reader = isReaderLib(lib) && lib.length <= 90 && READER_SYSTEMS.includes(lib.split(".")[0]);
  if (!reader && !SLUG_RE.test(lib)) return json({ error: "Pick a library first." }, { status: 400 });
  // the link must be the catalog the id names: same system, same address
  if (reader) { const cat = readCatalogLink(url, lib.split(".")[0]); if (!cat || readerId(cat) !== lib) url = ""; }
  if (reader && !url) return json({ error: "That catalog link doesn't match." }, { status: 400 });
  const have = await env.DB.prepare("SELECT slug, name, wanted FROM libs WHERE slug = ?").bind(lib).first();
  if (have?.wanted) return json({ ok: true }, { headers: { "cache-control": "no-store" } });
  let name = have?.name;
  if (!name && reader) name = given || lib.slice(lib.indexOf(".") + 1).split("_")[0];
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
    "INSERT INTO libs (slug, name, last_opened, wanted, wanted_at, url) VALUES (?1, ?2, ?3, 1, ?3, ?4) " +
    "ON CONFLICT(slug) DO UPDATE SET wanted = 1, wanted_at = CASE WHEN libs.wanted = 0 THEN ?3 ELSE libs.wanted_at END, name = COALESCE(libs.name, ?2), url = COALESCE(libs.url, ?4)"
  ).bind(lib, name, now, url || null).run();
  return json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
