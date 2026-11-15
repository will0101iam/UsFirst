import assert from 'node:assert/strict';
import { build } from 'esbuild';
const compiled = await build({ entryPoints: ['src/lib/api.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2023' });
const client = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const original = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
const timers = new Map(); let timerId = 0; let calls = 0;
globalThis.setTimeout = (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId; };
globalThis.clearTimeout = id => timers.delete(id);
async function ticks() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
const failures = [];
async function check(name, fn) { try { await fn(); console.log('PASS ' + name); } catch (error) { failures.push(name); console.log('FAIL ' + name + ': ' + error.message); } finally { timers.clear(); } }
try {
  await check('会话网络停滞有明确超时，不永久等待', async () => {
    globalThis.fetch = () => { calls++; return new Promise(() => {}); };
    const result = client.getSession().then(value => ({ value }), error => ({ error }));
    await ticks(); assert.equal(timers.size, 1, '必须给会话请求设置等待上限');
    assert.ok([...timers.values()][0].ms <= 30000); [...timers.values()][0].callback();
    const { error } = await result; assert.equal(error?.code, 'connection_timeout');
  });
  await check('已到响应头但 JSON 卡住也会超时', async () => {
    globalThis.fetch = async () => ({ ok: true, json: () => new Promise(() => {}) });
    const result = client.getSession().catch(error => error); await ticks();
    assert.equal(timers.size, 1); [...timers.values()][0].callback(); assert.equal((await result).code, 'connection_timeout');
  });
  await check('用户取消保留 AbortError，取消后清理定时器', async () => {
    globalThis.fetch = () => new Promise(() => {}); const abort = new AbortController();
    const result = client.api('/recognize', {}, abort.signal).catch(error => error); await ticks(); assert.equal(timers.size, 1); abort.abort();
    await ticks(); assert.equal((await result).name, 'AbortError'); assert.equal(timers.size, 0);
  });
  await check('提交超时不自动重试', async () => {
    let writes = 0; globalThis.fetch = () => { writes++; return new Promise(() => {}); };
    const result = client.api('/requests', {}).catch(error => error); await ticks();
    assert.equal(timers.size, 1); [...timers.values()][0].callback();
    assert.equal((await result).code, 'connection_timeout'); assert.equal(writes, 1);
  });
  await check('正常响应不变，非JSON成功明确失败', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ user: null, pair: null }));
    assert.equal((await client.getSession()).user, null); assert.equal(timers.size, 0);
    globalThis.fetch = async () => new Response('<html>wrong</html>');
    await assert.rejects(client.getSession(), error => error.code === 'invalid_response');
  });
  await check('预取超时显示中文连接错误且不重复请求', async () => {
    let fetches = 0; globalThis.fetch = () => { fetches++; return new Promise(() => {}); };
    globalThis.window = { __usfirstStartup: Promise.reject(new DOMException('Aborted', 'AbortError')) };
    const error = await client.getBootstrap().catch(error => error);
    assert.equal(error.code, 'connection_timeout'); assert.equal(error.message, '连接超时，请重试。');
    assert.equal(fetches, 0); assert.equal(window.__usfirstStartup, undefined);
    delete globalThis.window;
  });
  console.log(JSON.stringify({ checks: 6, failures, networkCalls: 0 }));
  if (failures.length) process.exitCode = 1;
} finally { Object.assign(globalThis, original); }
