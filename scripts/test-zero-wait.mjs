import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const timers = new Map(); let timerId = 0;
const listeners = new Map();
globalThis.window = { setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout: id => timers.delete(id), setInterval: () => 1, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener(){}, dispatchEvent(){}, requestIdleCallback: fn => { fn({ didTimeout: false, timeRemaining: () => 0 }); return 1; }, cancelIdleCallback(){} };
globalThis.document = { hidden: false, addEventListener(){}, removeEventListener(){} };
globalThis.__toasts = [];
const stored = new Map(); const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)), removeItem: key => stored.delete(key) };
window.localStorage = storage;
let calls = 0, resolveRefresh, rejectRefresh, writes = 0, pendingWrite;
const session = { user: { username: 'test_a', displayName: '甲' }, pair: { partnerName: '乙' }, recognitionAvailable: false };
const partner = { id: '3c69428f-fb7e-4df2-a31c-f7516df234c3', title: '对方的申请', applicant: 'partner', status: 'pending', amountCents: 2900, category: '网购', reason: '', photos: [], createdAt: new Date().toISOString() };
const initial = { session, requests: [partner], revision: 'initial' };
storage.setItem('usfirst:snapshot:v1', JSON.stringify({ version: 1, account: 'test_a', savedAt: Date.now(), session, requests: [partner] }));
globalThis.__homeAPI = {
  getBootstrap: () => { calls++; return new Promise((resolve, reject) => { resolveRefresh = resolve; rejectRefresh = reject; }); },
  createRequest: async (input, id) => { writes++; const result = { ok: true, request: { ...input, id, applicant: 'me', status: 'pending', createdAt: new Date().toISOString() } }; return new Promise(resolve => { pendingWrite = { resolve: () => resolve(result), reject: e => reject(e) }; }); },
  updateRequest: async (id, status, note) => { writes++; return new Promise((resolve, reject) => { pendingWrite = { resolve: () => resolve({ ok: true, request: { ...partner, status, decidedAt: new Date().toISOString(), decisionNote: note } }), reject }; }); },
  clearStartupPrefetch(){}, api: async () => {}, recognizePhotos: undefined,
};
const built = await build({ entryPoints: ['src/pages/HomePage/HomePage.tsx'], bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic', target: 'es2023', plugins: [{ name: 'home-boundaries', setup(b) {
  b.onResolve({ filter: /^(react|react\/jsx-runtime|lucide-react)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
  b.onResolve({ filter: /^@\/lib\/api$/ }, () => ({ path: 'api', namespace: 'fake-api' }));
  b.onLoad({ filter: /.*/, namespace: 'fake-api' }, () => ({ contents: `export const getBootstrap=(...a)=>globalThis.__homeAPI.getBootstrap(...a); export const createRequest=(...a)=>globalThis.__homeAPI.createRequest(...a); export const updateRequest=(...a)=>globalThis.__homeAPI.updateRequest(...a); export const clearStartupPrefetch=(...a)=>globalThis.__homeAPI.clearStartupPrefetch(...a); export const api=(...a)=>globalThis.__homeAPI.api(...a); export const recognizePhotos=undefined; export class ApiError extends Error { constructor(message,status){super(message);this.status=status} } globalThis.__ApiError=ApiError;`, loader: 'js' }));
  b.onResolve({ filter: /^@\/components\// }, args => ({ path: args.path.split('/').at(-1), namespace: 'fake-ui' }));
  b.onLoad({ filter: /.*/, namespace: 'fake-ui' }, args => ({ contents: `import React from 'react'; export default function Component(p){return React.createElement('test-${args.path}',p,p.children);}`, loader: 'js' }));
  b.onResolve({ filter: /^sonner$/ }, () => ({ path: 'sonner', namespace: 'fake-toast' }));
  b.onLoad({ filter: /.*/, namespace: 'fake-toast' }, () => ({ contents: `export function Toaster(){return null} export const toast={success:m=>globalThis.__toasts.push(m),error:m=>globalThis.__toasts.push(m)};`, loader: 'js' }));
  b.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'text' }));
} }] });
const Home = (await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'))).default;
let tree;
try {
  await act(async () => { tree = TestRenderer.create(React.createElement(Home)); });
  await act(async () => [...timers.values()].find(value => value.ms === 0).fn());
  await act(async () => resolveRefresh(initial));
  assert.equal(tree.root.findByType('test-FocusRequest').props.readOnly, false, 'verified home is writable');

  // 1. Approve is applied before the request leaves the device.
  const focus = tree.root.findByType('test-FocusRequest');
  await act(async () => focus.props.onApprove());
  assert.equal(writes, 1, 'approve sends one write');
  assert.equal(tree.root.findAllByType('test-FocusRequest').length, 0, 'approved row leaves the pending focus without waiting for the network');
  await act(async () => tree.root.findAllByType('button').find(b => String(b.props.className).includes('history-toggle')).props.onClick());
  const pendingRow = tree.root.findAllByType('test-RequestCard').map(card => card.props.request).find(row => row.id === partner.id);
  assert.equal(pendingRow?.status, 'approved');
  assert.equal(pendingRow?.pendingSync, 'sending');

  // 2. A poll that returns the old pending row must not undo the local decision.
  await act(async () => listeners.get('focus')());
  const refreshNow = resolveRefresh;
  await act(async () => refreshNow({ ...initial, mode: 'delta', revision: 'delta-1', requests: [partner], removed: [] }));
  const afterPoll = tree.root.findAllByType('test-RequestCard').map(card => card.props.request).find(row => row.id === partner.id);
  assert.equal(afterPoll?.status, 'approved', 'stale poll cannot overwrite an unconfirmed action');
  assert.equal(afterPoll?.pendingSync, 'sending');

  // 3. A failed write reverts the row and explains what happened.
  await act(async () => { pendingWrite.reject(new globalThis.__ApiError('状态已变化', 409)); await Promise.resolve(); await Promise.resolve(); });
  const reverted = tree.root.findAllByType('test-RequestCard').map(card => card.props.request).find(row => row.id === partner.id);
  assert.equal(reverted?.status, 'pending', 'failed write restores the previous state');
  assert.equal(reverted?.pendingSync, undefined);
  assert.ok(globalThis.__toasts.includes('状态已变化'));

  // 4. Submit returns at once and the new row is visible before delivery.
  await act(async () => tree.root.findAllByType('button').find(b => b.props.className === 'nav-item ').props.onClick());
  await act(async () => tree.root.findAllByType('button').find(b => b.props.className === 'new-request').props.onClick());
  let resolved = false;
  await act(async () => { const form = tree.root.findByType('test-RequestForm'); await form.props.onCreate({ title: '立刻出现的申请', amountCents: 4900, category: '网购', reason: '', photos: [] }); resolved = true; });
  assert.equal(resolved, true, 'create resolves without waiting for the network');
  assert.ok(tree.root.findAllByType('test-RequestCard').some(card => card.props.request.title === '立刻出现的申请'), 'the new request is on screen immediately');
  const created = tree.root.findAllByType('test-RequestCard').map(card => card.props.request).find(row => row.title === '立刻出现的申请');
  assert.equal(created?.pendingSync, 'sending');

  // 5. Confirmation clears the sending marker without a second home read.
  const callsBefore = calls;
  await act(async () => { pendingWrite.resolve(); await Promise.resolve(); });
  const settled = tree.root.findAllByType('test-RequestCard').map(card => card.props.request).find(row => row.title === '立刻出现的申请');
  assert.equal(settled?.pendingSync, undefined, 'server confirmation settles the row');
  assert.equal(calls, callsBefore, 'confirmation does not add another bootstrap');
  console.log(JSON.stringify({ ok: true, checks: 11, scope: 'real HomePage; optimistic approve/create, stale poll protection, rollback on failure, no refresh on confirm', productionRequests: 0 }));
} finally { if (tree) await act(async () => tree.unmount()); }
