// Real-browser checks of the site's catalog loading, with the whole network mocked (nothing leaves the machine).
//   node test/browser.mjs [scenario-name-fragment]
// Needs Chrome and puppeteer-core (found in ~/node_modules). Large fixtures use the real catalogs published for
// the six finished libraries when available (set FIXTURE_DIR), otherwise generated rows.
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";

const require = createRequire(path.join(os.homedir(), "node_modules") + "/");
const puppeteer = require("puppeteer-core");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PUBLIC = path.join(ROOT, "public");
const { shape } = await import(pathToFileURL(path.join(ROOT, "lib/core.js")).href);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FIXTURE_DIR = process.env.FIXTURE_DIR || "";
const ONLY = process.argv[2] || "";
const HOST = "library.nomadovernormal.com", SNAPHOST = "chrisgpresents.github.io";
let pass = 0, fail = 0;
const results = [];
const ok = (c, msg) => { c ? pass++ : fail++; console.log(`  ${c ? "pass" : "FAIL"}: ${msg}`); };
const note = (k, v) => { results.push([k, v]); console.log(`  measure: ${k} = ${v}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", json: "application/json", png: "image/png", woff2: "font/woff2", svg: "image/svg+xml", webmanifest: "application/manifest+json", ico: "image/x-icon", txt: "text/plain" };
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// ---- fixtures ---------------------------------------------------------------------------------------
function makeRows(slug, n, { games = 0, prefix = slug.toUpperCase() } = {}) {
  const G = ["horror", "comedy", "drama", "action,thriller", "scifi", "family,animation", "documentary", "romance"];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const g = i >= n - games;
    rows.push([`S${slug}C${i}`, g ? `${prefix} Game ${i}` : `${prefix} Movie ${i} ${["Alpha", "Bravo", "Charlie", "Delta"][i % 4]}`, "", g ? "g" : i % 2 ? "b" : "d",
      2000 + (i % 25), "", i % 3 ? 1 : 0, i % 5, g ? "" : G[i % G.length], 0, g ? ["Switch", "PS5", "Xbox One"][i % 3] : "",
      g ? 0 : +(4 + (i % 50) / 10).toFixed(1), g ? 0 : 1000 + i * 3, g ? "" : `tt${1000000 + i}`, g ? 0 : 1990 + (i % 35)]);
  }
  return rows;
}
const snapBody = (rows, finished = Date.now()) => zlib.gzipSync(JSON.stringify({ ver: finished, finished, total: rows.length, sc: "", rows }));
function realRows(slug) {
  if (!FIXTURE_DIR) return null;
  for (const f of [`${slug}.json`, `${slug}.json.gz`]) {
    const p = path.join(FIXTURE_DIR, f);
    if (fs.existsSync(p)) { const b = fs.readFileSync(p); return JSON.parse(f.endsWith("gz") ? zlib.gunzipSync(b) : b); }
  }
  return null;
}

// ---- the mocked world ---------------------------------------------------------------------------------
function world(over = {}) {
  return {
    libs: [["bclsnj", "Burlington County Library System"], ["alpha", "Alpha Public Library"], ["beta", "Beta Public Library"], ["gamma", "Gamma Public Library"]],
    snap: {},                    // slug -> { status, body, delay, headers }
    me: { uid: null }, puts: [], wants: [], reqs: [], snapReqs: [], searchReqs: [], availReqs: [], oldSnapCalls: 0, searchFail: false, ...over,
  };
}
function liveItem(slug, id) {
  const n = +String(id).replace(/\D/g, "") || 0;
  return shape(slug, `L${slug}${n}`, { briefInfo: { title: `${slug.toUpperCase()} Live ${n}`, subtitle: "", format: n % 2 ? "BLURAY" : "DVD", publicationDate: "2011", subjectHeadings: [], genreForm: [] }, availability: { status: "AVAILABLE", availableCopies: 1, totalCopies: 2, heldCopies: 0 } });
}

async function newPage(browser, W, { ctx, seedState, idbBroken, viewport } = {}) {
  const context = ctx || (await browser.createBrowserContext());
  const page = await context.newPage();
  await page.setViewport(viewport || { width: 1280, height: 900 });
  await page.setRequestInterception(true);
  const cdp = await page.createCDPSession(); await cdp.send("Network.setBypassServiceWorker", { bypass: true });
  await page.evaluateOnNewDocument((seed, broken) => {
    if (navigator.serviceWorker) navigator.serviceWorker.register = () => new Promise(() => {});
    if (seed && !localStorage.getItem("nl")) localStorage.setItem("nl", JSON.stringify(seed));
    if (broken) Object.defineProperty(window, "indexedDB", { get() { throw new Error("storage blocked"); } });
  }, seedState || null, !!idbBroken);
  page.errors = [];
  page.on("pageerror", e => page.errors.push(String(e)));
  page.on("request", async req => {
    const u = new URL(req.url()), t0 = Date.now();
    const done = (status, body, type = "application/json", extra = {}) => req.respond({ status, contentType: type, body, headers: { "access-control-allow-origin": "*", ...extra } }).catch(() => {});
    try {
      if (u.hostname === SNAPHOST && W.realSnapHost) return req.continue();   // let this one go to the real GitHub host
      if (u.hostname === SNAPHOST) {
        const slug = decodeURIComponent(u.pathname.split("/").pop()).replace(/\.json\.gz$/, "");
        W.snapReqs.push({ slug, t: t0 });
        const f = W.snap[slug];
        if (!f) return done(404, "Not Found", "text/html");
        if (f.delay) await sleep(f.delay);
        if (f.abort) return req.abort("connectionfailed").catch(() => {});
        return done(f.status || 200, f.body ?? Buffer.alloc(0), f.type || "application/gzip");
      }
      if (u.hostname !== HOST) return u.pathname.match(/\.(gif|jpe?g|png)$/i) || u.hostname.includes("syndetics") ? done(200, GIF, "image/gif") : done(204, "");
      W.reqs.push(u.pathname);
      if (u.pathname.startsWith("/api/")) {
        const p = u.pathname;
        if (p === "/api/me") { if (req.method() === "PUT") { W.puts.push(JSON.parse(req.postData() || "{}")); return done(200, '{"ok":true}'); } return done(200, JSON.stringify(W.me)); }
        if (p === "/api/libs") return done(200, JSON.stringify(W.libs));
        if (p === "/api/library") { const q = (u.searchParams.get("q") || "").toLowerCase(); const hit = W.libs.find(l => l[0] === q || l[1].toLowerCase() === q); return hit ? done(200, JSON.stringify({ slug: hit[0], name: hit[1] })) : done(404, JSON.stringify({ error: "not found", unsupported: true })); }
        if (p === "/api/want") { W.wants.push(JSON.parse(req.postData() || "{}").lib); return done(200, '{"ok":true}'); }
        if (p === "/api/snap") { W.oldSnapCalls++; return done(200, '{"ver":0,"building":true}'); }
        if (p === "/api/search") {
          W.searchReqs.push(u.search);
          if (W.searchFail) return done(502, JSON.stringify({ error: "The library's catalog didn't answer. Try again in a minute." }));
          const lib = u.searchParams.get("lib"), pg = +u.searchParams.get("page") || 1;
          if (W.searchDelay) await sleep(W.searchDelay);
          return done(200, JSON.stringify({ total: 100, page: pg, pages: 4, rows: Array.from({ length: 25 }, (_, i) => liveItem(lib, (pg - 1) * 25 + i)) }));
        }
        if (p === "/api/avail") { W.availReqs.push(u.search); const out = {}; for (const id of (u.searchParams.get("ids") || "").split(",")) out[id] = { avail: false, copies: 0, total: 3, holds: 7 }; return done(200, JSON.stringify(out)); }
        return done(404, JSON.stringify({ error: "not mocked" }));
      }
      let rel = u.pathname === "/" ? "/index.html" : u.pathname;
      let file = path.join(PUBLIC, rel);
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = fs.existsSync(file + ".html") ? file + ".html" : path.join(PUBLIC, "index.html");
      const ext = path.extname(file).slice(1);
      return done(200, fs.readFileSync(file), MIME[ext] || "application/octet-stream", { "cache-control": "no-store" });
    } catch (e) { req.abort().catch(() => {}); }
  });
  return { page, context };
}

async function openSaved(page) {          // every visit opens on the home page; a saved library gets a "Back to" button
  await page.waitForSelector("#resume:not([hidden])", { timeout: 15000 });
  await page.click("#resume");
}
const cards = page => page.$$eval("#grid .card", els => els.length);
const status = page => page.$eval("#status", e => e.textContent).catch(() => "");
async function waitCards(page, min = 1, timeout = 20000) {
  const t0 = Date.now();
  await page.waitForFunction(m => document.querySelectorAll("#grid .card").length >= m, { timeout, polling: 20 }, min);
  return Date.now() - t0;
}
const titles = page => page.$$eval("#grid .card", els => els.slice(0, 40).map(e => e.textContent));
async function pickLibrary(page, slug) {
  await page.waitForSelector("#pickInput", { visible: true });
  await page.type("#pickInput", slug);
  await page.evaluate(() => document.querySelector("#pickForm").requestSubmit());
}

// ---- scenarios -----------------------------------------------------------------------------------------
const SCENARIOS = [];
const scenario = (name, fn) => SCENARIOS.push([name, fn]);

scenario("cold first visit, large real catalog: usable shelf time, then search/filters/games/detail", async b => {
  const rows = realRows("bclsnj") ? realRows("bclsnj").rows : makeRows("bclsnj", 28000, { games: 1600 });
  const W = world({ snap: { bclsnj: { body: snapBody(rows.length ? rows : []), delay: 700 } } });
  W.snap.bclsnj.body = snapBody(rows);
  const { page } = await newPage(b, W);
  await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  const t0 = Date.now(); await pickLibrary(page, "bclsnj");
  const tCards = await waitCards(page, 12);
  await page.waitForFunction(() => /\d[\d,]* titles/.test(document.querySelector("#status").textContent), { timeout: 20000 });
  const tUsable = Date.now() - t0;
  note("cold first usable shelf (ms, incl. 700 ms simulated host latency, 1 copy of " + rows.length + " rows)", tUsable);
  const st = await status(page);
  const n = +st.match(/([\d,]+) titles/)[1].replace(/,/g, "");
  ok(n > 10000 && !/loads live|copied|background/.test(st), `instant mode: "${st.slice(0, 80)}"`);
  ok(tUsable < 4500, `first usable shelf under 4.5 s (${tUsable} ms)`);
  ok(W.oldSnapCalls === 0 && W.searchReqs.length === 0, "no live search or old /api/snap call was needed");
  // search is local and instant
  const t1 = Date.now(); await page.type("#q", "zzzunlikely"); await page.waitForFunction(() => /^0 titles|Nothing/.test(document.querySelector("#status").textContent + document.querySelector("#more").textContent), { timeout: 5000 });
  note("local search response (ms)", Date.now() - t1);
  await page.$eval("#q", e => { e.value = ""; e.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForFunction(() => /\d[\d,]* titles/.test(document.querySelector("#status").textContent), { timeout: 5000 });
  // games tab
  await page.click('#fmt button[data-fmt="games"]');
  await page.waitForFunction(() => /games/.test(document.querySelector("#status").textContent), { timeout: 5000 });
  const gs = await status(page); ok(/\d[\d,]* games/.test(gs), `games tab: ${gs.slice(0, 40)}`);
  await page.click('#fmt button[data-fmt="all"]');
  // filters dialog opens and applies
  await page.click("#filtBtn"); await sleep(150);
  ok(await page.$eval("#filters", d => d.open), "filters dialog opens");
  await page.evaluate(() => document.querySelector("#filters").close()); await sleep(100);
  // detail + live availability
  await page.waitForSelector("#grid .card");
  await page.click("#grid .card"); await sleep(400);
  ok(await page.$eval("#detail", d => d.open), "detail opens");
  ok(W.availReqs.length >= 1, "live shelf check requested for the opened title");
  ok(page.errors.length === 0, `no page errors ${page.errors.slice(0, 1)}`);
});

scenario("REAL copy host: the six finished libraries each open from GitHub in a fresh browser, then again warm", async b => {
  const libs = [["bclsnj", "Burlington County Library System", 28749], ["chipublib", "Chicago Public Library", 29538], ["seattle", "The Seattle Public Library", 19268], ["sfpl", "San Francisco Public Library", 41180], ["aclibrary", "Alameda County Library", 24201], ["aapld", "Algonquin Area Public Library", 16474]];
  const counts = {};
  for (const [slug, name, total] of libs) {
    const W = world({ realSnapHost: true, libs: libs.map(l => [l[0], l[1]]) });
    const { page, context } = await newPage(b, W);          // a brand new browser profile: nothing cached
    await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#pickInput", { visible: true }); await page.type("#pickInput", slug);
    const t0 = Date.now(); await page.evaluate(() => document.querySelector("#pickForm").requestSubmit());
    await page.waitForFunction(n => document.querySelector("#libBtn").textContent.includes(n) && /\d[\d,]* titles/.test(document.querySelector("#status").textContent) && document.querySelectorAll("#grid .card").length >= 12, { timeout: 30000 }, name.split(" ")[0]);
    const dt = Date.now() - t0, st = await status(page), n = +st.match(/([\d,]+) titles/)[1].replace(/,/g, "");
    counts[slug] = n;
    note(`cold ${slug} (${total.toLocaleString()} titles) first usable shelf from the real GitHub host (ms)`, dt);
    ok(n > total * 0.5 && n <= total && !/live|copied|background/.test(st), `${slug}: instant mode with ${n.toLocaleString()} titles (copy has ${total.toLocaleString()} rows)`);
    ok(W.searchReqs.length === 0 && W.oldSnapCalls === 0, `${slug}: no live search or old snapshot call`);
    await sleep(900);                                          // let it finish saving to the device
    await page.close();
    W.realSnapHost = false; W.snap[slug] = { abort: true };   // now the copy host is unreachable
    const p2 = (await newPage(b, W, { ctx: context })).page;
    await p2.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
    const t1 = Date.now(); await openSaved(p2);
    await p2.waitForFunction(() => /\d[\d,]* titles/.test(document.querySelector("#status").textContent) && document.querySelectorAll("#grid .card").length >= 12, { timeout: 15000 });
    note(`warm ${slug} repeat visit, tap Back to library -> shelf, host unreachable (ms)`, Date.now() - t1);
    const n2 = +(await status(p2)).match(/([\d,]+) titles/)[1].replace(/,/g, "");
    ok(n2 === counts[slug], `${slug}: warm visit shows the same ${n2.toLocaleString()} titles`);
    await context.close();
  }
});

scenario("repeat visit: device copy opens at once, even with the copy host unreachable", async b => {
  const rows = makeRows("alpha", 8000, { games: 300 });
  const W = world({ snap: { alpha: { body: snapBody(rows), delay: 300 } } });
  const { page, context } = await newPage(b, W);
  await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  await pickLibrary(page, "alpha"); await waitCards(page, 12);
  await sleep(600);   // let the copy finish saving to this device
  await page.close();
  W.snap.alpha = { abort: true };                         // now the copy host is unreachable
  W.snapReqs.length = 0;
  const p2 = (await newPage(b, W, { ctx: context })).page;
  const t0 = Date.now(); await p2.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  await openSaved(p2); await waitCards(p2, 12);
  note("repeat visit: open site + tap Back to library -> shelf, host unreachable (ms)", Date.now() - t0);
  const st = await status(p2);
  ok(Date.now() - t0 < 2500, `opened from the device copy in under 2.5 s (${Date.now() - t0} ms)`);
  ok(/\d[\d,]* titles/.test(st) && !/live|copied/.test(st), `instant mode: "${st.slice(0, 60)}"`);
  ok(W.searchReqs.length === 0, "no live search needed");
});

scenario("old device copy (30 days) still opens immediately offline; refreshes when the host is back", async b => {
  const old = Date.now() - 30 * 864e5;
  const W = world({ snap: { alpha: { body: snapBody(makeRows("alpha", 3000), old) } } });
  const { page, context } = await newPage(b, W);
  await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  await pickLibrary(page, "alpha"); await waitCards(page, 12); await sleep(500); await page.close();
  W.snap.alpha = { delay: 400, body: snapBody(makeRows("alpha", 3500), Date.now()) };
  const p2 = (await newPage(b, W, { ctx: context })).page;
  const t0 = Date.now(); await p2.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  await openSaved(p2); await waitCards(p2, 12);
  ok(Date.now() - t0 < 2500, `a 30 day old copy is used immediately (${Date.now() - t0} ms)`);
  ok(/3,000 titles|\d,\d{3} titles/.test(await status(p2)), "shows the saved copy first");
  await sleep(1500);
  W.snap.alpha = { abort: true };
  const p3 = (await newPage(b, W, { ctx: context })).page;
  await p3.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" }); await openSaved(p3); await waitCards(p3, 12);
  const s3 = await status(p3);
  ok(/3,500 titles/.test(s3) || /3,[45]\d\d titles/.test(s3), `the background refresh was saved (${s3.slice(0, 30)})`);
});

scenario("uncopied library: live shelf quickly, one 'wanted' note, no loops", async b => {
  const W = world({});
  const { page, context } = await newPage(b, W);
  await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  const t0 = Date.now(); await pickLibrary(page, "beta");
  const t = await waitCards(page, 12);
  note("uncopied library first live shelf (ms)", Date.now() - t0);
  ok(Date.now() - t0 < 3500, `live shelf starts promptly (${Date.now() - t0} ms)`);
  await sleep(600);
  ok(/queued for its full collection/.test(await status(page)), `honest note, no promise of a date: "${(await status(page)).slice(-70)}"`);
  ok(W.wants.length === 1 && W.wants[0] === "beta", `registered once (${W.wants.length})`);
  const before = W.snapReqs.length;
  await sleep(2500);
  ok(W.snapReqs.length === before && W.snapReqs.length <= 2, `no copy-host request loop (${W.snapReqs.length} requests)`);
  await page.close();
  const p2 = (await newPage(b, W, { ctx: context })).page;
  await p2.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" }); await openSaved(p2); await waitCards(p2, 12); await sleep(500);
  ok(W.wants.length === 1, "a second visit the same day does not register again");
  ok(W.oldSnapCalls === 0, "old /api/snap never called");
});

scenario("copy host unreachable on a first visit: live shelf, registered once, no loop", async b => {
  const W = world({ snap: { gamma: { abort: true } } });
  const { page, context } = await newPage(b, W);
  await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  const t0 = Date.now(); await pickLibrary(page, "gamma"); await waitCards(page, 12);
  ok(Date.now() - t0 < 3500, `live shelf anyway (${Date.now() - t0} ms)`);
  await sleep(2500);
  ok(W.wants.length === 1 && W.wants[0] === "gamma", `registered once despite a transient failure (${W.wants.length})`);
  ok(W.snapReqs.length === 1, `one attempt, not a retry loop (${W.snapReqs.length} requests)`);
  ok(/Couldn't reach the saved collection|queued for its full collection/.test(await status(page)), `honest note: "${(await status(page)).slice(-62)}"`);
});

scenario("slow copy: browse live at once, copy joins later without yanking a search", async b => {
  const rows = makeRows("alpha", 6000);
  const W = world({ snap: { alpha: { body: snapBody(rows), delay: 5000 } } });
  const { page } = await newPage(b, W);
  await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  const t0 = Date.now(); await pickLibrary(page, "alpha"); await waitCards(page, 12);
  ok(Date.now() - t0 < 3500, `live shelf shown before the slow copy (${Date.now() - t0} ms)`);
  ok((await titles(page))[0].includes("Live"), "showing live results");
  await page.waitForFunction(() => /6,000 titles|\d,\d{3} titles/.test(document.querySelector("#status").textContent) && !document.querySelector("#grid .card").textContent.includes("Live"), { timeout: 12000 });
  ok(true, "switched to the instant copy once it arrived (no search was active)");
  // second half: an active search must not be replaced
  const W2 = world({ snap: { beta: { body: snapBody(makeRows("beta", 6000)), delay: 5000 } } });
  const p2 = (await newPage(b, W2)).page;
  await p2.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  await pickLibrary(p2, "beta"); await waitCards(p2, 12);
  await p2.type("#q", "Live 3"); await p2.evaluate(() => document.querySelector("#searchForm").requestSubmit()); await sleep(900);
  const before = await titles(p2);
  await sleep(6000);
  const after = await titles(p2);
  ok(JSON.stringify(before) === JSON.stringify(after) && (await p2.$eval("#q", e => e.value)) === "Live 3", "an active search is left alone when the copy arrives");
});

scenario("bad static data: corrupt, wrong shape, HTML 200, truncated gzip all fall back to live and are never saved", async b => {
  const good = JSON.stringify({ ver: 1, finished: Date.now(), total: 2, sc: "", rows: makeRows("alpha", 2) });
  const cases = { corrupt: Buffer.from("not json at all"), htmlok: Buffer.from("<html>home</html>"), shape: zlib.gzipSync(JSON.stringify({ rows: [[1, 2, 3]], finished: Date.now() })), trunc: zlib.gzipSync(good).subarray(0, 20), empty: zlib.gzipSync(JSON.stringify({ rows: [], finished: Date.now() })) };
  for (const [name, body] of Object.entries(cases)) {
    const W = world({ snap: { alpha: { body } } });
    const { page, context } = await newPage(b, W);
    await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
    await pickLibrary(page, "alpha"); await waitCards(page, 12);
    ok((await titles(page))[0].includes("Live"), `${name}: falls back to live results`);
    await sleep(300); await page.close();
    const p2 = (await newPage(b, W, { ctx: context })).page;
    await p2.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" }); await openSaved(p2); await waitCards(p2, 12);
    ok((await titles(p2))[0].includes("Live"), `${name}: nothing bad was saved on the device`);
    await p2.close();
  }
});

scenario("IndexedDB unavailable: site still works, copy re-downloaded", async b => {
  const W = world({ snap: { alpha: { body: snapBody(makeRows("alpha", 3000)), delay: 200 } } });
  const { page } = await newPage(b, W, { idbBroken: true });
  await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  await pickLibrary(page, "alpha"); await waitCards(page, 12);
  await page.waitForFunction(() => /\d,\d{3} titles/.test(document.querySelector("#status").textContent), { timeout: 8000 });
  ok(true, "instant copy works without any storage");
  ok(page.errors.length === 0, `no page errors ${page.errors.slice(0, 1)}`);
});

scenario("rapid library switching: a slow copy for the library you left never replaces the current one", async b => {
  const W = world({ snap: { alpha: { body: snapBody(makeRows("alpha", 3000)), delay: 6000 }, beta: { body: snapBody(makeRows("beta", 3000)), delay: 100 } } });
  const { page } = await newPage(b, W);
  await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  await pickLibrary(page, "alpha"); await sleep(300);
  await page.evaluate(() => document.querySelector("#libBtn").click()); await sleep(200);
  // back on the home page: choose the other library
  await page.waitForSelector("#pickInput", { visible: true });
  await page.$eval("#pickInput", e => { e.value = ""; }); await page.type("#pickInput", "beta");
  await page.evaluate(() => document.querySelector("#pickForm").requestSubmit());
  await waitCards(page, 12);
  await page.waitForFunction(() => /\d,\d{3} titles/.test(document.querySelector("#status").textContent), { timeout: 8000 });
  await sleep(7000);   // alpha's slow copy has arrived by now
  const t = await titles(page);
  ok(t.every(x => x.includes("BETA")), `still showing Beta after Alpha's copy arrived (${t[0]})`);
  ok(await page.$eval("#libBtn", e => /Beta/.test(e.textContent)), "header still names Beta");
});

scenario("live failure does not retry forever; Try again works", async b => {
  const W = world({ searchFail: true });
  const { page } = await newPage(b, W);
  await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  await pickLibrary(page, "gamma"); await sleep(5000);
  const n1 = W.searchReqs.length;
  ok(n1 >= 1 && n1 <= 3, `a failed first page is not retried in a loop (${n1} requests in 5 s)`);
  ok(!!(await page.$("#retryMore")), "a Try again button is shown");
  W.searchFail = false;
  await page.click("#retryMore"); await waitCards(page, 12, 8000);
  ok(true, "Try again loads the shelf");
});

scenario("favorites, watchlist and account state: a signed-in account's data is shown and saved, nothing is deleted", async b => {
  const fav = { id: "Salphac3", title: "ALPHA Movie 3 Delta", sub: "", f: "d", fmt: "DVD", disc: 2003, img: null, avail: true, holds: 0, genres: [], tv: false, plat: "", r: 0, v: 0, imdb: null, fy: null, url: "https://alpha.bibliocommons.com/v2/record/Salphac3", n: 3, lib: "alpha", added: Date.now() };
  const data = { lib: "alpha", libName: "Alpha Public Library", faves: { "alpha:Salphac3": fav }, watch: null };
  const W = world({ me: { uid: "u1", data, passkeys: 1 }, snap: { alpha: { body: snapBody(makeRows("alpha", 400)) } } });
  const { page } = await newPage(b, W);
  await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  await openSaved(page); await waitCards(page, 12, 15000);
  ok(await page.$eval("#acctBtn", e => !/Sign in/.test(e.textContent)), "account button shows signed-in state");
  await page.evaluate(() => document.querySelector('[data-tab="faves"]').click()); await sleep(500);
  ok((await page.$$eval("#favGrid .card", e => e.length)) >= 1, "the saved favorite is listed");
  await page.evaluate(() => document.querySelector('[data-tab="browse"]').click()); await sleep(200);
  await page.click("#grid .card"); await sleep(300);
  await page.click("#detailBody [data-fav]"); await sleep(3800);     // saves are batched for 3 s
  ok(W.puts.length >= 1, `saved to the account (${W.puts.length} PUT)`);
  const last = W.puts[W.puts.length - 1].data || {};
  ok(Object.keys(last.faves || {}).length >= 2 && !!last.faves["alpha:Salphac3"], `the earlier favorite is kept alongside the new one (${Object.keys(last.faves || {}).length} total)`);
  ok(!W.reqs.some(r => /delete|logout/.test(r)), "no delete or sign-out request was made");
});

scenario("narrow phone layout: no sideways scrolling on home, shelf, detail", async b => {
  const W = world({ snap: { alpha: { body: snapBody(makeRows("alpha", 3000, { games: 100 })) } } });
  const { page } = await newPage(b, W, { viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } });
  await page.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#pickInput", { visible: true }); await sleep(500);
  const ov = () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  let o = await ov(); ok(o.sw <= o.cw, `home: no overflow (${o.sw} vs ${o.cw})`);
  await pickLibrary(page, "alpha"); await waitCards(page, 12); await sleep(500);
  o = await ov(); ok(o.sw <= o.cw, `shelf: no overflow (${o.sw} vs ${o.cw})`);
  await page.click("#grid .card"); await sleep(500);
  const d = await page.$eval("#detail", e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
  ok(d.l >= -1 && d.r <= d.w + 1, `detail sheet fits the screen (${Math.round(d.l)}..${Math.round(d.r)} of ${d.w})`);
  try { await page.screenshot({ path: path.join(os.tmpdir(), "nl-mobile-detail.png") }); } catch {}
});

// ---- run ------------------------------------------------------------------------------------------------
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-first-run", "--disable-gpu"] });
try {
  for (const [name, fn] of SCENARIOS) {
    if (ONLY && !name.includes(ONLY)) continue;
    console.log(`\n== ${name}`);
    try { await Promise.race([fn(browser), sleep(120e3).then(() => { throw new Error("scenario timed out"); })]); }
    catch (e) { fail++; console.log("  FAIL: scenario error:", e.message.split("\n")[0]); }
  }
} finally { await browser.close().catch(() => {}); }
console.log(`\n${pass} passed, ${fail} failed`);
if (results.length) console.log("measurements:", JSON.stringify(Object.fromEntries(results)));
process.exit(fail ? 1 : 0);
