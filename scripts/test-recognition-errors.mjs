import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2023' });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const worker = (await load('worker/index.ts')).default;
const client = await load('src/lib/api.ts');
const fixture = await readFile(new URL('./fixtures/test-photo.jpg', import.meta.url));
const photos = [{ name: 'fixture.jpg', dataUrl: 'data:image/jpeg;base64,' + fixture.toString('base64') }];
const fakeKey = 'test-only-never-a-real-key';
let providerCalls = 0;
const db = { prepare(sql) { return { bind() { return this; }, async run() { return { meta: { changes: 1 } }; }, async first() {
  if (sql.includes('JOIN sessions')) return { id: 'test-a', username: 'test', display_name: '测试' };
  if (sql.includes('JOIN members other')) return { id: 'test-pair', partner_id: 'test-b', partner_name: '测试' };
  if (sql.includes('SELECT count FROM rate_limits')) return { count: 1 };
  return null;
} }; } };
const env = { DB: db, OPENROUTER_API_KEY: fakeKey };
const originalFetch = globalThis.fetch;
let providerStatus = 402;
let providerBody = { error: { message: 'private upstream detail ' + fakeKey } };
let providerException = null;
globalThis.fetch = async (url, init) => {
  if (typeof url === 'string' && url.startsWith('/api/')) {
    const headers = new Headers(init.headers);
    headers.set('Origin', 'https://usfirst.example');
    headers.set('Cookie', 'usfirst_session=' + 'a'.repeat(64));
    return worker.fetch(new Request('https://usfirst.example' + url, { ...init, headers }), env);
  }
  providerCalls++;
  if (providerException) throw providerException;
  return new Response(JSON.stringify(providerBody), { status: providerStatus, headers: { 'Content-Type': 'application/json' } });
};
const cases = [
  [402, 'recognition_balance', '余额不足'],
  [401, 'recognition_credentials', '密钥'],
  [429, 'recognition_rate_limited', '频繁'],
  [503, 'recognition_upstream_unavailable', '暂不可用'],
];
let checks = 0;
try {
  for (const [status, code, fragment] of cases) {
    providerStatus = status; providerException = null;
    try { await client.recognizePhotos(photos, new AbortController().signal); assert.fail('must reject'); }
    catch (error) { assert.equal(error.code, code); assert.ok(error.message.includes(fragment)); assert.ok(!error.message.includes(fakeKey)); checks++; }
  }
  providerStatus = 200; providerBody = { choices: [{ message: { content: 'not JSON' } }] };
  await assert.rejects(client.recognizePhotos(photos, new AbortController().signal), error => error.code === 'recognition_invalid_result'); checks++;
  providerException = new TypeError('fetch failed ' + fakeKey);
  await assert.rejects(client.recognizePhotos(photos, new AbortController().signal), error => error.code === 'recognition_network'); checks++;
  providerException = new DOMException('timeout', 'TimeoutError');
  await assert.rejects(client.recognizePhotos(photos, new AbortController().signal), error => error.code === 'recognition_timeout'); checks++;
  providerException = null; providerStatus = 200; providerBody = { choices: [{ message: { content: JSON.stringify({ title: '毛衣', amountCents: null, category: null, currency: 'CNY', amountSource: 'unknown', amountEvidence: null, warnings: [] }) } }] };
  const result = await client.recognizePhotos(photos, new AbortController().signal); assert.equal(result.title, '毛衣'); assert.equal(result.amountCents, null); checks++;
  env.OPENROUTER_API_KEY = undefined; const callsBefore = providerCalls;
  await assert.rejects(client.recognizePhotos(photos, new AbortController().signal), error => error.code === 'recognition_not_configured'); assert.equal(providerCalls, callsBefore); checks++;
  console.log(JSON.stringify({ ok: true, checks, networkCalls: 0, scope: 'client API through real Worker entry, isolated DB and provider responses', productionRequests: 0 }));
} finally { globalThis.fetch = originalFetch; }
