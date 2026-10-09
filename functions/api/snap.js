// GET /api/snap?lib=bclsnj  -> the library's weekly copy in one response, or how far along it is.
// Opening a library also tells the crawler it's in use (date only, never who).
import { json, libraryInfo, SLUG_RE } from "../../lib/core.js";

const HOUR = 36e5;

export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  const slug = (new URL(request.url).searchParams.get("lib") || "").toLowerCase();
  if (!SLUG_RE.test(slug)) return json({ error: "Pick a library first." }, { status: 400 });
  const now = Date.now();
  const row = await env.DB.prepare("SELECT slug, ver, total, finished, bver, bcount, bexpect, last_opened, cover FROM libs WHERE slug = ?").bind(slug).first();

  if (!row) {
    const info = await libraryInfo(ctx, slug);
    if (!info) return json({ error: "That library wasn't found." }, { status: 404 });
    await env.DB.prepare("INSERT OR IGNORE INTO libs (slug, name, last_opened) VALUES (?, ?, ?)").bind(slug, info.name, now).run();
    return json({ ver: 0, building: true, done: 0, expect: 0 }, { headers: { "cache-control": "no-store" } });
  }
  if (row.last_opened < now - 6 * HOUR)
    ctx.waitUntil(env.DB.prepare("UPDATE libs SET last_opened = ? WHERE slug = ?").bind(now, slug).run());
  if (!row.ver)
    return json({ ver: 0, building: true, done: row.bcount, expect: row.bexpect }, { headers: { "cache-control": "no-store" } });

  // The copy only changes once a week, so it's kept at the edge until the next version replaces it.
  const key = new Request(`https://nomad-library.cache/snap2/${slug}/${row.ver}`);
  const hit = await caches.default.match(key);
  if (hit) return new Response(hit.body, { headers: { "content-type": "application/json", "cache-control": "private, max-age=600", "x-snap": "edge" } });
  const { results } = await env.DB.prepare("SELECT body FROM chunks WHERE slug = ? AND ver = ? ORDER BY seq").bind(slug, row.ver).all();
  const body = `{"ver":${row.ver},"finished":${row.finished},"total":${row.total},"sc":${JSON.stringify(row.cover || "")},"rows":[${results.map(r => r.body).join(",")}]}`;
  ctx.waitUntil(caches.default.put(key, new Response(body, {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=604800" },
  })));
  return new Response(body, { headers: { "content-type": "application/json", "cache-control": "private, max-age=600", "x-snap": "db" } });
}
