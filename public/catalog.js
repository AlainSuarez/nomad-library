// Any library catalog link -> which catalog system it is, and a link that searches it for a title.
// Shared by the page (app.js) and the server (functions/api/library.js). No network here: it only reads the address.
// The search link is opened by the visitor's own browser, so it works even when a catalog blocks other websites.

const SYSTEMS = [
  // [code, test on the whole address]
  ["bibliocommons", /\.bibliocommons\.com/i],
  ["aspen", /aspendiscovery\.org|[?&]browseCategory=|\/(Search\/Results|GroupedWork|Union\/Search|MyAccount\/Home)\b/i],
  ["vega", /iiivega\.com/i],
  ["encore", /\/iii\/encore/i],
  ["polaris", /polarislibrary\.com|\/polaris\//i],
  ["enterprise", /\.sirsi\.net|\/client\/[a-z]{2}_[A-Z]{2}\b/i],
  ["evergreen", /\/eg2?\/opac|\/eg2\/|\.evergreen\./i],
  ["koha", /\/cgi-bin\/koha|koha/i],
  ["sierra", /\/search~S\d+|\/search\/[a-zX]\?|\/patroninfo|\/screens\/|webpac/i],
  ["carl", /ls2pac|carlconnect|carl\.org|[?#&]section=(search|home)/i],
  ["spydus", /spydus/i],
  ["apollo", /biblionix\.com/i],
  ["atriuum", /booksys\.net/i],
];

// Words that are never a library's name, for naming a library from its catalog address.
const GENERIC = /^(www\d?|catalog|catalogue|search|find|opac|webpac|pac|ls2pac|discover|discovery|encore|polaris|library|lib|my|online|ent|apps?|portal|vega|na|bc|cat|ils|sirsi|koha|eg|evergreen|go|new|home|secure)$/i;

export function catalogSystem(href) {
  return (SYSTEMS.find(([, re]) => re.test(href)) || [""])[0];
}

// -> { url, host, system, find } where find has {q} where the title goes; null when it is not a web address.
// knownSystem: the system when the page itself told us (a catalog on the library's own domain).
export function readCatalogLink(input, knownSystem = "") {
  let s = String(input || "").trim();
  if (!s || /\s/.test(s) || !/[.]/.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (!/\.[a-z]{2,}$/i.test(u.hostname)) return null;
  const href = u.href, system = knownSystem || catalogSystem(href);
  const o = u.origin, p = u.pathname, qp = u.searchParams;
  let find = "";
  switch (system) {
    case "aspen": find = `${o}/Search/Results?lookfor={q}&searchIndex=Keyword&searchSource=local`; break;
    case "vega": find = `${o}/search?query={q}&searchType=everything&pageSize=10`; break;
    case "encore": find = `${o}/iii/encore/search/C__S{q}__Orightresult__U`; break;
    case "polaris": {
      const ctx = /^[\d.]+$/.test(qp.get("ctx") || "") ? qp.get("ctx") : "1.1033.0.0.1";
      find = `${o}/polaris/search/searchresults.aspx?ctx=${ctx}&type=Keyword&term={q}&by=KW&sort=RELEVANCE&limit=&query=&page=0`; break;
    }
    case "enterprise": {
      const m = p.match(/\/client\/([a-z]{2}_[A-Z]{2})\/([^/]+)/);
      find = `${o}/client/${m ? m[1] : "en_US"}/${m ? m[2] : "default"}/search/results?qu={q}`; break;
    }
    case "evergreen": {
      const pre = (p.match(/^(.*?)\/eg2?\//) || ["", ""])[1];
      const locg = /^\d+$/.test(qp.get("locg") || "") ? `&locg=${qp.get("locg")}` : "";
      find = `${o}${pre}/eg/opac/results?query={q}&qtype=keyword${locg}`; break;
    }
    case "koha": find = `${o}/cgi-bin/koha/opac-search.pl?q={q}`; break;
    case "sierra": {
      const scope = (p.match(/\/search(~S\d+)/) || ["", ""])[1];
      find = `${o}/search${scope}/X?SEARCH={q}&SORT=D`; break;
    }
    case "carl": find = `${o}/?section=search&term={q}`; break;
    case "spydus": find = `${o}/cgi-bin/spydus.exe/ENQ/WPAC/BIBENQ?ENTRY={q}&ENTRY_NAME=BS&ENTRY_TYPE=K&NRECS=20`; break;
    default: find = "";
  }
  return { url: href, host: u.hostname.replace(/^www\./, ""), system, find };
}

// A friendly name from the address when nothing better is known: roxbury.aspendiscovery.org -> "Roxbury".
// Only hosted catalogs carry the library's own name in the address, so anything else stays unnamed.
export function nameFromHost(host) {
  const parts = String(host || "").toLowerCase().split(".");
  if (parts.length < 3 || !/aspendiscovery\.org$|bibliocommons\.com$/.test(host)) return "";
  const w = parts[0];
  if (GENERIC.test(w) || w.length < 3) return "";
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// The link that searches this catalog for one title. Falls back to the catalog the visitor gave us.
export function searchLink(cat, title) {
  if (!cat) return "";
  const t = String(title || "").replace(/\s+\/.*$/, "").replace(/\(.*?\)|\[.*?\]/g, " ").replace(/[:;]/g, " ").replace(/\s+/g, " ").trim();
  const q = encodeURIComponent(t || String(title || ""));
  if (cat.find && cat.find.includes("{q}")) return cat.find.replace("{q}", q);
  return cat.url || (cat.host ? `https://${cat.host}/` : "");
}
