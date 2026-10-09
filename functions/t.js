// GET /t?q=The Shining 1980  -> straight to the top YouTube trailer.
// Resolved once, then kept in the edge cache, so nothing is fetched ahead of time.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export async function onRequestGet(ctx) {
  const q = (new URL(ctx.request.url).searchParams.get("q") || "").trim().slice(0, 140);
  const search = "https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " trailer");
  if (!q) return Response.redirect(search, 302);
  const key = new Request("https://nomad-library.cache/t/" + encodeURIComponent(q.toLowerCase()));
  const hit = await caches.default.match(key);
  let vid = hit ? await hit.text() : null;
  if (!hit) {
    try {
      const r = await fetch(search, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en" } });
      const m = (await r.text()).match(/"videoId":"([A-Za-z0-9_-]{11})"/);
      vid = m ? m[1] : "";
    } catch { vid = ""; }
    ctx.waitUntil(caches.default.put(key, new Response(vid, {
      headers: { "cache-control": `public, max-age=${vid ? 60 * 60 * 24 * 120 : 60 * 60 * 6}` },
    })));
  }
  return Response.redirect(vid ? `https://www.youtube.com/watch?v=${vid}` : search, 302);
}
