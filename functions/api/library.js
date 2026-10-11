// GET /api/library?q=<catalog link, library website, or code>  -> { slug, name }
// Most people know their library's website, not its catalog address, so a homepage works too:
// we read it and look for the BiblioCommons catalog it links to.
import { json, slugFrom, libraryInfo, gw, SLUG_RE } from "../../lib/core.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const NOPE = "We can't show that library yet.";

// Which catalog software a page belongs to, so we can count what people use. First match wins.
const VENDORS = [
  [/aspendiscovery\.org|aspen discovery/i, "Aspen Discovery"],
  [/polarislibrary\.com|polaris/i, "Polaris"],
  [/iiivega\.com|vega discover|encore|innovative interfaces|\.iii\.com/i, "Innovative"],
  [/sirsidynix|\.ent\.sirsi\.net|enterprise\.sirsi|\/uhtbin\/cgisirsi/i, "SirsiDynix"],
  [/koha|cgi-bin\/koha/i, "Koha"],
  [/evergreen|\/eg\/opac/i, "Evergreen"],
  [/tlcdelivers|librarycat|biblionix|auto-graphics|atriuum|follett|resourcemate|libraryworld|bibliotheca|opalcat|libib/i, "Other"],
];
const vendorOf = text => (VENDORS.find(([re]) => re.test(text)) || [])[1] || "";
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

async function get(url, ms = 9000) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", cf: { cacheTtl: 86400 }, signal: AbortSignal.timeout(ms) });
  const html = r.ok ? (await r.text()).slice(0, 150000) : "";
  return { url: r.url || url, status: r.status, html };
}
function slugIn(url, html) {
  if (/\.bibliocommons\.com/i.test(url)) return slugFrom(url);
  const counts = {};
  for (const m of html.matchAll(/https?:\/\/([a-z0-9-]+)\.bibliocommons\.com/gi)) {
    const s = m[1].toLowerCase();
    if (!["www", "gateway", "help", "api", "cdn", "assets"].includes(s) && !/cdn|static|assets/.test(s)) counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

// Reads a library's own website for its catalog, so nobody has to know what a "catalog link" is:
// the page itself, then the links on it that look like "Catalog" or "Search", then a guess from the web address.
async function fromWebsite(ctx, input) {
  let url = String(input || "").trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const host = hostOf(url);
  if (!/\.[a-z]{2,}$/i.test(host)) return { slug: null, vendor: "", host: "" };
  let vendor = vendorOf(host);
  try {
    const first = await get(url);
    vendor = vendor || vendorOf(first.url + " " + first.html.slice(0, 60000));
    let slug = slugIn(first.url, first.html);
    if (slug) return { slug, vendor: "BiblioCommons", host };
    const links = [];
    for (const m of first.html.matchAll(/<a\s[^>]*?href=["']([^"'#][^"']*)["'][^>]*>([^<]{0,60})</gi)) {
      const [, href, text] = m;
      if (/catalog|opac|search the|find (books|a book|materials)|library catalog|discover/i.test(text + " " + href) && !/^(mailto|tel|javascript):/i.test(href)) {
        try { const u = new URL(href, first.url).href; if (!links.includes(u) && hostOf(u) !== "" ) links.push(u); } catch {}
      }
      if (links.length >= 3) break;
    }
    for (const u of links) {
      try {
        const g = await get(u, 7000);
        slug = slugIn(g.url, g.html);
        if (slug) return { slug, vendor: "BiblioCommons", host };
        vendor = vendor || vendorOf(g.url + " " + g.html.slice(0, 60000));
      } catch {}
    }
  } catch {}
  // many libraries use their own short name as the BiblioCommons name (nypl.org -> nypl)
  const guess = host.split(".")[0];
  if (SLUG_RE.test(guess)) return { slug: guess, guess: true, vendor, host };
  return { slug: null, vendor, host };
}

export async function onRequestGet(ctx) {
  const q = new URL(ctx.request.url).searchParams.get("q") || "";
  if (!q.trim()) return json({ error: "Type your library's name or town, or paste its website." }, { status: 400 });
  let slug = slugFrom(q);
  let info = slug && await libraryInfo(ctx, slug);
  let seen = { vendor: "", host: /[./]/.test(q) ? hostOf(/^https?:/i.test(q) ? q : "https://" + q) : "" };
  if (!info && /[./]/.test(q)) {
    const found = await fromWebsite(ctx, q);
    seen = { vendor: found.vendor, host: found.host };
    if (found.slug) {
      slug = found.slug; info = await libraryInfo(ctx, slug);
      // a guess from the web address is only believed when the library's own website agrees (spl.org is Seattle, not BiblioCommons' "spl")
      if (info && found.guess) {
        const { d } = await gw(ctx, slug, 86400);
        const site = Object.values(d?.entities?.libraries || {})[0]?.cmsUrl || "";
        if (!hostOf(site).split(".").includes(slug)) info = null;
      }
    }
  }
  if (!info) return json({ error: NOPE, unsupported: true, vendor: seen.vendor, host: seen.host }, { status: 404 });
  // remember it so it shows up in everyone's library search
  ctx.waitUntil(ctx.env.DB.prepare("INSERT OR IGNORE INTO libs (slug, name) VALUES (?, ?)").bind(info.slug, info.name).run().catch(() => {}));
  return json(info, { headers: { "cache-control": "public, max-age=86400" } });
}
