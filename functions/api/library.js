// GET /api/library?q=<catalog link, library website, or code>  -> { slug, name }
// Most people know their library's website, not its catalog address, so a homepage works too:
// we read it and look for the BiblioCommons catalog it links to.
import { json, slugFrom, libraryInfo } from "../../lib/core.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const NOPE = "We couldn't find a BiblioCommons catalog for that library, so it isn't supported yet.";

async function fromWebsite(input) {
  let url = String(input || "").trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  let host;
  try { host = new URL(url).hostname; } catch { return null; }
  if (!/\.[a-z]{2,}$/i.test(host)) return null;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", cf: { cacheTtl: 86400 } });
    if (r.url && /\.bibliocommons\.com/i.test(r.url)) return slugFrom(r.url);
    const html = (await r.text()).slice(0, 400000);
    const counts = {};
    for (const m of html.matchAll(/https?:\/\/([a-z0-9-]+)\.bibliocommons\.com/gi)) {
      const s = m[1].toLowerCase();
      if (!["www", "gateway", "help", "api"].includes(s) && !/cdn|static|assets/.test(s)) counts[s] = (counts[s] || 0) + 1;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : null;
  } catch { return null; }
}

export async function onRequestGet(ctx) {
  const q = new URL(ctx.request.url).searchParams.get("q") || "";
  if (!q.trim()) return json({ error: "Type your library's name, its website, or paste its catalog link." }, { status: 400 });
  let slug = slugFrom(q);
  let info = slug && await libraryInfo(ctx, slug);
  if (!info && /[./]/.test(q)) {
    slug = await fromWebsite(q);
    info = slug && await libraryInfo(ctx, slug);
  }
  if (!info) return json({ error: NOPE, unsupported: true }, { status: 404 });
  // remember it so it shows up in everyone's library search
  ctx.waitUntil(ctx.env.DB.prepare("INSERT OR IGNORE INTO libs (slug, name) VALUES (?, ?)").bind(info.slug, info.name).run().catch(() => {}));
  return json(info, { headers: { "cache-control": "public, max-age=86400" } });
}
