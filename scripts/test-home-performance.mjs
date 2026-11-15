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
let calls = 0; let resolveRefresh;
const initial = { session: { user: { username: 'test-a', displayName: '甲' }, pair: { partnerName: '乙' }, recognitionAvailable: false }, requests: [], revision: 'initial' };
globalThis.__homeAPI = {
  getBootstrap: async () => { calls++; if (calls === 1) return initial; return new Promise(resolve => { resolveRefresh = resolve; }); },
  createRequest: async () => {}, updateRequest: async () => {}, clearStartupPrefetch(){}, api: async () => {}, recognizePhotos: undefined,
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
  const initialTimer = [...timers.values()].find(value => value.ms === 0);
  await act(async () => listeners.get('pageshow')());
  await act(async () => initialTimer.fn());
  assert.equal(calls, 1, 'pageshow and initial mount must share one startup read');
  const requestButton = tree.root.findAllByType('button').find(b => b.props.className === 'new-request');
  await act(async () => requestButton.props.onClick());
  let done = false;
  await act(async () => { const form = tree.root.findByType('test-RequestForm'); form.props.onCreate({ title: '确认后的申请', amountCents: 2900, category: '网购', reason: '', photos: [] }).then(() => { done = true; }); });
  assert.equal(done, true, 'confirmed create must not wait for next refresh');
  assert.ok(globalThis.__toasts.includes('申请已提交')); assert.equal(calls, 2);
  assert.equal(tree.root.findByType('test-RequestCard').props.request.title, '确认后的申请');
  await act(async () => resolveRefresh({ ...initial, revision: 'updated', requests: [{ id: 'saved', title: '服务器申请', applicant: 'me', status: 'pending', amountCents: 2900, category: '网购', reason: '', photos: [], createdAt: new Date().toISOString() }] }));
  assert.equal(tree.root.findByType('test-RequestCard').props.request.title, '服务器申请');
  // Trigger a slow background read, then confirm a newer write before that old read returns.
  await act(async () => { const refresh = tree.root.findAllByType('test-RequestForm')[0].props.onCreate; await refresh({ title: '第二笔确认申请', amountCents: 3900, category: '网购', reason: '', photos: [] }); });
  const oldRead = resolveRefresh;
  await act(async () => { const refresh = tree.root.findAllByType('test-RequestForm')[0].props.onCreate; await refresh({ title: '最新确认申请', amountCents: 4900, category: '网购', reason: '', photos: [] }); });
  await act(async () => oldRead(initial));
  assert.ok(tree.root.findAllByType('test-RequestCard').some(card => card.props.request.title === '最新确认申请'), '旧后台响应不得覆盖确认后的最新状态');
  const queued = [...timers.values()].filter(value => value.ms === 0).at(-1);
  await act(async () => queued.fn());
  const beforeLogout = resolveRefresh;
  await act(async () => tree.root.findAllByType('button').find(b => b.props.className === 'identity-button').props.onClick());
  await act(async () => tree.root.findByType('test-SettingsSheet').props.onLogout());
  assert.equal(tree.root.findAllByType('test-RequestCard').length, 0);
  await act(async () => beforeLogout(initial));
  assert.equal(tree.root.findAllByType('test-AuthPanel').length, 1, '退出后旧请求不能恢复原账号');
  assert.equal(tree.root.findAllByType('test-RequestCard').length, 0);
  const newSession = { ...initial.session, user: { username: 'new-user', displayName: '新账号' } };
  await act(async () => tree.root.findByType('test-AuthPanel').props.onSession(newSession));
  await act(async () => resolveRefresh({ session: newSession, revision: 'new-account', requests: [{ id: 'partner-one', title: '对方申请', applicant: 'partner', status: 'pending', amountCents: 1900, category: '其他', reason: '', photos: [], createdAt: new Date().toISOString() }] }));
  await act(async () => tree.root.findAllByType('button').find(b => b.props.className === 'nav-item ').props.onClick());
  await act(async () => tree.root.findByType('test-FocusRequest').props.onApprove());
  assert.ok(globalThis.__toasts.includes('已同意购买'));
  assert.equal(tree.root.findAllByType('test-FocusRequest').length, 0, '确认审批后即刻移出待办，不等刷新');
  console.log(JSON.stringify({ ok: true, checks: 11, scope: 'real HomePage; controlled API result ordering, logout/account isolation, confirmed approval', networkCalls: 0 }));
} finally { if (tree) await act(async () => tree.unmount()); }
