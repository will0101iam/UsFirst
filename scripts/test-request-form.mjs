import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Keep real React and react-hook-form; only replace UI/media boundaries, never the form state.
const result = await build({ entryPoints: ['src/components/RequestForm.tsx'], bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2023', jsx: 'automatic', plugins: [{ name: 'test-boundaries', setup(b) {
  b.onResolve({ filter: /^(react|react\/jsx-runtime|react-hook-form|@hookform\/resolvers\/zod|zod|lucide-react)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
  b.onResolve({ filter: /^@\/components\/(AppSheet|ui\/button|ui\/image)$/ }, args => ({ path: args.path, namespace: 'test-ui' }));
  b.onLoad({ filter: /.*/, namespace: 'test-ui' }, args => ({ contents: args.path.endsWith('AppSheet') ? `export default function Sheet(p){ globalThis.__formSheet=p; return p.open ? p.children : null; }` : `export function Button(p){return p.children} export function Image(){return null}`, loader: 'js' }));
  b.onResolve({ filter: /^@\/lib\/oa-storage$/ }, () => ({ path: 'media', namespace: 'test-media' }));
  b.onLoad({ filter: /.*/, namespace: 'test-media' }, () => ({ contents: `export function preparePhoto(file){ return globalThis.__preparePhoto(file); }`, loader: 'js' }));
  b.onResolve({ filter: /^sonner$/ }, () => ({ path: 'toast', namespace: 'test-toast' }));
  b.onLoad({ filter: /.*/, namespace: 'test-toast' }, () => ({ contents: `export const toast={error:message=>globalThis.__formToasts.push(message)};`, loader: 'js' }));
} }] });
const RequestForm = (await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))).default;
let tree;
const created = [];
let open = true;
let recognize;
globalThis.__formToasts = [];
globalThis.__preparePhoto = async file => ({ name: file.name, dataUrl: 'data:image/jpeg;base64,/9j/test' });
const props = () => ({ open, person: 'me', partnerName: '伙伴', recognize, onClose: () => { open = false; tree.update(React.createElement(RequestForm, props())); }, onCreate: async input => { created.push(input); } });
const buttons = text => tree.root.findAllByType('button').find(b => b.children.some(x => x === text));
async function mount() { open = true; await act(async () => { tree = TestRenderer.create(React.createElement(RequestForm, props())); }); }
async function reopen() { open = true; await act(async () => tree.update(React.createElement(RequestForm, props()))); }
async function manual() { await act(async () => buttons('手动填写').props.onClick()); }
async function type(id, value) { const input = tree.root.findByProps({ id }); await act(async () => input.props.onChange({ target: { name: input.props.name, value }, type: 'change' })); }
async function close() { await act(async () => globalThis.__formSheet.onClose()); }
const failures = [];
async function check(name, fn) { try { await fn(); console.log('PASS ' + name); } catch (error) { failures.push(name); console.log('FAIL ' + name + ': ' + error.message); } finally { if (tree) await act(async () => tree.unmount()); tree = null; created.length = 0; } }
await check('关闭未提交手填申请后重新打开为空', async () => {
  await mount(); await manual(); await type('purchase-title', '不该保留的毛衣'); await type('purchase-amount', '29.00');
  await act(async () => buttons('补充一句理由').props.onClick()); await type('purchase-reason', '旧理由');
  await close(); await reopen();
  assert.equal(globalThis.__formSheet.title, '这次想买什么？', '再次打开必须回到全新入口');
  await manual();
  assert.ok(buttons('补充一句理由'), '理由展开状态必须清空');
  const form = tree.root.findByType('form'); await act(async () => form.props.onSubmit({ preventDefault(){}, persist(){} }));
  assert.equal(created.length, 0, '旧有效表单不得重新提交');
  assert.equal(tree.root.findByProps({ id: 'title-error' }).children.join(''), '写一下想买什么');
});
await check('父级关闭后清空照片和识别状态', async () => {
  recognize = async () => ({ title: '旧照片', amountCents: 2900, currency: 'CNY', category: '网购', amountSource: 'listed', amountEvidence: '¥29', warnings: [] });
  await mount(); const file = tree.root.findAllByType('input').find(i => i.props.type === 'file');
  await act(async () => file.props.onChange({ target: { files: [{ name: 'old.jpg' }] } }));
  assert.equal(globalThis.__formSheet.title, '确认这笔申请');
  open = false; await act(async () => tree.update(React.createElement(RequestForm, props()))); await reopen();
  assert.equal(globalThis.__formSheet.title, '这次想买什么？');
  await manual(); assert.equal(tree.root.findAllByProps({ className: 'photo-field' }).length, 0);
  assert.equal(tree.root.findAllByProps({ className: 'recognition-message' }).length, 0);
});
await check('返回图片选择不等于关闭，本次填写仍可提交', async () => {
  recognize = undefined; await mount(); await manual(); await type('purchase-title', '本次毛衣'); await type('purchase-amount', '29.00');
  await act(async () => buttons('返回图片选择').props.onClick()); await manual();
  await act(async () => tree.root.findByType('form').props.onSubmit({ preventDefault(){}, persist(){} }));
  assert.equal(created[0]?.title, '本次毛衣'); assert.equal(created[0]?.amountCents, 2900);
});
await check('关闭未完成照片处理后，不调用识别或回填', async () => {
  let completePhoto; let calls = 0;
  globalThis.__preparePhoto = () => new Promise(resolve => { completePhoto = resolve; });
  recognize = async () => { calls++; return {}; };
  await mount(); const file = tree.root.findAllByType('input').find(i => i.props.type === 'file');
  await act(async () => file.props.onChange({ target: { files: [{ name: 'pending.jpg' }] } }));
  open = false; await act(async () => tree.update(React.createElement(RequestForm, props()))); await reopen();
  await act(async () => completePhoto({ name: 'pending.jpg', dataUrl: 'data:image/jpeg;base64,/9j/test' }));
  assert.equal(calls, 0); assert.equal(globalThis.__formSheet.title, '这次想买什么？');
  globalThis.__preparePhoto = async file => ({ name: file.name, dataUrl: 'data:image/jpeg;base64,/9j/test' });
});
await check('关闭识别中的申请，旧识别结果不污染新表单', async () => {
  let completeRecognition; let signal;
  recognize = (_, currentSignal) => { signal = currentSignal; return new Promise(resolve => { completeRecognition = resolve; }); };
  await mount(); const file = tree.root.findAllByType('input').find(i => i.props.type === 'file');
  await act(async () => file.props.onChange({ target: { files: [{ name: 'pending-recognition.jpg' }] } }));
  assert.equal(globalThis.__formSheet.busy, true);
  open = false; await act(async () => tree.update(React.createElement(RequestForm, props()))); await reopen();
  assert.equal(signal.aborted, true);
  await act(async () => completeRecognition({ title: '迟到的旧识别', amountCents: 2900, currency: 'CNY', category: '网购', amountSource: 'listed', amountEvidence: '¥29', warnings: [] }));
  assert.equal(globalThis.__formSheet.title, '这次想买什么？'); await manual();
  await act(async () => tree.root.findByType('form').props.onSubmit({ preventDefault(){}, persist(){} }));
  assert.equal(created.length, 0); assert.ok(tree.root.findByProps({ id: 'title-error' }));
});
console.log(JSON.stringify({ checks: 5, failures, productionRequests: 0, scope: 'real RequestForm and react-hook-form; UI/media adapters isolated' }));
if (failures.length) process.exitCode = 1;
