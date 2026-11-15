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
import { readHomeSnapshot, saveHomeSnapshot, clearHomeSnapshot, snapshotGeneration, snapshotGenerationKey } from '@/lib/home-snapshot';
import type { SessionState } from '@/lib/api';
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
  const refresh = useCallback(async function refreshNow(silent = false) {
    if (suppressRefresh.current) return;
    if (refreshRunning.current) { if (!silent) refreshPending.current = true; return; }
    if (silent && Date.now() - lastRefresh.current < 4000) return;
    refreshRunning.current = true; const epoch = sessionEpoch.current; const generation = snapshotGeneration();
    try {
      const next = await getBootstrap(revision.current);
      if (epoch !== sessionEpoch.current || generation !== snapshotGeneration()) return;
      revision.current = next.revision;
      setSession(next.session);
      if (next.requests !== null) { requestState.current = next.requests; setRequests(next.requests); }
      if (!next.session.user || !next.session.pair) { requestState.current = []; setRequests([]); clearHomeSnapshot('invalid'); setSavedAt(0); }
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
      if (refreshPending.current) { refreshPending.current = false; window.setTimeout(() => void refreshNow(), 0); }
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(true), 0);
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(true); }, 8000);
    const pause = () => { verifiedRef.current = false; setVerified(false); setRejectId(null); };
    const resume = () => { if (!document.hidden) { pause(); lastRefresh.current = 0; void refresh(true); } };
    const online = () => { if (!document.hidden) { pause(); void refresh(); } };
    const visible = () => { if (document.hidden) pause(); else resume(); };
    const storage = (event: StorageEvent) => { if (event.key === snapshotGenerationKey || event.key === null) { suppressRefresh.current = event.key === null || !!event.newValue?.startsWith('logout:'); sessionEpoch.current++; revision.current = ''; clearStartupPrefetch(); pause(); setFormOpen(false); setSession(null); setRequests([]); requestState.current = []; setSettingsOpen(false); setSelectedId(null); setPhoto(null); setSavedAt(0); void refresh(); } };
    window.addEventListener('focus', resume); window.addEventListener('online', online); window.addEventListener('offline', pause); window.addEventListener('pageshow', resume); window.addEventListener('storage', storage); document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(initial); clearInterval(interval); window.removeEventListener('focus', resume); window.removeEventListener('online', online); window.removeEventListener('offline', pause); window.removeEventListener('pageshow', resume); window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  const writable = () => verifiedRef.current && verifiedGeneration.current === snapshotGeneration() && !document.hidden && (typeof navigator === 'undefined' || navigator.onLine !== false);
  const readOnly = !verified;
  async function create(input: IRequestInput) {
    if (!writable()) throw new Error('正在确认最新数据，请同步完成后再提交。');
    const epoch = sessionEpoch.current; const generation = snapshotGeneration();
    const id = draftId.current;
    await sendRequest(input, id); if (epoch !== sessionEpoch.current || generation !== snapshotGeneration()) return; draftId.current = crypto.randomUUID();
    sessionEpoch.current++; revision.current = ''; clearStartupPrefetch(); clearHomeSnapshot(); verifiedGeneration.current = snapshotGeneration();
    setRequests(previous => [{ ...input, id, applicant: 'me', status: 'pending', createdAt: new Date().toISOString() }, ...previous.filter(row => row.id !== id)]);
    setView('mine'); setFilter('pending'); toast.success('申请已提交'); void refresh();
  }
  async function update(id: string, status: Status, note = '') {
    if (!writable()) { toast.error('请先同步最新数据，再操作。'); return; }
    const epoch = sessionEpoch.current; const generation = snapshotGeneration();
    if (actionRunning.current) return; actionRunning.current = true; setBusy(true);
    try { await sendUpdate(id, status, note); if (epoch !== sessionEpoch.current || generation !== snapshotGeneration()) return; sessionEpoch.current++; revision.current = ''; clearStartupPrefetch(); clearHomeSnapshot(); verifiedGeneration.current = snapshotGeneration(); setRequests(previous => previous.map(row => row.id === id ? { ...row, status, decisionNote: note || row.decisionNote } : row)); setSelectedId(null); setRejectId(null); toast.success(status === 'approved' ? '已同意购买' : status === 'rejected' ? '已记录，这次先不买' : status === 'purchased' ? '已标记购买' : '申请已撤回'); void refresh(); }
    catch (error) { if (epoch !== sessionEpoch.current || generation !== snapshotGeneration()) return; toast.error(error instanceof Error ? error.message : '操作失败'); await refresh(true); }
    finally { actionRunning.current = false; setBusy(false); }
  }
  async function logout() {
    suppressRefresh.current = true; sessionEpoch.current++; revision.current = ''; clearStartupPrefetch(); clearHomeSnapshot('logout'); verifiedRef.current = false; setVerified(false); setSession({ user: null, pair: null, recognitionAvailable: false }); setRequests([]); requestState.current = []; setSavedAt(0); setSettingsOpen(false); setSelectedId(null); setRejectId(null); setPhoto(null); setFormOpen(false); setLoading(false); draftId.current = crypto.randomUUID();
    try { await api('/auth/logout', {}); } catch { toast.error('本机快照已清除，但服务器退出未确认，请联网后再退出。'); }
  }
  function authenticated(next: SessionState) { suppressRefresh.current = false; sessionEpoch.current++; revision.current = ''; clearStartupPrefetch(); clearHomeSnapshot(); verifiedRef.current = false; setVerified(false); draftId.current = crypto.randomUUID(); requestState.current = []; setRequests([]); setSavedAt(0); setSelectedId(null); setRejectId(null); setPhoto(null); setFormOpen(false); setSession(next); void refresh(); }
  const selected = requests.find(request => request.id === selectedId); const rejecting = requests.find(request => request.id === rejectId);
  const waiting = requests.filter(request => request.applicant === 'partner' && request.status === 'pending');
  const displayed = requests.filter(request => (view === 'mine' ? request.applicant === 'me' : request.applicant === 'partner') && (filter === 'all' || (filter === 'closed' ? ['rejected', 'cancelled', 'purchased'].includes(request.status) : request.status === filter)));
  const focused = view === 'inbox' && filter === 'pending' ? waiting[0] : undefined;
  return <main className="oa-page"><Toaster position="top-center" toastOptions={{ className: 'oa-toast' }}/><header className="topbar"><div className="brand"><span className="brand-name">一起花<span className="brand-stop">.</span></span></div>{session?.user && <button className="identity-button" onClick={() => setSettingsOpen(true)}><span>{session.user.displayName}</span><ChevronDown size={14}/></button>}</header>
    {loading ? <div className="loading-state"><LoaderCircle size={25} className="animate-spin"/><p>正在连接…</p></div> : connectionError && !session ? <div className="empty-state"><h2>暂时无法连接</h2><p role="alert">{connectionError}</p><button className="empty-create" onClick={() => void refresh()}><RefreshCw size={17}/>重试</button></div> : !session?.user ? <AuthPanel onSession={authenticated}/> : !session.pair ? <PairPanel onSession={authenticated}/> : <>
    {!verified && session?.pair && <button className="snapshot-status" onClick={() => void refresh()} role="status">{connectionError ? `${connectionError} · 重试` : savedAt ? '上次同步的记录 · 正在更新，仅可查看' : '正在确认最新数据，仅可查看'}</button>}
    {verified && connectionError && <button className="connection-error" onClick={() => void refresh()}>{connectionError} · 重试</button>}
    <section className="workspace"><header className="workspace-heading"><div><h1>{view === 'inbox' ? '待我决定' : '我的申请'}</h1>{waiting.length > 0 && view === 'inbox' && filter === 'pending' && <p>{waiting.length} 笔待审批</p>}</div>{view === 'inbox' && <button className={`history-toggle ${filter === 'all' ? 'selected' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter(filter === 'all' ? 'pending' : 'all')}>{filter === 'all' ? '返回待办' : '历史'}</button>}</header>
    {view === 'mine' && <div className="status-filters">{filters.map(item => <button key={item.id} className={filter === item.id ? 'active' : ''} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>}
    <div className="request-list">{displayed.length ? focused ? <FocusRequest request={focused} onOpen={() => setSelectedId(focused.id)} onApprove={() => void update(focused.id, 'approved')} onReject={() => { if (writable()) setRejectId(focused.id); }} onPhoto={() => setPhoto({ photos: focused.photos, index: 0 })} busy={busy} readOnly={readOnly} applicantName={session.pair.partnerName}/> : displayed.map(request => <RequestCard key={request.id} request={request} readOnly={readOnly} applicantName={request.applicant === 'me' ? '我' : session.pair.partnerName} onOpen={() => setSelectedId(request.id)}/>) : <div className="empty-state"><span className="empty-check"><Check size={25}/></span><h2>{view === 'inbox' ? filter === 'all' ? '还没有审批记录' : '没有待审批的申请' : '这里还没有申请'}</h2>{view === 'mine' && <button className="empty-create" onClick={() => { if (writable()) setFormOpen(true); }} disabled={readOnly}>申请一笔<Plus size={16}/></button>}</div>}</div></section>
    <div className="nav-dock"><nav className="bottom-nav" aria-label="主要导航"><button className={`nav-item ${view === 'inbox' ? 'active' : ''}`} aria-pressed={view === 'inbox'} onClick={() => { setView('inbox'); setFilter('pending'); }}><span className="nav-icon"><Inbox size={21}/>{waiting.length > 0 && <i/>}</span><span>审批</span></button><button className="new-request" onClick={() => { if (writable()) setFormOpen(true); }} disabled={readOnly}><Plus size={22}/><span>申请一笔</span></button><button className={`nav-item ${view === 'mine' ? 'active' : ''}`} aria-pressed={view === 'mine'} onClick={() => { setView('mine'); setFilter('pending'); }}><FileText size={21}/><span>我的申请</span></button></nav></div>
    <Suspense fallback={<p className="connection-error" role="status">正在打开…</p>}>
    {formOpen && <RequestForm open={formOpen} readOnly={readOnly} person="me" onClose={() => setFormOpen(false)} onCreate={create} recognize={session.recognitionAvailable ? (photos, signal) => { if (!writable()) return Promise.reject(new Error('请先完成同步，再重新识别图片。')); return recognizePhotos(photos, signal); } : undefined} partnerName={session.pair.partnerName}/>}
    {selected && <RequestDetail key={selected.id} request={selected} person="me" onClose={() => setSelectedId(null)} onUpdate={(id, status, note) => void update(id, status, note)} onReject={() => { if (writable()) { setSelectedId(null); setRejectId(selected.id); } }} busy={busy} readOnly={readOnly} partnerName={session.pair.partnerName}/>}
    {rejecting && !readOnly && <RejectSheet request={rejecting} busy={busy} onClose={() => setRejectId(null)} onConfirm={note => update(rejecting.id, 'rejected', note)}/>}
    {photo && <PhotoViewer photos={photo.photos} index={photo.index} onClose={() => setPhoto(null)}/>}
    </Suspense>
    </>}
    <Suspense fallback={<p className="connection-error" role="status">正在打开…</p>}>{settingsOpen && session?.user && <SettingsSheet session={session} onClose={() => setSettingsOpen(false)} onLogout={logout}/>}</Suspense>
  </main>;
}
