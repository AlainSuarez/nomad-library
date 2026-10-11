import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { gw, libraryInfo, shape } from '../lib/core.js';
import { onRequestGet as search } from '../functions/api/search.js';

const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const originalFetch = globalThis.fetch;
const stored = new Map();
let pending = [], calls = 0;
globalThis.caches = { default: {
  async match(key) { return stored.get(key.url)?.clone(); },
  async put(key, response) { stored.set(key.url, response.clone()); },
} };
const fixture = { catalogSearch: { results: [{ representative: 'S1C1000' }], pagination: { count: 15000, pages: 600 } }, entities: { bibs: { S1C1000: { briefInfo: { title: 'Alien', format: 'BLURAY', publicationDate: '1979' }, availability: { status: 'AVAILABLE', availableCopies: 1 } } } } };
const ctx = url => ({ request: new Request(url), env: {}, waitUntil(p) { pending.push(p); } });
const flush = async () => { await Promise.all(pending); pending = []; };

await test('known library names do not download and parse gateway metadata', async () => {
  calls = 0; globalThis.fetch = async () => { calls++; throw Error('unexpected network'); };
  const env = { DB: { prepare: () => ({ bind: () => ({ first: async () => ({ slug: 'austin', name: 'Austin Public Library' }) }) }) } };
  assert.deepEqual(await libraryInfo({ env }, 'austin'), { slug: 'austin', name: 'Austin Public Library' });
  assert.equal(calls, 0);
});
await test('upstream timeouts and invalid JSON return controlled failures', async () => {
  globalThis.fetch = async () => { throw new DOMException('timeout', 'TimeoutError'); };
  assert.equal((await gw(ctx('https://local/api/search'), 'timeout')).ok, false);
  globalThis.fetch = async () => new Response('<html>unavailable</html>');
  const r = await gw(ctx('https://local/api/search'), 'bad-json');
  assert.equal(r.ok, false); assert.equal(r.status, 502); await flush();
});
await test('1,000 warm live-search requests reuse the shaped response', async () => {
  stored.clear(); calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json(fixture); };
  const url = 'https://local/api/search?lib=austin&fmt=all&page=1';
  assert.equal((await search(ctx(url))).status, 200); await flush();
  for (let batch = 0; batch < 20; batch++) await Promise.all(Array.from({ length: 50 }, async () => {
    const r = await search(ctx(url));
    const d = await r.json();
    assert.equal(d.rows[0].id, 'S1C1000'); assert.equal(d.total, 15000);
  }));
  assert.equal(calls, 1);
});
await test('live paging can continue beyond page 400 and genre queries stay separate', async () => {
  let upstream;
  globalThis.fetch = async url => { upstream = String(url); return Response.json(fixture); };
  const r = await search(ctx('https://local/api/search?lib=austin&page=401&shelf=crime'));
  assert.equal((await r.json()).page, 401); assert.match(upstream, /page=401/); assert.match(upstream, /crime/); await flush();
});
await test('live games carry platform and media type', () => {
  const r = shape('test', 'S1C1', { briefInfo: { title: 'Zelda', subtitle: 'Nintendo Switch 2', format: 'VIDEO_GAME' } });
  assert.equal(r.f, 'g'); assert.equal(r.plat, 'Switch 2');
});
await test('live filters exclude wrong years, low ratings, unavailable titles, and other consoles', () => {
  const code = app.slice(app.indexOf('function visible(rows)'), app.indexOf('async function liveReload()'));
  const context = vm.createContext({ S: { fmt: 'all', y0: 1980, y1: 2000, minR: 7, onShelf: true } });
  vm.runInContext(code, context);
  const good = { fy: 1990, r: 8, v: 1000, avail: true };
  const candidates = [good, { ...good, fy: 1979 }, { ...good, r: 6 }, { ...good, avail: false }, { ...good, v: 20 }];
  assert.equal(context.visible(candidates).length, 1);
  context.S = { fmt: 'games', plat: 'PS5' };
  assert.equal(context.visible([{ plat: 'PS5' }, { plat: 'Switch' }]).length, 1);
});
await test('an open page discovers a completed copy without replacing active browsing', async () => {
  const code = app.slice(app.indexOf('let checkingCopy = false;'), app.indexOf('setInterval(checkPendingCopy'));
  let saved = 0, painted = 0;
  const context = vm.createContext({ document: { visibilityState: 'visible' }, SNAP: { lib: 'austin', building: true }, S: { lib: 'austin' }, LATE: null,
    fetchStatic: async () => ({ d: { rows: [], finished: 1 } }), idbPut: () => { saved++; }, buildSnap: (lib, d) => ({ lib, ver: d.finished }),
    $: () => null, paintCopyToast: () => { painted++; }, readyNote: () => 'Open full collection', wantCopy: () => {},
  });
  vm.runInContext(code, context);
  await context.checkPendingCopy();
  assert.equal(context.LATE.lib, 'austin'); assert.equal(context.SNAP.building, true); assert.equal(saved, 1); assert.equal(painted, 1, 'the corner card is refreshed to say the copy is ready');
});
await test('a completed copy from the previous library cannot overwrite a new library', async () => {
  const code = app.slice(app.indexOf('let checkingCopy = false;'), app.indexOf('setInterval(checkPendingCopy'));
  let resolve;
  const context = vm.createContext({ document: { visibilityState: 'visible' }, SNAP: { lib: 'austin', building: true }, S: { lib: 'austin' }, LATE: null,
    fetchStatic: () => new Promise(r => { resolve = r; }), idbPut: () => {}, buildSnap: () => { throw Error('stale result applied'); }, $: () => null, paintCopyToast: () => {}, wantCopy: () => {},
  });
  vm.runInContext(code, context);
  const pendingCopy = context.checkPendingCopy(); context.S.lib = 'seattle'; resolve({ d: { finished: 1 } }); await pendingCopy;
  assert.equal(context.LATE, null);
});
globalThis.fetch = originalFetch;
await test('progress never invents a percentage before all format totals are known', () => {
  const code = app.slice(app.indexOf('function copyProgressNote'), app.indexOf('const liveNote'));
  const c = vm.createContext({ LATE: null, readyNote: () => 'Ready', copyNote: () => 'Queued', esc: String });
  vm.runInContext(code, c);
  const partial = c.copyProgressNote({ lib: 'austin', progress: { state: 'in progress', pagesDone: 100, pagesKnown: 100, formatsKnown: 1 } });
  assert.match(partial, /100 catalog pages/); assert.doesNotMatch(partial, /value=|% collected/);
  const full = c.copyProgressNote({ lib: 'austin', progress: { state: 'in progress', pagesDone: 100, pagesKnown: 200, formatsKnown: 3 } });
  assert.match(full, /50% collected/); assert.match(full, /value="100"/);
  assert.match(c.copyProgressNote({ lib: 'austin', progress: { state: 'in progress, run blocked by the library gateway' } }), /delayed/);
});
