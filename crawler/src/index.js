// Weekly copies of each library's movies and games, so the site loads them in one go.
// Runs every minute and does a small slice each time to stay inside the free plan:
//   - a library is copied once a week while people are opening it,
//   - it pauses after 3 weeks without a visit,
//   - it picks back up the next time someone opens it.
// Ratings are attached here from IMDb's public data, so the browser does no matching.

const GW = "https://gateway.bibliocommons.com/v2/libraries";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const FMTS = [["BLURAY", "b"], ["DVD", "d"], ["VIDEO_GAME", "g"]];
const PAGES_PER_RUN = 12;
const DAY = 864e5, WEEK = 7 * DAY, IDLE = 21 * DAY;

const GENRES = [
  ["superhero", "superhero"], ["science fiction", "scifi"], ["horror", "horror"], ["romantic comed", "romcom"],
  ["comedy", "comedy"], ["comedies", "comedy"], ["animated", "animation"], ["animation", "animation"],
  ["children's", "family"], ["juvenile", "family"], ["family", "family"], ["fantasy", "fantasy"],
  ["war films", "war"], ["war ", "war"], ["western", "western"], ["musical", "musical"],
  ["biographical", "biography"], ["documentary", "documentary"], ["historical", "history"],
  ["thriller", "thriller"], ["suspense", "thriller"], ["crime", "crime"], ["detective", "crime"],
  ["mystery", "crime"], ["martial arts", "action"], ["action", "action"], ["adventure", "action"],
  ["sports", "sports"], ["romance", "romance"], ["foreign", "foreign"], ["television", "tv"], ["drama", "drama"],
];
const PLATFORMS = [
  [/switch\s*2/i, "Switch 2"], [/nintendo switch|\bswitch\b/i, "Switch"], [/playstation\s*5|\bps5\b/i, "PS5"],
  [/playstation\s*4|\bps4\b/i, "PS4"], [/xbox series|series x/i, "Xbox Series"], [/xbox one/i, "Xbox One"],
  [/\bxbox\b/i, "Xbox"], [/\bwii u\b/i, "Wii U"], [/\bwii\b/i, "Wii"], [/3ds/i, "3DS"],
];

const yearOf = v => { const m = String(v || "").match(/(19|20)\d{2}/); return m ? +m[0] : 0; };
const ART = /^(the|a|an|le|la|les|el|los|il)\s+/i;
const norm = t => String(t || "").toLowerCase().trim().replace(/\s*[:(\[].*$/, "").replace(/&/g, " and ")
  .replace(/[^a-z0-9 ]+/g, " ").replace(ART, "").replace(/\s+/g, " ").trim();
const normFull = t => String(t || "").toLowerCase().replace(/\(.*?\)|\[.*?\]/g, " ").replace(/&/g, " and ")
  .replace(/[^a-z0-9 ]+/g, " ").replace(ART, "").replace(/\s+/g, " ").trim();
const EDITION = /edition|widescreen|full ?screen|collector|anniversary|season|series|volume|vol\.|director|cut|remaster|restored|special|deluxe|criterion|blu-?ray|dvd|4k|uhd|motion picture|film|movie/i;

function pick(c, disc, tv) {
  if (!c?.length) return null;
  if (disc) {
    const ok = c.filter(r => !r[3] || r[3] <= disc + 1); if (ok.length) c = ok;
    // a new disc of a same-named film is usually the new film (Supernova 2020, not 2000)
    const recent = c.filter(r => r[3] && disc - r[3] <= 2 && r[2] >= c[0][2] * 0.15);
    if (recent.length) c = recent;
  }
  const typed = c.filter(r => r[4] === (tv ? "s" : "m"));
  if (typed.length && typed[0][2] >= c[0][2] * 0.2) c = typed;
  return c[0];
}

// One compact row per record. The site reads these by position:
// [id, title, sub, fmt, discYear, cover, onShelf, holds, genres, tv, platform, rating, votes, imdb, filmYear]
// Covers are almost always the same Syndetics address with a different ISBN/UPC, so a copy keeps only
// those numbers ("~isbn~upc~oclc") and the library's Syndetics client id is stored once. Halves the copy.
function coverOf(url, seen) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname === "secure.syndetics.com" && u.searchParams.get("type") === "xw12") {
      const client = u.searchParams.get("client") || "";
      if (!seen.client) seen.client = client;
      if (client === seen.client)
        return "~" + (u.searchParams.get("isbn") || "").replace(/\/[A-Z]+\.(GIF|JPG)$/i, "") + "~" + (u.searchParams.get("upc") || "") + "~" + (u.searchParams.get("oclc") || "");
    }
  } catch {}
  return url;
}

function shape(id, b, f, seen) {
  const br = b.briefInfo || {}, av = b.availability || {}, j = br.jacket || {};
  const subj = [...(br.subjectHeadings || []), ...(br.genreForm || [])].join(" | ").toLowerCase();
  const genres = [];
  for (const [needle, g] of GENRES) if (subj.includes(needle) && !genres.includes(g)) genres.push(g);
  const tv = /television|season \d|complete (series|season)/.test(subj + " " + (br.title || "") + " " + (br.subtitle || "")) ? 1 : 0;
  let plat = "";
  if (f === "g") { const hay = [br.title, br.subtitle, br.edition, br.callNumber].join(" "); for (const [re, p] of PLATFORMS) if (re.test(hay)) { plat = p; break; } }
  return [id, (br.title || "").trim(), (br.subtitle || "").trim(), f, yearOf(br.publicationDate),
    coverOf(j.medium || j.large || j.small || "", seen), (av.status === "AVAILABLE" || (av.availableCopies || 0) > 0) ? 1 : 0,
    av.heldCopies || 0, genres.slice(0, 4).join(","), tv, plat, 0, 0, "", 0];
}

async function attachRatings(db, rows) {
  const want = new Map();
  for (const r of rows) {
    if (r[3] === "g") continue;
    const k = norm(r[1]); if (!k) continue;
    const sub = r[2].replace(/\s*\/.*$/, "").trim();
    const tail = [r[1].includes(":") ? r[1].split(":").slice(1).join(" ") : "", sub].join(" ").trim();
    r._k = k; r._k2 = tail ? normFull(r[1] + " " + sub) : null; r._tail = tail;
    want.set(k, 1); if (r._k2) want.set(r._k2, 1);
  }
  if (!want.size) return;
  const { results } = await db.prepare("SELECT k, d FROM imdb WHERE k IN (SELECT value FROM json_each(?))")
    .bind(JSON.stringify([...want.keys()])).all();
  const ix = new Map(results.map(x => [x.k, JSON.parse(x.d)]));
  for (const r of rows) {
    if (!r._k) continue;
    let m = r._k2 ? pick(ix.get(r._k2), r[4], r[9]) : null;
    if (!m && (!r._tail || EDITION.test(r._tail))) m = pick(ix.get(r._k), r[4], r[9]);
    if (m) { r[11] = m[1]; r[12] = m[2]; r[13] = m[0]; r[14] = m[3] || 0; }
    delete r._k; delete r._k2; delete r._tail;
  }
}

async function page(slug, fmt, n) {
  const u = `${GW}/${slug}/bibs/search?query=*&searchType=bl&f_FORMAT=${fmt}&limit=25&page=${n}&sort=newly_acquired`;
  const r = await fetch(u, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`${slug} ${fmt} p${n}: ${r.status}`);
  return r.json();
}

async function nextJob(db, now) {
  // keep going on a copy that's underway, oldest first
  let job = await db.prepare("SELECT * FROM libs WHERE bver > 0 ORDER BY bstarted LIMIT 1").first();
  if (job) return job;
  // start one: never-copied libraries first, then the stalest copy, only if opened in the last 3 weeks
  job = await db.prepare(
    "SELECT * FROM libs WHERE last_opened > ? AND (ver = 0 OR finished < ?) ORDER BY ver > 0, finished LIMIT 1"
  ).bind(now - IDLE, now - WEEK).first();
  if (!job) return null;
  const bver = Math.max(job.ver, 0) + 1;
  await db.prepare("UPDATE libs SET bver = ?, bfmt = 0, bpage = 1, bseq = 0, bcount = 0, bstarted = ?, bexpect = 0 WHERE slug = ?")
    .bind(bver, now, job.slug).run();
  return { ...job, bver, bfmt: 0, bpage: 1, bseq: 0, bcount: 0, bstarted: now, bexpect: 0 };
}

export async function crawl(env) {
  const db = env.DB, now = Date.now();
  const job = await nextJob(db, now);
  if (!job) return { idle: true };
  let { slug, bver, bfmt, bpage, bseq, bcount, bexpect } = job;
  const [fmt, f] = FMTS[bfmt];
  const nums = Array.from({ length: PAGES_PER_RUN }, (_, i) => bpage + i);
  const got = await Promise.allSettled(nums.map(n => page(slug, fmt, n)));
  const rows = [], seen = { client: job.cover || "" };
  let pages = 0, errs = 0, cnt = 0;
  for (const g of got) {
    if (g.status !== "fulfilled") { errs++; continue; }
    const d = g.value, pg = d.catalogSearch?.pagination || {};
    pages = Math.max(pages, pg.pages || 0);
    if (pg.count) cnt = pg.count;
    const bibs = d.entities?.bibs || {};
    for (const res of d.catalogSearch?.results || []) {
      const id = res.representative; if (bibs[id]) rows.push(shape(id, bibs[id], f, seen));
    }
  }
  if (errs === nums.length) return { slug, fmt, error: "library didn't answer; retrying next minute" };
  if (bpage === 1) bexpect += cnt;
  await attachRatings(db, rows);
  const stmts = [];
  if (seen.client && seen.client !== job.cover) stmts.push(db.prepare("UPDATE libs SET cover = ? WHERE slug = ?").bind(seen.client, slug));
  if (rows.length) stmts.push(db.prepare("INSERT OR REPLACE INTO chunks (slug, ver, seq, body) VALUES (?, ?, ?, ?)")
    .bind(slug, bver, bseq, JSON.stringify(rows).slice(1, -1)));
  bseq++; bcount += rows.length;
  let next = bpage + PAGES_PER_RUN;
  if (!pages || next > pages) { bfmt++; next = 1; }
  if (bfmt >= FMTS.length) {
    // finished: publish this copy and clear out older ones
    stmts.push(db.prepare("UPDATE libs SET ver = ?, total = ?, finished = ?, bver = 0 WHERE slug = ?").bind(bver, bcount, now, slug));
    stmts.push(db.prepare("DELETE FROM chunks WHERE slug = ? AND ver < ?").bind(slug, bver));
  } else {
    stmts.push(db.prepare("UPDATE libs SET bfmt = ?, bpage = ?, bseq = ?, bcount = ?, bexpect = ? WHERE slug = ?")
      .bind(bfmt, next, bseq, bcount, bexpect, slug));
  }
  await db.batch(stmts);
  return { slug, fmt, from: bpage, pages, rows: rows.length, total: bcount, done: bfmt >= FMTS.length };
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(crawl(env)); },
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === "/run" && u.searchParams.get("key") === env.RUN_KEY) return Response.json(await crawl(env));
    return new Response("Nomad Library crawler", { status: 200 });
  },
};
