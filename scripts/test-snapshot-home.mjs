import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const timers = new Map(); let timerId = 0;
const events = []; const listeners = new Map();
globalThis.window = { setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; }, setInterval: () => 1, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener(){}, dispatchEvent: event => events.push(event.type) };
globalThis.document = { hidden: false, addEventListener(){}, removeEventListener(){} };
globalThis.__toasts = [];
const stored = new Map(); const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)), removeItem: key => stored.delete(key) };
window.localStorage = storage;
let calls = 0; let resolveRefresh; let rejectRefresh; let writes = 0;
const initial = { session: { user: { username: 'test_a', displayName: '甲' }, pair: { partnerName: '乙' }, recognitionAvailable: false }, requests: [{ id: '3c69428f-fb7e-4df2-a31c-f7516df234c3', title: '上次的申请', applicant: 'partner', status: 'pending', amountCents: 2900, category: '网购', reason: '', photos: [], createdAt: new Date().toISOString() }], revision: 'initial' };
storage.setItem('usfirst:snapshot:v1', JSON.stringify({ version: 1, account: 'test_a', savedAt: Date.now(), session: initial.session, requests: initial.requests }));
globalThis.__homeAPI = {
  getBootstrap: () => { calls++; return new Promise((resolve, reject) => { resolveRefresh = resolve; rejectRefresh = reject; }); },
  createRequest: async () => { writes++; }, updateRequest: async () => { writes++; }, clearStartupPrefetch(){}, api: async () => {}, recognizePhotos: undefined,
};
const built = await build({ entryPoints: ['src/pages/HomePage/HomePage.tsx'], bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic', target: 'es2023', plugins: [{ name: 'home-boundaries', setup(b) {
  b.onResolve({ filter: /^(react|react\/jsx-runtime|lucide-react)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
  b.onResolve({ filter: /^@\/lib\/api$/ }, () => ({ path: 'api', namespace: 'fake-api' }));
  b.onLoad({ filter: /.*/, namespace: 'fake-api' }, () => ({ contents: `export const getBootstrap=(...a)=>globalThis.__homeAPI.getBootstrap(...a); export const createRequest=(...a)=>globalThis.__homeAPI.createRequest(...a); export const updateRequest=(...a)=>globalThis.__homeAPI.updateRequest(...a); export const clearStartupPrefetch=(...a)=>globalThis.__homeAPI.clearStartupPrefetch(...a); export const api=(...a)=>globalThis.__homeAPI.api(...a); export const recognizePhotos=undefined; export class ApiError extends Error {}`, loader: 'js' }));
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
  assert.equal(tree.root.findByType('test-FocusRequest').props.request.title, '上次的申请', '未等网络就显示已有快照');
  assert.equal(tree.root.findByType('test-FocusRequest').props.readOnly, false, '有本地快照就能直接操作，不再等首次鉴权');
  assert.equal(tree.root.findAllByType('button').find(b => b.props.className === 'new-request').props.disabled, false);
  const initialTimer = [...timers.values()].find(value => value.ms === 0);
  await act(async () => initialTimer.fn());
  assert.equal(calls, 1);
  await act(async () => rejectRefresh(new Error('network slow')));
  assert.equal(tree.root.findByType('test-FocusRequest').props.readOnly, false, '网络慢也不退回只读');
  assert.equal(tree.root.findByType('test-FocusRequest').props.request.title, '上次的申请');
  await act(async () => tree.root.findAllByType('button').find(b => b.props.className === 'snapshot-status').props.onClick());
  await act(async () => resolveRefresh(initial));
  assert.equal(tree.root.findByType('test-FocusRequest').props.readOnly, false);
  await act(async () => listeners.get('offline')());
  await act(async () => tree.root.findByType('test-FocusRequest').props.onApprove());
  assert.equal(writes, 0, '网络断开后立即只读');
  await act(async () => listeners.get('online')());
  await act(async () => resolveRefresh({ ...initial, session: { user: null, pair: null, recognitionAvailable: false }, requests: [] }));
  assert.equal(tree.root.findAllByType('test-FocusRequest').length, 0);
  assert.equal(storage.getItem('usfirst:snapshot:v1'), null, '服务器确认失效后删除快照');
  const newSession = { ...initial.session, user: { username: 'test_b', displayName: '新账号' } };
  await act(async () => tree.root.findByType('test-AuthPanel').props.onSession(newSession));
  assert.equal(tree.root.findAllByType('test-FocusRequest').length,0, '切换账号不沿用前账号列表');
  await act(async () => resolveRefresh({ session: newSession, requests: initial.requests, revision: 'new' }));
  const oldApprove=tree.root.findByType('test-FocusRequest').props.onApprove;
  storage.setItem('usfirst:snapshot-generation:v1','logout:other-tab'); storage.removeItem('usfirst:snapshot:v1');
  await act(async () => oldApprove()); assert.equal(writes,0, '跨页退出事件未到前也不能写');
  await act(async () => listeners.get('storage')({ key:'usfirst:snapshot-generation:v1',newValue:'logout:other-tab' }));
  assert.equal(tree.root.findAllByType('test-FocusRequest').length,0);
  await act(async () => tree.unmount());
  await act(async () => { tree=TestRenderer.create(React.createElement(Home)); });
  assert.equal(tree.root.findAllByType('test-AuthPanel').length,1, '退出后重新打开不能自动恢复原账号');
  console.log(JSON.stringify({ ok: true, checks: 14, scope: 'real HomePage; snapshot before pending network, offline/write guards, revoked and cross-tab session isolation', productionRequests: 0 }));
} finally { if (tree) await act(async () => tree.unmount()); }
