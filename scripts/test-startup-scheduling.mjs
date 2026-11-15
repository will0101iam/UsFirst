import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
const code = await readFile('public/boot.js', 'utf8');
const handlers = new Map(), timers = new Map(); let id = 0, calls = 0, installs = 0, resolveRead;
function add(name, fn) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); }
const startup = new Promise(resolve => { resolveRead = resolve; });
const context = vm.createContext({ AbortController, Response, Headers, Promise, Date, setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; }, clearTimeout: key => timers.delete(key), location: { protocol: 'https:', hostname: 'usfirst.example' }, fetch: (path, init) => { calls++; assert.equal(path, '/api/bootstrap'); assert.equal(init.cache, 'no-store'); return startup; }, document: { hidden: false, getElementById: () => null, addEventListener: add }, navigator: { onLine: true, serviceWorker: { register: async () => { installs++; return { update: async () => {} }; } } }, window: { addEventListener: add } });
vm.runInContext(code, context);
assert.equal(calls, 1); assert.equal(installs, 0, 'SW install must not compete with initial bootstrap');
const compiled = await build({ entryPoints: ['src/lib/api.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2023' });
const client = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const oldWindow = globalThis.window, oldFetch = globalThis.fetch;
globalThis.window = context.window;
globalThis.fetch = async () => { assert.fail('React must reuse prefetch, not send second startup request'); };
try {
  let completeBody;
  const streamed = new ReadableStream({ start(controller) { completeBody = () => { controller.enqueue(new TextEncoder().encode(JSON.stringify({ session: { user: null, pair: null }, requests: [], revision: 'test' }))); controller.close(); }; } });
  resolveRead(new Response(streamed, { headers: { 'content-encoding': 'br', 'content-length': '99999' } }));
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.ok([...timers.values()].some(value => value.ms === 25000), '响应头到了但body未完成仍受超时保护');
  completeBody();
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.ok(![...timers.values()].some(value => value.ms === 25000), '预取完成立即清除超时，不依赖主脚本何时到达');
  const bufferedResponse = await context.window.__usfirstStartup;
  assert.equal(bufferedResponse.headers.get('content-encoding'), null);
  assert.equal(bufferedResponse.headers.get('content-length'), null);
  assert.equal((await client.getBootstrap()).revision, 'test'); assert.equal(context.window.__usfirstStartup, undefined);
  for (const fn of handlers.get('usfirst:connected')) fn();
  assert.equal(installs, 0);
  const delayed = [...timers.values()].find(value => value.ms === 6000); assert.ok(delayed); delayed.fn();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(installs, 1);
  client.clearStartupPrefetch();
  console.log(JSON.stringify({ ok: true, checks: 9, startupCalls: calls, concurrentCacheInstall: false, networkCalls: 0 }));
} finally { globalThis.window = oldWindow; globalThis.fetch = oldFetch; }
