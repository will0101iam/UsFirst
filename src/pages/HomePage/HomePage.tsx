import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Inbox, FileText, Check, ChevronDown, RefreshCw, LoaderCircle } from 'lucide-react';
import { Toaster, toast } from 'sonner';
const RequestForm = lazy(() => import('@/components/RequestForm'));
const RequestDetail = lazy(() => import('@/components/RequestDetail'));
import RequestCard from '@/components/RequestCard';
import FocusRequest from '@/components/FocusRequest';
import AuthPanel from '@/components/AuthPanel';
import PairPanel from '@/components/PairPanel';
const SettingsSheet = lazy(() => import('@/components/SettingsSheet'));
const RejectSheet = lazy(() => import('@/components/RejectSheet'));
const PhotoViewer = lazy(() => import('@/components/PhotoViewer'));
import { api, ApiError, getBootstrap, clearStartupPrefetch, createRequest as sendRequest, updateRequest as sendUpdate, recognizePhotos } from '@/lib/api';
import { mergeRequests } from '@/lib/request-sync';
import { readHomeSnapshot, saveHomeSnapshot, clearHomeSnapshot, snapshotGeneration, snapshotGenerationKey } from '@/lib/home-snapshot';
import type { SessionState, RequestPage } from '@/lib/api';
import type { IRequest, IRequestInput, Status } from '@/lib/oa-types';
import './home.css';
import './c3.css';
import './production.css';
type View = 'inbox' | 'mine';
type Filter = 'all' | 'pending' | 'approved' | 'closed';
const filters: { id: Filter; label: string }[] = [{ id: 'pending', label: '待审批' }, { id: 'approved', label: '可购买' }, { id: 'closed', label: '已结束' }, { id: 'all', label: '全部' }];
export default function HomePage() {
  const [startup] = useState(readHomeSnapshot);
  const [session, setSession] = useState<SessionState | null>(startup?.session || null); const [loading, setLoading] = useState(!startup && !snapshotGeneration().startsWith('logout:')); const [connectionError, setConnectionError] = useState('');
  const [verified, setVerified] = useState(false); const verifiedRef = useRef(false); const verifiedGeneration = useRef(''); const [savedAt, setSavedAt] = useState(startup?.savedAt || 0); const requestState = useRef<IRequest[]>(startup?.requests || []);
  const [requests, setRequests] = useState<IRequest[]>(startup?.requests || []); const [view, setView] = useState<View>('inbox'); const [filter, setFilter] = useState<Filter>('pending');
  const [formOpen, setFormOpen] = useState(false); const [settingsOpen, setSettingsOpen] = useState(false); const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null); const [photo, setPhoto] = useState<{ photos: IRequest['photos']; index: number } | null>(null);
  const [busy, setBusy] = useState(false); const refreshRunning = useRef(false); const sessionEpoch = useRef(0); const actionRunning = useRef(false); const draftId = useRef(crypto.randomUUID());
  const revision = useRef(''); const suppressRefresh = useRef(snapshotGeneration().startsWith('logout:')); const refreshPending = useRef(false); const lastRefresh = useRef(0);
  const [historyPages, setHistoryPages] = useState<Record<string, { cursor: string | null }>>({});
  const historyRunning = useRef(false); const [historyBusy, setHistoryBusy] = useState(false); const [historyError, setHistoryError] = useState('');
  const publishRequests = useCallback((next: IRequest[]) => { requestState.current = next; setRequests(next); }, []);
  const refresh = useCallback(async function refreshNow(silent = false) {
    if (suppressRefresh.current || document.hidden) return;
    if (historyRunning.current) { refreshPending.current = true; return; }
    if (refreshRunning.current) { if (!silent) refreshPending.current = true; return; }
    if (silent && Date.now() - lastRefresh.current < 4000) return;
    refreshRunning.current = true; const epoch = sessionEpoch.current; const generation = snapshotGeneration();
    try {
      const next = await getBootstrap(revision.current);
      if (epoch !== sessionEpoch.current || generation !== snapshotGeneration()) return;
      revision.current = next.revision;
      setSession(next.session);
      if (next.requests !== null) {
        const rows = next.mode === 'delta' ? mergeRequests(requestState.current,next.requests,next.removed) : mergeRequests([],next.requests);
        requestState.current = rows; setRequests(rows);
        if (next.mode === 'reset' || !next.mode) setHistoryPages({});
      }
      if (!next.session.user || !next.session.pair) { requestState.current = []; setRequests([]); setHistoryPages({}); clearHomeSnapshot('invalid'); setSavedAt(0); }
      else { saveHomeSnapshot(next.session, requestState.current, generation); setSavedAt(Date.now()); }
      verifiedGeneration.current = snapshotGeneration();
      verifiedRef.current = !document.hidden && (typeof navigator === 'undefined' || navigator.onLine !== false); setVerified(verifiedRef.current);
      setConnectionError('');
    } catch (error) {
      if (epoch !== sessionEpoch.current || generation !== snapshotGeneration()) return;
      verifiedRef.current = false; setVerified(false);
      if (error instanceof ApiError && error.status === 401) { setSession({ user: null, pair: null, recognitionAvailable: false }); setRequests([]); requestState.current = []; revision.current = ''; clearHomeSnapshot('invalid'); setSavedAt(0); }
      else setConnectionError(error instanceof Error ? error.message : '连接失败，请重试');
    } finally {
      setLoading(false); refreshRunning.current = false; lastRefresh.current = Date.now();
      window.dispatchEvent(new Event('usfirst:connected'));
      if (refreshPending.current && !document.hidden) { refreshPending.current = false; window.setTimeout(() => void refreshNow(), 0); }
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(true), 0);
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(true); }, 8000);
    const pause = () => { verifiedRef.current = false; setVerified(false); setRejectId(null); refreshPending.current = false; };
    const resume = () => { if (!document.hidden) { pause(); lastRefresh.current = 0; void refresh(true); } };
    const online = () => { if (!document.hidden) { pause(); void refresh(); } };
    const visible = () => { if (document.hidden) pause(); else resume(); };
    const storage = (event: StorageEvent) => { if (event.key === snapshotGenerationKey || event.key === null) { suppressRefresh.current = event.key === null || !!event.newValue?.startsWith('logout:'); sessionEpoch.current++; revision.current = ''; clearStartupPrefetch(); pause(); setFormOpen(false); setSession(null); setRequests([]); requestState.current = []; setHistoryPages({}); setSettingsOpen(false); setSelectedId(null); setPhoto(null); setSavedAt(0); void refresh(); } };
    const syncHint = (event: MessageEvent) => { if (event.data?.type === 'usfirst:sync-hint' && !document.hidden) void refresh(true); };
    if (typeof navigator !== 'undefined') navigator.serviceWorker?.addEventListener('message', syncHint);
    window.addEventListener('focus', resume); window.addEventListener('online', online); window.addEventListener('offline', pause); window.addEventListener('pageshow', resume); window.addEventListener('storage', storage); document.addEventListener('visibilitychange', visible);
    return () => { if (typeof navigator !== 'undefined') navigator.serviceWorker?.removeEventListener('message', syncHint); clearTimeout(initial); clearInterval(interval); window.removeEventListener('focus', resume); window.removeEventListener('online', online); window.removeEventListener('offline', pause); window.removeEventListener('pageshow', resume); window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  const deepLinkRunning = useRef('');
  const [deepLink, setDeepLink] = useState(() => typeof window.location?.hash === 'string' ? window.location.hash : '');
  useEffect(() => {
    const changed = () => setDeepLink(window.location.hash);
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const notificationAccount = session?.user?.username;
  const notificationPaired = !!session?.pair;
  useEffect(() => {
    const id = deepLink.match(/^#request=([a-f0-9-]{36})$/)?.[1];
    if (!id || !verified || !notificationAccount || !notificationPaired || deepLinkRunning.current === id) return;
    const epoch = sessionEpoch.current; const generation = snapshotGeneration(); let active = true;
    deepLinkRunning.current = id;
    setSettingsOpen(false); setRejectId(null); setPhoto(null);
    void api<{ request: IRequest }>(`/requests/${id}`).then(result => {
      if (!active || epoch !== sessionEpoch.current || generation !== snapshotGeneration()) return;
      publishRequests(mergeRequests(requestState.current,[result.request]));
      setView(result.request.applicant === 'me' ? 'mine' : 'inbox'); setFilter('all'); setSelectedId(id);
      setDeepLink(''); window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }).catch(error => { if (active && epoch === sessionEpoch.current && generation === snapshotGeneration()) { toast.error(error instanceof Error ? error.message : '申请暂时无法打开'); setDeepLink(''); } }).finally(() => { if (deepLinkRunning.current === id) deepLinkRunning.current = ''; });
    return () => { active = false; deepLinkRunning.current = ''; };
  }, [deepLink, verified, notificationAccount, notificationPaired, publishRequests]);
  const writable = () => verifiedRef.current && verifiedGeneration.current === snapshotGeneration() && !document.hidden && (typeof navigator === 'undefined' || navigator.onLine !== false);
  const readOnly = !verified;
  async function create(input: IRequestInput) {
    if (!writable()) throw new Error('正在确认最新数据，请同步完成后再提交。');
    const epoch = sessionEpoch.current; const generation = snapshotGeneration();
    const id = draftId.current;
    const result = await sendRequest(input, id); if (epoch !== sessionEpoch.current || generation !== snapshotGeneration()) return; draftId.current = crypto.randomUUID();
    sessionEpoch.current++; clearStartupPrefetch(); clearHomeSnapshot(); verifiedGeneration.current = snapshotGeneration();
    publishRequests(mergeRequests(requestState.current,[result.request]));
    saveHomeSnapshot(session!,requestState.current,verifiedGeneration.current); setSavedAt(Date.now());
    setView('mine'); setFilter('pending'); toast.success('申请已提交');
  }
  async function update(id: string, status: Status, note = '') {
    if (!writable()) { toast.error('请先同步最新数据，再操作。'); return; }
    const epoch = sessionEpoch.current; const generation = snapshotGeneration();
    if (actionRunning.current) return; actionRunning.current = true; setBusy(true);
    try {
      const result = await sendUpdate(id, status, note); if (epoch !== sessionEpoch.current || generation !== snapshotGeneration()) return;
      sessionEpoch.current++; clearStartupPrefetch(); clearHomeSnapshot(); verifiedGeneration.current = snapshotGeneration();
      publishRequests(mergeRequests(requestState.current,[result.request]));
      saveHomeSnapshot(session!,requestState.current,verifiedGeneration.current); setSavedAt(Date.now());
      setSelectedId(null); setRejectId(null); toast.success(status === 'approved' ? '已同意购买' : status === 'rejected' ? '已记录，这次先不买' : status === 'purchased' ? '已标记购买' : '申请已撤回');
    }
    catch (error) { if (epoch !== sessionEpoch.current || generation !== snapshotGeneration()) return; toast.error(error instanceof Error ? error.message : '操作失败'); await refresh(true); }
    finally { actionRunning.current = false; setBusy(false); }
  }
  async function logout() {
    suppressRefresh.current = true; sessionEpoch.current++; revision.current = ''; clearStartupPrefetch(); clearHomeSnapshot('logout'); verifiedRef.current = false; setVerified(false); setSession({ user: null, pair: null, recognitionAvailable: false }); setRequests([]); requestState.current = []; setHistoryPages({}); setSavedAt(0); setSettingsOpen(false); setSelectedId(null); setRejectId(null); setPhoto(null); setFormOpen(false); setLoading(false); draftId.current = crypto.randomUUID();
    const cleanup = import('@/lib/push-notifications').then(module => module.stopDevicePush()).catch(() => { toast.error('本设备通知关闭未确认，可在系统设置中关闭一起花通知。'); });
    try { await api('/auth/logout', {}); } catch { toast.error('本机快照已清除，但服务器退出未确认，请联网后再退出。'); }
    await cleanup;
  }
  function authenticated(next: SessionState) { suppressRefresh.current = false; sessionEpoch.current++; revision.current = ''; clearStartupPrefetch(); clearHomeSnapshot(); verifiedRef.current = false; setVerified(false); draftId.current = crypto.randomUUID(); requestState.current = []; setHistoryPages({}); setRequests([]); setSavedAt(0); setSelectedId(null); setRejectId(null); setPhoto(null); setFormOpen(false); setSession(next); void refresh(); }
  const pageKey = view + ':' + filter;
  const page = historyPages[pageKey];
  async function loadHistory() {
    if (!writable() || historyRunning.current || refreshRunning.current || page?.cursor === null) return;
    historyRunning.current = true; setHistoryBusy(true); setHistoryError('');
    const epoch = sessionEpoch.current, generation = snapshotGeneration(), atRevision = revision.current;
    try {
      let result = await api<RequestPage>(`/requests/page?view=${view}&filter=${filter}${page?.cursor ? '&cursor=' + encodeURIComponent(page.cursor) : ''}`);
      if (epoch !== sessionEpoch.current || generation !== snapshotGeneration() || atRevision !== revision.current) return;
      // The initial page may already be in the startup batch. One click should reveal older rows,
      // not require a second tap to get past an entirely duplicate first page.
      if (!page && result.cursor && result.requests.every(row => requestState.current.some(known => known.id === row.id))) {
        const first = result;
        result = await api<RequestPage>(`/requests/page?view=${view}&filter=${filter}&cursor=${encodeURIComponent(first.cursor!)}`);
        if (epoch !== sessionEpoch.current || generation !== snapshotGeneration() || atRevision !== revision.current) return;
        result = { ...result, requests: mergeRequests(first.requests,result.requests) };
      }
      publishRequests(mergeRequests(requestState.current,result.requests));
      setHistoryPages(previous => ({ ...previous, [pageKey]: { cursor: result.cursor } }));
    } catch (error) { if (epoch === sessionEpoch.current && generation === snapshotGeneration()) setHistoryError(error instanceof Error ? error.message : '记录暂时无法加载'); }
    finally { historyRunning.current = false; setHistoryBusy(false); if (refreshPending.current && !document.hidden) { refreshPending.current = false; void refresh(); } }
  }
  const selected = requests.find(request => request.id === selectedId); const rejecting = requests.find(request => request.id === rejectId);
  const waiting = requests.filter(request => request.applicant === 'partner' && request.status === 'pending');
  const displayed = requests.filter(request => (view === 'mine' ? request.applicant === 'me' : request.applicant === 'partner') && (filter === 'all' || (filter === 'closed' ? ['rejected', 'cancelled', 'purchased'].includes(request.status) : request.status === filter)));
  const focused = view === 'inbox' && filter === 'pending' ? waiting[0] : undefined;
  return <main className="oa-page"><Toaster position="top-center" toastOptions={{ className: 'oa-toast' }}/><div className="home-scroll"><header className="topbar"><div className="brand"><span className="brand-name">一起花<span className="brand-stop">.</span></span></div>{session?.user && <button className="identity-button" onClick={() => setSettingsOpen(true)}><span>{session.user.displayName}</span><ChevronDown size={14}/></button>}</header>
    {loading ? <div className="loading-state"><LoaderCircle size={25} className="animate-spin"/><p>正在连接…</p></div> : connectionError && !session ? <div className="empty-state"><h2>暂时无法连接</h2><p role="alert">{connectionError}</p><button className="empty-create" onClick={() => void refresh()}><RefreshCw size={17}/>重试</button></div> : !session?.user ? <AuthPanel onSession={authenticated}/> : !session.pair ? <PairPanel onSession={authenticated}/> : <>
    {!verified && session?.pair && <button className="snapshot-status" onClick={() => void refresh()} role="status">{connectionError ? `${connectionError} · 重试` : savedAt ? '上次同步的记录 · 正在更新，仅可查看' : '正在确认最新数据，仅可查看'}</button>}
    {verified && connectionError && <button className="connection-error" onClick={() => void refresh()}>{connectionError} · 重试</button>}
    <section className="workspace"><header className="workspace-heading"><div><h1>{view === 'inbox' ? '待我决定' : '我的申请'}</h1>{waiting.length > 0 && view === 'inbox' && filter === 'pending' && <p>待审批</p>}</div>{view === 'inbox' && <button className={`history-toggle ${filter === 'all' ? 'selected' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter(filter === 'all' ? 'pending' : 'all')}>{filter === 'all' ? '返回待办' : '历史'}</button>}</header>
    {view === 'mine' && <div className="status-filters">{filters.map(item => <button key={item.id} className={filter === item.id ? 'active' : ''} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>}
    <div className="request-list">{displayed.length ? focused ? <FocusRequest request={focused} onOpen={() => setSelectedId(focused.id)} onApprove={() => void update(focused.id, 'approved')} onReject={() => { if (writable()) setRejectId(focused.id); }} onPhoto={() => setPhoto({ photos: focused.photos, index: 0 })} busy={busy} readOnly={readOnly} applicantName={session.pair.partnerName}/> : displayed.map(request => <RequestCard key={request.id} request={request} readOnly={readOnly} applicantName={request.applicant === 'me' ? '我' : session.pair.partnerName} onOpen={() => setSelectedId(request.id)}/>) : <div className="empty-state"><span className="empty-check"><Check size={25}/></span><h2>{!page ? '暂无近期记录' : view === 'inbox' ? filter === 'all' ? '还没有审批记录' : '没有待审批的申请' : '这里还没有申请'}</h2>{view === 'mine' && <button className="empty-create" onClick={() => { if (writable()) setFormOpen(true); }} disabled={readOnly}>申请一笔<Plus size={16}/></button>}</div>}</div>
    {verified && page?.cursor !== null && <button className="history-toggle load-more" disabled={historyBusy} onClick={() => void loadHistory()}>{historyBusy ? '正在加载…' : historyError ? '加载失败，重试' : filter === 'pending' ? '查看更多待审批' : '查看更多记录'}</button>}
    {historyError && <p className="connection-error" role="alert">{historyError}</p>}
    </section>
    </>}
    </div>
    {!loading && session?.user && session.pair && <>
    <div className="nav-dock"><nav className="bottom-nav" aria-label="主要导航"><button className={`nav-item ${view === 'inbox' ? 'active' : ''}`} aria-pressed={view === 'inbox'} onClick={() => { setView('inbox'); setFilter('pending'); }}><span className="nav-icon"><Inbox size={21}/>{waiting.length > 0 && <i/>}</span><span>审批</span></button><button className="new-request" onClick={() => { if (writable()) setFormOpen(true); }} disabled={readOnly}><Plus size={22}/><span>申请一笔</span></button><button className={`nav-item ${view === 'mine' ? 'active' : ''}`} aria-pressed={view === 'mine'} onClick={() => { setView('mine'); setFilter('pending'); }}><FileText size={21}/><span>我的申请</span></button></nav></div>
    <Suspense fallback={<p className="connection-error" role="status">正在打开…</p>}>
    {formOpen && <RequestForm open={formOpen} readOnly={readOnly} person="me" onClose={() => setFormOpen(false)} onCreate={create} recognize={session.recognitionAvailable ? (photos, signal) => { if (!writable()) return Promise.reject(new Error('请先完成同步，再重新识别图片。')); return recognizePhotos(photos, signal); } : undefined} partnerName={session.pair.partnerName}/>}
    {selected && <RequestDetail key={selected.id} request={selected} person="me" onClose={() => setSelectedId(null)} onUpdate={(id, status, note) => void update(id, status, note)} onReject={() => { if (writable()) { setSelectedId(null); setRejectId(selected.id); } }} busy={busy} readOnly={readOnly} partnerName={session.pair.partnerName}/>}
    {rejecting && !readOnly && <RejectSheet request={rejecting} busy={busy} onClose={() => setRejectId(null)} onConfirm={note => update(rejecting.id, 'rejected', note)}/>}
    {photo && <PhotoViewer photos={photo.photos} index={photo.index} onClose={() => setPhoto(null)}/>}
    </Suspense>
    </>}
    <Suspense fallback={<p className="connection-error" role="status">正在打开…</p>}>{settingsOpen && session?.user && <SettingsSheet session={session} readOnly={readOnly} canWrite={writable} onClose={() => setSettingsOpen(false)} onLogout={logout}/>}</Suspense>
  </main>;
}
