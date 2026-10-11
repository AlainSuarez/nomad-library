// The website check (/api/library) with the network mocked: pasting any normal library website should find the catalog.
import assert from "node:assert/strict";
import { test } from "node:test";
import { onRequestGet as library } from "../functions/api/library.js";
import { onRequestPost as request } from "../functions/api/request.js";

const stored = new Map();
globalThis.caches = { default: { async match(k) { return stored.get(k.url)?.clone(); }, async put(k, r) { stored.set(k.url, r.clone()); } } };
const original = globalThis.fetch;
const bc = (slug, site) => Response.json({ entities: { libraries: { [slug]: { longName: `${slug} library`, cmsUrl: site } } } });
// a fake internet: pages by URL, BiblioCommons answers for known slugs
function internet(pages, known) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    const g = u.match(/gateway\.bibliocommons\.com\/v2\/libraries\/([a-z0-9-]+)$/);
    if (g) return known[g[1]] ? bc(g[1], known[g[1]]) : new Response("{}", { status: 404 });
    const p = pages[u] || pages[u.replace(/\/$/, "")];
    if (!p) return new Response("nope", { status: 404 });
    if (p.redirect) { const r = new Response(p.html || "<html></html>", { headers: { "content-type": "text/html" } }); Object.defineProperty(r, "url", { value: p.redirect }); return r; }
    if (p.status) return new Response("blocked", { status: p.status });
    return new Response(p.html, { headers: { "content-type": "text/html" } });
  };
}
const env = (libs = {}) => ({ DB: { prepare: sql => ({ bind: (...a) => ({ first: async () => (libs[a[0]] ? { slug: a[0], name: libs[a[0]] } : null), run: async () => ({}) }) }) } });
const ask = async (q, e = env()) => { const r = await library({ request: new Request("https://x/api/library?q=" + encodeURIComponent(q)), env: e, waitUntil() {} }); return { status: r.status, body: await r.json() }; };

await test("a pasted catalog address works as before", async () => {
  internet({}, { chipublib: "https://www.chipublib.org" });
  const r = await ask("https://chipublib.bibliocommons.com/v2/search?query=x");
  assert.equal(r.status, 200); assert.equal(r.body.slug, "chipublib");
});
await test("a normal library website: the catalog link on its homepage is followed", async () => {
  internet({
    "https://smalltown.org": { html: '<a href="/about">About</a> <a href="https://catalog.smalltown.org/search">Search the catalog</a>' },
    "https://catalog.smalltown.org/search": { redirect: "https://smalltown.bibliocommons.com/v2/search", html: "" },
  }, { smalltown: "https://smalltown.org" });
  const r = await ask("smalltown.org");
  assert.equal(r.status, 200); assert.equal(r.body.slug, "smalltown");
});
await test("a homepage that only links to BiblioCommons somewhere in its text", async () => {
  internet({ "https://lib.example.org": { html: '<script>var u="https://eastport.bibliocommons.com/v2/home"</script>' } }, { eastport: "https://lib.example.org" });
  assert.equal((await ask("https://lib.example.org")).body.slug, "eastport");
});
await test("a guess from the web address is believed only when the library's own site agrees", async () => {
  internet({ "https://nypl.org": { html: "<html>no links</html>" }, "https://spl.org": { html: "<html>no links</html>" } },
    { nypl: "https://nypl.bibliocms.com", spl: "http://bibliocms.com/" });
  assert.equal((await ask("nypl.org")).body.slug, "nypl", "nypl.org -> nypl, its own site is nypl.bibliocms.com");
  const wrong = await ask("spl.org");
  assert.equal(wrong.status, 404, "spl.org must NOT open BiblioCommons' unrelated 'spl' (Stratford)"); assert.equal(wrong.body.unsupported, true);
});
await test("a known library website whose homepage hides its catalog still opens", async () => {
  internet({ "https://vpl.ca": { status: 403 } }, { vpl: "http://bibliocms.com/" });
  assert.equal((await ask("https://www.vpl.ca/")).body.slug, "vpl");
});
await test("another catalog system is recognized and reported, never a dead end", async () => {
  internet({ "https://roxbury.aspendiscovery.org": { status: 403 } }, {});
  const r = await ask("https://roxbury.aspendiscovery.org/?browseCategory=x");
  assert.equal(r.status, 404); assert.equal(r.body.unsupported, true);
  assert.equal(r.body.vendor, "Aspen Discovery"); assert.equal(r.body.host, "roxbury.aspendiscovery.org");
  assert.doesNotMatch(r.body.error, /catalog|BiblioCommons/i, "the message never uses jargon");
  internet({ "https://freelibrary.org": { html: '<a href="https://catalog.freelibrary.org/">Catalog</a> polaris' }, "https://catalog.freelibrary.org/": { html: "<title>Polaris</title>" } }, {});
  const p = await ask("freelibrary.org");
  assert.equal(p.status, 404); assert.equal(p.body.vendor, "Polaris");
});
await test("a site that is down or slow returns a controlled answer", async () => {
  globalThis.fetch = async () => { throw new DOMException("timeout", "TimeoutError"); };
  const r = await ask("down.example.org"); assert.equal(r.status, 404); assert.equal(r.body.unsupported, true);
});
await test("counting a request: validated, clipped, one statement", async () => {
  let sql = "", args = [];
  const e = { DB: { prepare: s => ({ first: async () => ({ n: 3 }), bind: (...a) => { sql = s; args = a; return { run: async () => ({}), first: async () => ({ n: 3 }) }; } }) } };
  const post = body => request({ request: new Request("https://x/api/request", { method: "POST", body: JSON.stringify(body) }), env: e });
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ name: "Denville Free Public Library", city: "Denville", st: "nj", vendor: "Aspen Discovery" })).status, 200);
  assert.match(sql, /ON CONFLICT\(key\) DO UPDATE SET n = n \+ 1/); assert.equal(args[3], "NJ");
  await post({ name: "x".repeat(900) }); assert.ok(args[1].length <= 120);
});
globalThis.fetch = original;
