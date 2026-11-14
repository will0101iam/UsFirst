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
const base = { title: '毛衣', amountCents: 4900, currency: 'CNY', category: '网购', amountSource: 'payable', amountEvidence: '应付 ¥49', warnings: [] };
const candidate = (amountCents, kind, amountEvidence, currency = 'CNY') => ({ amountCents, kind, amountEvidence, currency });
const db = { prepare(sql) { return { bind() { return this; }, async run() { return { meta: { changes: 1 } }; }, async first() {
  if (sql.includes('JOIN sessions')) return { id: 'test-a', username: 'test', display_name: '测试' };
  if (sql.includes('JOIN members other')) return { id: 'test-pair', partner_id: 'test-b', partner_name: '测试' };
  if (sql.includes('SELECT count FROM rate_limits')) return { count: 1 };
  return null;
} }; } };
const originalFetch = globalThis.fetch;
let modelResult = base;
let providerCalls = 0;
let writes = 0;
const failures = [];
globalThis.fetch = async (url, init) => {
  if (typeof url === 'string' && url.startsWith('/api/')) {
    if (url !== '/api/recognize') writes++;
    const headers = new Headers(init.headers);
    headers.set('Origin', 'https://usfirst.example');
    headers.set('Cookie', 'usfirst_session=' + 'a'.repeat(64));
    return worker.fetch(new Request('https://usfirst.example' + url, { ...init, headers }), { DB: db, OPENROUTER_API_KEY: 'test-only-not-a-real-key' });
  }
  providerCalls++;
  const sent = JSON.parse(init.body);
  if (!sent.messages[0].content.includes('最低') || !sent.messages[0].content.includes('priceCandidates')) {
    if (!failures.includes('运行时最低价候选 prompt')) failures.push('运行时最低价候选 prompt');
  }
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(modelResult) } }] }), { headers: { 'Content-Type': 'application/json' } });
};
const cases = [
  ['规格最低而非应付优先', [candidate(4900, 'payable', '应付 ¥49'), candidate(2900, 'listed', '规格A ¥29'), candidate(3900, 'listed', '规格B ¥39')], 2900],
  ['价格区间下限', [candidate(3880, 'range', '¥38.80～¥58.80')], 3880],
  ['起价', [candidate(2900, 'starting', '¥29起')], 2900],
  ['明确券后价', [candidate(3900, 'listed', '现价 ¥39'), candidate(1900, 'discounted', '券后 ¥19')], 1900],
  ['不取优惠券、每期和划线原价', [candidate(500, 'coupon', '优惠券 ¥5'), candidate(300, 'installment', '每期 ¥3'), candidate(1000, 'original', '原价 ¥10'), candidate(2900, 'listed', '现价 ¥29')], 2900],
  ['错误标注优惠券也不取', [candidate(500, 'listed', '优惠券 ¥5'), candidate(2900, 'listed', '现价 ¥29')], 2900],
  ['非人民币候选不取', [candidate(500, 'listed', '$5', 'USD'), candidate(2900, 'listed', '¥29')], 2900],
  ['数字证据不符不取', [candidate(900, 'listed', '¥99'), candidate(2900, 'listed', '¥29')], 2900],
  ['区间上限错误不能通过', [candidate(5880, 'range', '¥38.80～¥58.80')], null],
  ['全部无效不退回旧应付金额', [candidate(500, 'coupon', '优惠券 ¥5')], null],
  ['无价保持空', [], null],
  ['多图候选取最低不累加', [candidate(2900, 'listed', '¥29'), candidate(2900, 'listed', '¥29'), candidate(3900, 'listed', '¥39')], 2900],
];
try {
  for (const [name, prices, expected] of cases) {
    modelResult = { ...base, priceCandidates: prices };
    try {
      const result = await client.recognizePhotos(photos, new AbortController().signal);
      assert.equal(result.amountCents, expected);
      if (expected !== null) assert.ok(result.amountEvidence);
      console.log('PASS ' + name);
    } catch (error) { failures.push(name); console.log('FAIL ' + name + ': ' + error.message); }
  }
  assert.equal(writes, 0, '识别不得提交申请');
  console.log(JSON.stringify({ checks: cases.length, failures, providerCalls, networkCalls: 0, scope: 'client through real Worker; isolated DB and provider results' }));
  if (failures.length) process.exitCode = 1;
} finally { globalThis.fetch = originalFetch; }
