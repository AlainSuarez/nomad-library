// Nomad Library: any BiblioCommons library's movies on one browsable shelf.
// The server only relays the library's catalog. Ratings, sorting and your lists
// all happen here in the browser, which keeps the site free to run.


const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const SHELVES = [
  ["all", "Everything"], ["new", "New arrivals"], ["mustsee", "1001 must-sees"], ["oscar", "Oscar winners"],
  ["registry", "Film Registry"], ["criterion", "Criterion"], ["ghibli", "Studio Ghibli"],
  ["horror", "Horror"], ["comedy", "Comedy"], ["romcom", "Rom-com"], ["scifi", "Sci-fi"], ["action", "Action"],
  ["suspense", "Suspense"], ["animation", "Animation"], ["family", "Family"], ["documentary", "Documentary"],
  ["foreign", "Foreign"], ["western", "Western"], ["war", "War"], ["musical", "Musical"], ["tv", "TV shows"],
];
const TOP_PAGES = 36;

// ---- state ------------------------------------------------------------------

const store = {
  get() { try { return JSON.parse(localStorage.getItem("nl") || "{}"); } catch { return {}; } },
  set(v) { try { localStorage.setItem("nl", JSON.stringify(v)); } catch {} },
};
let S = Object.assign({ lib: null, libName: "", fmt: "all", shelf: "all", sort: "", onShelf: false, faves: {}, watch: null }, store.get());
let me = { uid: null, passkeys: 0 };
let saveTimer = null;

function save() {
  store.set(S);
  if (!me.uid) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch("/api/me", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: synced() }) })
      .catch(() => {});
  }, 1200);
}
const synced = () => ({ lib: S.lib, libName: S.libName, fmt: S.fmt, faves: S.faves, watch: S.watch });

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

// ---- IMDb ratings, matched in the browser -------------------------------------

const ART = /^(the|a|an|le|la|les|el|los|il)\s+/i;
function norm(t) {
  t = String(t || "").toLowerCase().trim();
  t = t.replace(/\s*[:(\[].*$/, "").replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(ART, "");
  return t.replace(/\s+/g, " ").trim();
}
// Keeps the part after a colon: "Alien: Covenant" -> "alien covenant".
function normFull(t) {
  t = String(t || "").toLowerCase().replace(/\(.*?\)|\[.*?\]/g, " ").replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(ART, "");
  return t.replace(/\s+/g, " ").trim();
}
const shardKey = k => (k + "_").slice(0, 2).replace(/ /g, "_");
const shards = new Map();
function shard(k) {
  const s = shardKey(k);
  if (!shards.has(s)) shards.set(s, fetch(`/ix/${s}.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({})));
  return shards.get(s);
}
// The library lists the DISC year (The Shining shows up as 2010), so the year is
// only a ceiling. Among what's left, the most-voted title wins.
function pick(c, { disc, tv, year }) {
  if (!c?.length) return null;
  if (year) { const e = c.filter(r => Math.abs(r[3] - year) <= 1); if (e.length) c = e; }
  else if (disc) { const ok = c.filter(r => !r[3] || r[3] <= disc + 1); if (ok.length) c = ok; }
  const typed = c.filter(r => r[4] === (tv ? "s" : "m"));
  if (typed.length && typed[0][2] >= c[0][2] * 0.2) c = typed;
  const r = c[0];
  return { imdb: r[0], r: r[1], v: r[2], fy: r[3] || null };
}
const EDITION = /edition|widescreen|full ?screen|collector|anniversary|season|series|volume|vol\.|director|cut|remaster|restored|special|deluxe|criterion|blu-?ray|dvd|4k|uhd|motion picture|film|movie/i;
async function rate(rows) {
  await Promise.all(rows.map(async row => {
    if (row.imdb !== undefined) return;
    const k = norm(row.title);
    row.imdb = null;
    if (!k) return;
    const sub = (row.sub || "").replace(/\s*\/.*$/, "").trim();
    const tail = [row.title.includes(":") ? row.title.split(":").slice(1).join(" ") : "", sub].join(" ").trim();
    if (tail) {
      const k2 = normFull(row.title + " " + sub);
      const m2 = pick((await shard(k2))[k2], { disc: row.disc, tv: row.tv });
      if (m2) return Object.assign(row, m2);
      // "Star Wars: The Mandalorian and Grogu" is not Star Wars. Only edition notes fall back.
      if (!EDITION.test(tail)) return;
    }
    const m = pick((await shard(k))[k], { disc: row.disc, tv: row.tv });
    if (m) Object.assign(row, m);
  }));
  return rows;
}

// ---- api ----------------------------------------------------------------------

async function api(path, opts) {
  const r = await fetch(path, opts);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong. Try again.");
  return d;
}
const searchUrl = (page, sort) => {
  const p = new URLSearchParams({ lib: S.lib, fmt: S.fmt, shelf: S.shelf, page, sort: sort ?? S.sort });
  const q = $("#q").value.trim();
  if (q) p.set("q", q);
  return "/api/search?" + p;
};

// ---- rendering ----------------------------------------------------------------

const favKey = r => `${S.lib}:${r.id}`;
const isFav = r => !!S.faves[favKey(r)];
const filmYear = r => r.fy || r.disc || "";

const badgeHTML = r => (r.r && r.v >= 50 ? `<span class="badge"><b>★</b> ${r.r.toFixed(1)}</span>` : "");
function cardHTML(r) {
  const rating = badgeHTML(r);
  const cover = r.img
    ? `<img loading="lazy" src="${esc(r.img)}" alt="" onload="if(this.naturalWidth<20)this.onerror()" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'noimg',textContent:${esc(JSON.stringify(r.title))}}))">`
    : `<span class="noimg">${esc(r.title)}</span>`;
  const av = r.avail ? `<span class="avail in">On the shelf</span>`
    : `<span class="avail out">All out${r.holds ? ` · ${r.holds} hold${r.holds > 1 ? "s" : ""}` : ""}</span>`;
  return `<div class="card" data-id="${esc(r.id)}">
    <button class="cover" data-open="${esc(r.id)}" aria-label="${esc(r.title)}">${cover}${rating}</button>
    <button class="heart" data-fav="${esc(r.id)}" aria-pressed="${isFav(r)}" aria-label="Favorite">${isFav(r) ? "♥" : "♡"}</button>
    <div class="ttl">${esc(r.title)}</div>
    <div class="meta">${esc(filmYear(r))} · ${esc(r.fmts || r.fmt)}</div>
    ${av}
  </div>`;
}

const rowsById = new Map();
function remember(rows) { for (const r of rows) rowsById.set(r.id, r); return rows; }

// One card per film: the library often has the DVD, the Blu-ray and a reissue as separate records.
const filmKey = r => norm(r.title) + "|" + (r.imdb || r.disc || "") + "|" + (r.tv ? norm(r.sub) : "");
function edition(r) { return { id: r.id, fmt: r.fmt, url: r.url, avail: r.avail, copies: r.copies, total: r.total, holds: r.holds, img: r.img, disc: r.disc }; }
function absorb(into, r) {
  into.eds = into.eds || [edition(into)];
  if (into.eds.some(e => e.id === r.id)) return;
  into.eds.push(edition(r));
  into.avail = into.eds.some(e => e.avail);
  into.holds = into.eds.reduce((n, e) => n + (e.holds || 0), 0);
  into.fmts = [...new Set(into.eds.map(e => e.fmt))].sort().reverse().join(" + ");
  if (!into.img && r.img) into.img = r.img;
  rowsById.set(r.id, into);
}
function merge(rows, seen) {
  const out = [];
  for (const r of rows) {
    const k = filmKey(r);
    if (seen.has(k)) { absorb(seen.get(k), r); continue; }
    seen.set(k, r); out.push(r);
  }
  return out;
}

function openDetail(r) {
  const yearNote = r.fy && r.disc && r.fy !== r.disc ? `<b>${r.fy}</b> film, ${r.disc} disc` : `<b>${esc(filmYear(r))}</b>`;
  const fmtLabel = r.fmts || r.fmt;
  const imdb = r.imdb ? `<a class="btn ghost" href="https://www.imdb.com/title/${esc(r.imdb)}/" target="_blank" rel="noopener">IMDb ${r.r ? r.r.toFixed(1) : ""}</a>` : "";
  const av = r.avail ? `<b style="color:var(--ok)">On the shelf</b>${r.eds ? "" : ` · ${r.copies} of ${r.total} in`}`
    : `<b style="color:var(--stamp)">All checked out</b>${r.holds ? ` · ${r.holds} on hold` : ""}`;
  $("#detailBody").innerHTML = `<div class="in">
    <button class="x" data-close aria-label="Close">×</button>
    <div class="d">
      <div class="cover">${r.img ? `<img src="${esc(r.img)}" alt="">` : `<span class="noimg">${esc(r.title)}</span>`}</div>
      <div>
        <h2>${esc(r.title)}</h2>
        ${r.sub ? `<p class="sub">${esc(r.sub)}</p>` : ""}
        <div class="facts">${yearNote} · ${esc(fmtLabel)}${r.r ? ` · <b>★ ${r.r.toFixed(1)}</b> from ${Number(r.v).toLocaleString()} votes` : ""}<br>${av}</div>
        ${r.desc ? `<p>${esc(r.desc)}</p>` : ""}
        ${r.eds && r.eds.length > 1 ? `<div class="facts">${r.eds.map(e => `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.fmt)}${e.disc ? ` (${e.disc})` : ""}</a>: ${e.avail ? `<b style="color:var(--ok)">${e.copies} in</b>` : `all out${e.holds ? `, ${e.holds} holds` : ""}`}`).join("<br>")}</div>` : ""}
        <div class="actions">
          <a class="btn" href="${esc((r.eds?.find(e => e.avail) || r).url)}" target="_blank" rel="noopener">${r.avail ? "Place a hold" : "Get in line"}</a>
          <a class="btn ghost" href="/t?q=${encodeURIComponent(r.title + " " + (r.fy || ""))}" target="_blank" rel="noopener">Trailer</a>
          ${imdb}
          <button class="btn ghost" data-fav="${esc(r.id)}">${isFav(r) ? "♥ Saved" : "♡ Save"}</button>
        </div>
      </div>
    </div></div>`;
  $("#detail").showModal();
}

function toggleFav(id) {
  const r = rowsById.get(id);
  if (!r) return;
  const k = favKey(r);
  if (S.faves[k]) delete S.faves[k];
  else S.faves[k] = { ...r, lib: S.lib, added: Date.now() };
  save();
  document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach(b => {
    b.setAttribute("aria-pressed", isFav(r));
    b.textContent = b.classList.contains("heart") ? (isFav(r) ? "♥" : "♡") : (isFav(r) ? "♥ Saved" : "♡ Save");
  });
  counts();
  if (!me.uid && Object.keys(S.faves).length === 3 && !S.nudged) {
    S.nudged = true; store.set(S);
    toast("Make a free account to keep your favorites on every device.");
  }
}

function counts() {
  const f = Object.values(S.faves).filter(x => x.lib === S.lib).length;
  $("#favCount").textContent = f ? f : "";
  const w = S.watch?.matches?.[S.lib];
  $("#wlCount").textContent = w ? w.filter(x => x.hits.length).length : "";
}

// ---- browsing -----------------------------------------------------------------

let run = 0, page = 0, pages = 1, loading = false, topRows = null, seen = new Map();

function visible(rows) { return S.onShelf ? rows.filter(r => r.avail) : rows; }

async function reload() {
  const my = ++run;
  page = 0; pages = 1; topRows = null; seen = new Map();
  $("#grid").innerHTML = "";
  $("#status").textContent = "Loading…";
  $("#more").textContent = "";
  if (S.sort === "top") return loadTop(my);
  await loadMore(my);
}

async function loadMore(my = run) {
  if (loading || page >= pages || S.sort === "top") return;
  loading = true;
  try {
    const d = await api(searchUrl(page + 1));
    if (my !== run) return;
    page = d.page; pages = d.pages;
    remember(d.rows);
    // Covers go up right away. Ratings fill in a moment later, then duplicate editions fold together.
    const shown = visible(d.rows);
    $("#grid").insertAdjacentHTML("beforeend", shown.map(cardHTML).join(""));
    rate(d.rows).then(() => {
      if (my !== run) return;
      const keep = new Set(merge(d.rows, seen).map(r => r.id));
      for (const r of shown) {
        const card = $("#grid").querySelector(`.card[data-id="${CSS.escape(r.id)}"]`);
        if (!card) continue;
        if (!keep.has(r.id)) { card.remove(); continue; }
        card.outerHTML = cardHTML(r);
      }
    });
    $("#status").textContent = d.total ? `${d.total.toLocaleString()} titles` : "Nothing here at this library.";
    $("#more").textContent = page < pages ? "Loading more…" : (d.total ? "That's the whole shelf." : "");
    if (page < pages) fetch(searchUrl(page + 1)).catch(() => {});
  } catch (e) {
    if (my === run) $("#status").textContent = e.message;
  } finally { loading = false; }
  if (my === run && page < pages && $("#grid").children.length < 12) loadMore(my);
}

// Rank a whole shelf by IMDb rating, pulling its pages a few at a time.
async function loadTop(my) {
  try {
    const first = await api(searchUrl(1, ""));
    if (my !== run) return;
    const n = Math.min(TOP_PAGES, first.pages);
    const all = remember(first.rows);
    const draw = () => {
      const films = merge(all, new Map());
      const sorted = films.sort((a, b) => ((b.v >= 1000 ? b.r : 0) - (a.v >= 1000 ? a.r : 0)) || (b.v || 0) - (a.v || 0));
      $("#grid").innerHTML = visible(sorted).slice(0, 300).map(cardHTML).join("");
    };
    await rate(all); draw();
    let p = 2;
    const worker = async () => {
      while (p <= n && my === run) {
        const mine = p++;
        try { const d = await api(searchUrl(mine, "")); all.push(...remember(d.rows)); } catch {}
        $("#status").textContent = `Ranking ${all.length.toLocaleString()} of ${Math.min(first.total, n * 25).toLocaleString()} titles…`;
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (my !== run) return;
    await rate(all); draw();
    $("#status").textContent = first.total > all.length
      ? `Top rated among the first ${all.length.toLocaleString()} of ${first.total.toLocaleString()} titles${S.shelf === "all" && !$("#q").value.trim() ? ". Pick a genre to rank a smaller shelf." : "."}`
      : `${first.total.toLocaleString()} titles, best rated first`;
    $("#more").textContent = "";
  } catch (e) { if (my === run) $("#status").textContent = e.message; }
}

// ---- favorites and watchlist tabs ------------------------------------------------

function showFaves() {
  const rows = Object.values(S.faves).filter(x => x.lib === S.lib).sort((a, b) => b.added - a.added);
  remember(rows);
  $("#favGrid").innerHTML = rows.map(cardHTML).join("");
  $("#favStatus").textContent = rows.length
    ? `${rows.length} saved. Availability is from when you saved it, so tap one to check the library.`
    : "Tap the heart on any movie to save it here.";
}

function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

function readWatchlist(text) {
  const rows = parseCSV(text);
  const h = rows.shift()?.map(x => x.trim().toLowerCase()) || [];
  const col = name => h.indexOf(name);
  let items = [], source = "";
  if (col("const") >= 0 && col("title") >= 0) {           // IMDb export
    source = "IMDb";
    const ty = col("title type");
    const ot = col("original title");
    items = rows.map(r => ({ t: r[col("title")], o: ot >= 0 ? r[ot] : "", y: +r[col("year")] || null, imdb: r[col("const")], tv: ty >= 0 && /series/i.test(r[ty]) }));
  } else if (col("name") >= 0) {                          // Letterboxd export
    source = "Letterboxd";
    items = rows.map(r => ({ t: r[col("name")], y: +r[col("year")] || null }));
  }
  return { source, items: items.filter(i => i.t).slice(0, 1000) };
}

async function matchWatchlist() {
  const W = S.watch;
  if (!W?.items?.length) return showWatch();
  W.matches = W.matches || {};
  const out = [];
  $("#wlStatus").textContent = `Checking ${W.items.length} titles at ${S.libName}…`;
  for (let i = 0; i < W.items.length; i += 6) {
    const chunk = W.items.slice(i, i + 6);
    let hits = chunk.map(() => []);
    try { hits = (await api("/api/find", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lib: S.lib, items: chunk }) })).hits; } catch {}
    chunk.forEach((it, j) => out.push({ ...it, hits: hits[j] || [] }));
    $("#wlStatus").textContent = `Checked ${Math.min(i + 6, W.items.length)} of ${W.items.length}…`;
  }
  W.matches[S.lib] = out;
  save(); counts(); showWatch();
}

async function showWatch() {
  const m = S.watch?.matches?.[S.lib];
  if (!m) { $("#wlGrid").innerHTML = ""; $("#wlMissing").innerHTML = ""; $("#wlStatus").textContent = S.watch ? "" : ""; if (S.watch?.items?.length) matchWatchlist(); return; }
  const have = [], miss = [];
  for (const it of m) {
    if (it.hits.length) {
      const r = it.hits[0];
      r.fy = it.y || r.fy;
      have.push(r);
    } else miss.push(it);
  }
  await rate(remember(have));
  $("#wlGrid").innerHTML = have.map(cardHTML).join("");
  $("#wlStatus").textContent = `${have.length} of ${m.length} from your ${S.watch.source} watchlist are at ${S.libName}.`;
  $("#wlMissing").innerHTML = miss.length
    ? `<h3>Not at this library</h3><p>${miss.map(x => esc(x.t) + (x.y ? ` (${x.y})` : "")).join(" · ")}</p><p class="small-print">Ask about interlibrary loan. Most libraries can borrow a movie from another library for you.</p>`
    : "";
}

// ---- accounts ------------------------------------------------------------------

const WA = window.SimpleWebAuthnBrowser;
const passkeysOK = () => !!(window.PublicKeyCredential && WA);

async function refreshMe() {
  try { me = await api("/api/me"); } catch { me = { uid: null }; }
  $("#acctBtn").textContent = me.uid ? "Account" : "Sign in";
  return me;
}

function mergeIn(data) {
  if (!data) return;
  S.faves = { ...(data.faves || {}), ...S.faves };
  if (!S.lib && data.lib) { S.lib = data.lib; S.libName = data.libName; }
  if (!S.watch && data.watch) S.watch = data.watch;
  if (data.fmt && !store.get().fmt) S.fmt = data.fmt;
}

async function afterSignIn(extra) {
  await refreshMe();
  mergeIn(me.data);
  save();
  if (extra?.code) return showCode(extra.code, true);
  $("#account").close();
  toast("Signed in. Your shelf is saved.");
  boot();
}

async function passkeyCreate() {
  const opts = await api("/api/auth/register-options", { method: "POST" });
  const response = await WA.startRegistration({ optionsJSON: opts });
  return api("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ response, data: synced(), label: navigator.platform || "" }) });
}
async function passkeySignIn() {
  const opts = await api("/api/auth/login-options", { method: "POST" });
  const response = await WA.startAuthentication({ optionsJSON: opts });
  return api("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ response }) });
}
const cancelled = e => /NotAllowed|AbortError|cancel/i.test(e?.name + e?.message);

function acctView(html) { $("#acctBody").innerHTML = `<div class="in acct-body"><button class="x" data-close aria-label="Close">×</button>${html}</div>`; }

function openAccount() {
  if (me.uid) {
    acctView(`<h2>Your account</h2>
      <p>Your library, favorites and watchlist are saved and follow you to any device you sign in on.</p>
      <div class="stack">
        ${passkeysOK() ? `<button class="btn" id="addKey">Add a passkey on this device</button>` : ""}
        <button class="btn ghost" id="newCode">Make a new backup code</button>
        <button class="btn ghost" id="signOut">Sign out</button>
        <button class="btn danger" id="delAcct">Delete my account</button>
      </div>
      <p class="small-print" style="margin-top:14px">${me.passkeys} passkey${me.passkeys === 1 ? "" : "s"} on this account.</p>`);
  } else {
    acctView(`<h2>Save your shelf</h2>
      <p>A free account keeps your library, favorites and watchlist on every device. No email and no password: you sign in with your face, fingerprint or device PIN.</p>
      <div class="stack">
        ${passkeysOK() ? `<button class="btn" id="mkKey">Create a free account</button>
        <button class="btn ghost" id="useKey">Sign in with a passkey</button>` : ""}
        <div class="divider">or</div>
        <button class="btn ghost" id="useCode">Sign in with a backup code</button>
        ${passkeysOK() ? `<button class="link small-print" id="mkCode" style="justify-self:center">My device can't use passkeys</button>`
          : `<button class="btn ghost" id="mkCode">Create an account with a backup code</button>`}
      </div>
      <p class="err" id="acctErr" role="alert"></p>`);
  }
  if (!$("#account").open) $("#account").showModal();
}

function showCode(code, fresh) {
  acctView(`<h2>${fresh ? "You're in. Save this code." : "Your new backup code"}</h2>
    <p>If you ever lose your phone or switch computers, this code gets you back into your account. It's the only copy, so keep it somewhere safe, like your password manager or notes.</p>
    <div class="code">${esc(code)}</div>
    <div class="stack" style="margin-top:14px">
      <button class="btn ghost" id="copyCode">Copy it</button>
      <button class="btn" id="savedCode">I saved it</button>
    </div>`);
  $("#copyCode").onclick = () => navigator.clipboard?.writeText(code).then(() => toast("Copied"));
  $("#savedCode").onclick = () => { $("#account").close(); boot(); };
}

function codeForm() {
  acctView(`<h2>Sign in with your backup code</h2>
    <p>It's the code you saved when you made your account.</p>
    <form id="codeForm" class="stack">
      <input id="codeIn" class="code" autocomplete="one-time-code" placeholder="XXXX-XXXX-XXXX-XXXX" style="font-size:18px">
      <button class="btn">Sign in</button>
    </form>
    <p class="err" id="acctErr" role="alert"></p>`);
  $("#codeForm").onsubmit = async e => {
    e.preventDefault();
    try { await api("/api/auth/recover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: $("#codeIn").value }) }); afterSignIn(); }
    catch (err) { $("#acctErr").textContent = err.message; }
  };
}

document.addEventListener("click", async e => {
  const t = e.target.closest("button, a");
  if (!t) return;
  const err = m => { const el = $("#acctErr"); if (el) el.textContent = m; else toast(m); };
  try {
    if (t.id === "mkKey") afterSignIn(await passkeyCreate());
    else if (t.id === "useKey") afterSignIn(await passkeySignIn());
    else if (t.id === "useCode") codeForm();
    else if (t.id === "mkCode") afterSignIn(await api("/api/auth/code-signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: synced() }) }));
    else if (t.id === "addKey") { await passkeyCreate(); await refreshMe(); toast("Passkey added."); openAccount(); }
    else if (t.id === "newCode") showCode((await api("/api/auth/new-code", { method: "POST" })).code, false);
    else if (t.id === "signOut") { await api("/api/auth/logout", { method: "POST" }); me = { uid: null }; $("#acctBtn").textContent = "Sign in"; $("#account").close(); toast("Signed out. This device keeps a copy of your shelf."); }
    else if (t.id === "delAcct") {
      if (!confirm("Delete your account and everything saved in it? This can't be undone.")) return;
      await api("/api/auth/delete", { method: "POST" }); me = { uid: null }; $("#acctBtn").textContent = "Sign in"; $("#account").close(); toast("Account deleted.");
    }
  } catch (ex) { if (!cancelled(ex)) err(ex.message); }
});

// ---- wiring -----------------------------------------------------------------------

function setTab(tab) {
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab));
  for (const id of ["browse", "faves", "watch"]) $("#" + id).hidden = id !== tab;
  if (tab === "faves") showFaves();
  if (tab === "watch") showWatch();
}

function paintControls() {
  document.querySelectorAll("#fmt button").forEach(b => b.setAttribute("aria-pressed", b.dataset.fmt === S.fmt));
  document.querySelectorAll("#chips button").forEach(b => b.setAttribute("aria-pressed", b.dataset.shelf === S.shelf && !$("#q").value.trim()));
  $("#sort").value = S.sort;
  $("#onShelf").checked = !!S.onShelf;
}

async function chooseLibrary(q) {
  $("#pickErr").textContent = "";
  try {
    const info = await api("/api/library?q=" + encodeURIComponent(q));
    S.lib = info.slug; S.libName = info.name; S.shelf = "all"; S.sort = "";
    save(); boot();
  } catch (e) { $("#pickErr").textContent = e.message; }
}

function showHome() {
  $("#pick").hidden = false; $("#shelf").hidden = true;
  if (S.lib) fetch(searchUrl(1)).catch(() => {});
  $("#resume").hidden = !S.lib;
  if (S.lib) $("#resume").textContent = `Back to ${S.libName || S.lib}`;
  $("#pickInput").value = ""; $("#pickErr").textContent = "";
  window.scrollTo(0, 0);
}

function boot() {
  counts();
  if (!S.lib) { showHome(); $("#libBtn").hidden = true; return; }
  $("#pick").hidden = true; $("#shelf").hidden = false;
  $("#libBtn").hidden = false; $("#libBtn").textContent = S.libName || S.lib;
  paintControls(); setTab("browse"); reload();
}

$("#chips").innerHTML = SHELVES.map(([k, l]) => `<button data-shelf="${k}">${l}</button>`).join("");
$("#chips").onclick = e => { const b = e.target.closest("button"); if (!b) return; S.shelf = b.dataset.shelf; $("#q").value = ""; save(); paintControls(); reload(); };
$("#fmt").onclick = e => { const b = e.target.closest("button"); if (!b) return; S.fmt = b.dataset.fmt; save(); paintControls(); reload(); };
$("#sort").onchange = () => { S.sort = $("#sort").value; save(); reload(); };
$("#onShelf").onchange = () => { S.onShelf = $("#onShelf").checked; save(); reload(); };
$("#searchForm").onsubmit = e => { e.preventDefault(); $("#q").blur(); paintControls(); reload(); };
$("#q").addEventListener("search", () => { if (!$("#q").value) { paintControls(); reload(); } });
document.querySelector(".tabs").onclick = e => { const b = e.target.closest("button"); if (b) setTab(b.dataset.tab); };
$("#pickForm").onsubmit = e => { e.preventDefault(); chooseLibrary($("#pickInput").value); };
document.querySelector(".quick").onclick = e => { const b = e.target.closest("button"); if (b) chooseLibrary(b.dataset.lib); };
$("#libBtn").onclick = () => { showHome(); $("#pickInput").focus(); };
$("#home").onclick = e => { e.preventDefault(); showHome(); };
$("#resume").onclick = () => boot();
$("#acctBtn").onclick = openAccount;
$("#pickSignin").onclick = openAccount;
document.addEventListener("click", e => {
  const o = e.target.closest("[data-open]"); if (o) { const r = rowsById.get(o.dataset.open); if (r) openDetail(r); return; }
  const f = e.target.closest("[data-fav]"); if (f) { toggleFav(f.dataset.fav); return; }
  if (e.target.closest("[data-close]")) e.target.closest("dialog").close();
});
for (const d of document.querySelectorAll("dialog")) d.addEventListener("click", e => { if (e.target === d) d.close(); });
$("#wlFile").onchange = async () => {
  const f = $("#wlFile").files[0]; if (!f) return;
  const w = readWatchlist(await f.text());
  if (!w.items.length) { $("#wlStatus").textContent = "That file doesn't look like an IMDb or Letterboxd watchlist export."; return; }
  S.watch = { ...w, imported: Date.now(), matches: {} };
  save(); matchWatchlist();
};
new IntersectionObserver(es => { if (es[0].isIntersecting && !$("#browse").hidden) loadMore(); }, { rootMargin: "800px" }).observe($("#more"));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

// The shelf starts loading right away. The account check runs alongside it.
// Every visit opens on the home page. A saved library gets a one-tap "Back to" button there.
showHome();
if (S.lib) { $("#libBtn").hidden = false; $("#libBtn").textContent = S.libName || S.lib; }
counts();
refreshMe().then(() => {
  if (!me.uid) return;
  mergeIn(me.data); store.set(S);
  if ($("#pick").hidden) counts(); else showHome();
  if (S.lib) { $("#libBtn").hidden = false; $("#libBtn").textContent = S.libName || S.lib; }
});
