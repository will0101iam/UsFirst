// CLI-only tester. Never imported by browser code. No server, keys or images are persisted.
// Usage: OPENROUTER_API_KEY in process environment, or --key-stdin; 1–3 image paths.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function loadTs(relative) {
  const source = await fs.readFile(path.join(root, relative), 'utf8');
  const code = ts.transpileModule(source.replace("from 'zod'", `from '${pathToFileURL(path.join(root, 'node_modules/zod/index.js')).href}'`), {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const { recognitionConfig: config, recognitionPrompt: prompt } = await loadTs('src/lib/recognition-config.ts');
const { parseRecognitionResult: validate } = await loadTs('src/lib/image-recognition-contract.ts');
const fallback = () => ({ title: null, amountCents: null, currency: 'CNY', category: null, amountSource: 'unknown', amountEvidence: null, warnings: ['识别未完成，请手动填写。'] });

if (process.argv.includes('--self-test')) {
  const good = { title: '毛衣', amountCents: 26900, currency: 'CNY', category: '网购', amountSource: 'payable', amountEvidence: '应付 ¥269.00', warnings: [] };
  const tests = [
    ['有效应付金额', good, 26900],
    ['未知来源不填金额', { ...good, amountSource: 'unknown' }, null],
    ['缺少证据不填金额', { ...good, amountEvidence: null }, null],
    ['数字与证据不匹配', { ...good, amountEvidence: '应付 ¥26.90' }, null],
    ['非人民币不填金额', { ...good, currency: 'USD' }, null],
    ['零金额不填', { ...good, amountCents: 0 }, null],
    ['浮点分不填', { ...good, amountCents: 269.1 }, null],
    ['超过输入上限不填', { ...good, amountCents: 100000000 }, null],
    ['空对象兜底', {}, null],
    ['字符串金额不自动转换', { ...good, amountCents: '26900' }, null],
  ];
  for (const [name, input, expected] of tests) {
    if (validate(input).amountCents !== expected) throw new Error(`FAILED: ${name}`);
  }
  const listed = validate({ ...good, amountSource: 'listed' });
  if (!listed.warnings.some(w => w.includes('运费'))) throw new Error('FAILED: 商品现价提醒');
  let rejected = false;
  try { validate([]); } catch { rejected = true; }
  if (!rejected) throw new Error('FAILED: 非对象拒绝');
  console.log(JSON.stringify({ ok: true, localChecksPassed: tests.length + 2, networkCalls: 0 }, null, 2));
  process.exit(0);
}

async function main() {
  const args = process.argv.slice(2);
  let key = process.env.OPENROUTER_API_KEY || '';
  if (args.includes('--key-stdin')) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    key = Buffer.concat(chunks).toString('utf8').trim();
  }
  const images = args.filter(a => a !== '--key-stdin');
  if (!key) return { ok: false, code: 'KEY_MISSING', result: fallback() };
  if (images.length < 1 || images.length > 3) return { ok: false, code: 'SELECT_1_TO_3_IMAGES', result: fallback() };
  const content = [{ type: 'text', text: '从这些图片提取消费申请字段。' }];
  for (const image of images) {
    const bytes = await fs.readFile(image);
    if (bytes.length > 15 * 1024 * 1024) throw new Error('IMAGE_TOO_LARGE');
    let mime;
    if (bytes[0] === 0xff && bytes[1] === 0xd8) mime = 'image/jpeg';
    else if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mime = 'image/png';
    else if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') mime = 'image/webp';
    else throw new Error('IMAGE_TYPE_UNSUPPORTED');
    content.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${bytes.toString('base64')}` } });
  }
  const started = Date.now();
  const response = await fetch(config.endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(config.timeoutMs),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model, messages: [{ role: 'system', content: prompt }, { role: 'user', content }],
      response_format: { type: 'json_object' }, reasoning: { enabled: false },
      temperature: config.temperature, max_tokens: config.maxTokens, stream: false,
      provider: { require_parameters: true, data_collection: 'deny' },
    }),
  });
  key = '';
  if (!response.ok) {
    // Never echo headers, provider response text, secrets or image payloads.
    const codes = { 401: 'KEY_INVALID', 402: 'CREDIT_INSUFFICIENT', 403: 'ACCESS_DENIED', 404: 'MODEL_OR_ROUTE_UNAVAILABLE', 429: 'RATE_LIMITED' };
    return { ok: false, httpStatus: response.status, code: codes[response.status] || 'UPSTREAM_FAILURE', elapsedMs: Date.now() - started, result: fallback() };
  }
  const payload = await response.json();
  const choice = payload.choices?.[0];
  if (payload.error || choice?.error || choice?.finish_reason !== 'stop' || typeof choice?.message?.content !== 'string') {
    return { ok: false, code: 'INCOMPLETE_MODEL_RESULT', result: fallback() };
  }
  let raw;
  try { raw = JSON.parse(choice.message.content); } catch { return { ok: false, code: 'INVALID_JSON', result: fallback() }; }
  let result;
  try { result = validate(raw); } catch { return { ok: false, code: 'INVALID_RESULT', result: fallback() }; }
  const usage = payload.usage || {};
  return {
    ok: true, requestedModel: config.model, returnedModel: payload.model,
    elapsedMs: Date.now() - started, result,
    usage: { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, reasoningTokens: usage.completion_tokens_details?.reasoning_tokens, costUsd: usage.cost },
    note: '字段仍需用户核对；数值证据校验不保证 OCR 的真实性。',
  };
}
try {
  const report = await main();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} catch (error) {
  const known = ['IMAGE_TOO_LARGE', 'IMAGE_TYPE_UNSUPPORTED'];
  const code = error?.name === 'TimeoutError' ? 'TIMEOUT' : known.includes(error?.message) ? error.message : 'NETWORK_OR_FILE_ERROR';
  console.log(JSON.stringify({ ok: false, code, result: fallback() }, null, 2));
  process.exitCode = 1;
}
