import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile('dist/sw.js', 'utf8');
class MemoryCaches {
  stores = new Map();
  async open(name) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    const map = this.stores.get(name);
    return { put: async (key, response) => map.set(typeof key === 'string' ? key : key.url, response.clone()), match: async key => map.get(typeof key === 'string' ? key : key.url)?.clone() };
  }
  async keys() { return [...this.stores.keys()]; }
  async delete(name) { return this.stores.delete(name); }
}
const caches = new MemoryCaches(); let offline = false; let invalid = ''; let calls = 0; let skipped = 0; let claimed = 0;
const html = await readFile('dist/index.html', 'utf8');
function instance(script) {
  const events = {};
  const context = vm.createContext({ URL, Request, Response, Headers, AbortController, setTimeout, clearTimeout, caches, fetch: async url => {
    calls++;
    if (offline) throw new TypeError('offline');
    const path = new URL(typeof url === 'string' ? url : url.url).pathname;
    if (invalid === path) return new Response('<html>error</html>', { headers: { 'content-type': 'text/html' } });
    if (path === '/') return new Response(html, { headers: { 'content-type': 'text/html', 'content-length': '99999' } });
    const body = await readFile('dist' + path);
    return new Response(body, { headers: { 'content-type': path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.png') ? 'image/png' : 'application/json' } });
  }, self: { registration: { scope: 'https://usfirst.example/' }, location: { origin: 'https://usfirst.example' }, skipWaiting: async () => { skipped++; }, clients: { claim: async () => { claimed++; } }, addEventListener: (name, fn) => { events[name] = fn; } } });
  vm.runInContext(script, context);
  return events;
}
async function lifecycle(events, name) { let pending; events[name]({ waitUntil: value => { pending = value; } }); await pending; }
async function request(events, path, mode = 'same-origin', method = 'GET') {
  let response; events.fetch({ request: { url: 'https://usfirst.example' + path, mode, method }, respondWith: value => { response = value; } }); return response;
}
const events = instance(source);
await lifecycle(events, 'install'); await lifecycle(events, 'activate');
assert.equal(skipped, 1); assert.equal(claimed, 1);
const keys = await caches.keys(); assert.equal(keys.length, 1);
const version = keys[0].slice('usfirst-shell-'.length);
const assets = [...caches.stores.get(keys[0]).keys()].filter(key => key.includes('/assets/'));
assert.ok(assets.length >= 1);
const optional = JSON.parse(source.match(/const ASSETS = (.+);/)[1]).find(path => path.includes('RequestForm'));
assert.ok(optional);
assert.ok(![...caches.stores.get(keys[0]).keys()].some(key => key.includes('RequestForm')), '懒加载表单不阻塞核心安装');
await request(events, new URL(optional, 'https://usfirst.example/').pathname);
assert.ok([...caches.stores.get(keys[0]).keys()].some(key => key.includes('RequestForm')), '首次打开后缓存合法构建资源');
offline = true;
const before = calls;
assert.equal((await request(events, '/', 'navigate')).status, 200);
for (const asset of assets) assert.equal((await request(events, new URL(asset).pathname)).status, 200);
assert.equal(calls, before, '缓存启动不等网络');
for (const path of ['/api/session', '/api/requests', '/api/photos/private', '/api/recognize']) assert.equal(await request(events, path), undefined);
assert.equal(await request(events, '/api/requests', 'same-origin', 'POST'), undefined);
assert.equal(await request(events, '/unknown-private-data'), undefined);
const next = instance(source.replaceAll(version, 'next-version'));
await assert.rejects(lifecycle(next, 'install'));
assert.deepEqual(await caches.keys(), keys, '离线更新不得破坏已安装版本');
offline = false;
await assert.rejects(lifecycle(next, 'install'), /version mismatch/i);
assert.deepEqual(await caches.keys(), keys, '版本不配套拒绝安装');
invalid = new URL(assets[0]).pathname;
// Change only the cache identity in this test to exercise invalid JS/CSS rejection with matching HTML.
const corrupt = instance(source.replace("const CACHE = CACHE_PREFIX + VERSION;", "const CACHE = CACHE_PREFIX + VERSION + '-bad';"));
await assert.rejects(lifecycle(corrupt, 'install'), /Invalid shell asset/);
assert.deepEqual(await caches.keys(), keys);
invalid = new URL(optional, 'https://usfirst.example/').pathname;
const lazyFailure = instance(source.replace("const CACHE = CACHE_PREFIX + VERSION;", "const CACHE = CACHE_PREFIX + VERSION + '-lazy-safe';"));
await lifecycle(lazyFailure, 'install');
assert.ok((await caches.keys()).some(key => key.endsWith('-lazy-safe')), '非必需弹窗失败不破坏启动外壳');
await caches.delete('usfirst-shell-' + version + '-lazy-safe');
invalid = '';
await caches.open('other-app-cache'); await caches.open('usfirst-shell-older'); await caches.open('usfirst-shell-previous');
await lifecycle(events, 'activate');
assert.ok((await caches.keys()).includes('other-app-cache'));
assert.ok(!(await caches.keys()).includes('usfirst-shell-older'));
const previous = await caches.open('usfirst-shell-previous');
await previous.put('https://usfirst.example/assets/old-build.js', new Response('old usable script'));
offline = true;
assert.equal(await (await request(events, '/assets/old-build.js')).text(), 'old usable script');
console.log(JSON.stringify({ ok: true, checks: 17, scope: 'real built SW; core-only install, optional lazy failure/runtime caching, no private data', networkCalls: 0 }));
