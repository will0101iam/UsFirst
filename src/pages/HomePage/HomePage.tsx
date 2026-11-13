import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Inbox, FileText, Check, ChevronDown, RefreshCw, LoaderCircle } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import RequestForm from '@/components/RequestForm';
import RequestDetail from '@/components/RequestDetail';
import RequestCard from '@/components/RequestCard';
import FocusRequest from '@/components/FocusRequest';
import AuthPanel from '@/components/AuthPanel';
import PairPanel from '@/components/PairPanel';
import SettingsSheet from '@/components/SettingsSheet';
import RejectSheet from '@/components/RejectSheet';
import PhotoViewer from '@/components/PhotoViewer';
import { api, ApiError, getSession, getRequests, createRequest as sendRequest, updateRequest as sendUpdate, recognizePhotos } from '@/lib/api';
import type { SessionState } from '@/lib/api';
import type { IRequest, IRequestInput, Status } from '@/lib/oa-types';
import './home.css';
import './c3.css';
import './production.css';
type View = 'inbox' | 'mine';
type Filter = 'all' | 'pending' | 'approved' | 'closed';
const filters: { id: Filter; label: string }[] = [{ id: 'pending', label: '待审批' }, { id: 'approved', label: '可购买' }, { id: 'closed', label: '已结束' }, { id: 'all', label: '全部' }];
export default function HomePage() {
  const [session, setSession] = useState<SessionState | null>(null); const [loading, setLoading] = useState(true); const [connectionError, setConnectionError] = useState('');
  const [requests, setRequests] = useState<IRequest[]>([]); const [view, setView] = useState<View>('inbox'); const [filter, setFilter] = useState<Filter>('pending');
  const [formOpen, setFormOpen] = useState(false); const [settingsOpen, setSettingsOpen] = useState(false); const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null); const [photo, setPhoto] = useState<{ photos: IRequest['photos']; index: number } | null>(null);
  const [busy, setBusy] = useState(false); const refreshRunning = useRef(false); const sessionEpoch = useRef(0); const actionRunning = useRef(false); const draftId = useRef(crypto.randomUUID());
  const refresh = useCallback(async (silent = false) => {
    if (refreshRunning.current) return;
    refreshRunning.current = true; const epoch = sessionEpoch.current;
    try {
      const next = await getSession();
      const value = next.user && next.pair ? await getRequests() : { requests: [] };
      if (epoch !== sessionEpoch.current) return;
      setSession(next); setRequests(value.requests);
      setConnectionError('');
    } catch (error) {
      if (epoch !== sessionEpoch.current) return;
      if (error instanceof ApiError && error.status === 401) { setSession({ user: null, pair: null, recognitionAvailable: false }); setRequests([]); }
      else if (!silent) setConnectionError(error instanceof Error ? error.message : '连接失败，请重试');
    } finally { setLoading(false); refreshRunning.current = false; }
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => void refresh(), 0); const interval = window.setInterval(() => { if (!document.hidden) void refresh(true); }, 8000); const focus = () => void refresh(true); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus); return () => { clearTimeout(initial); clearInterval(interval); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); }; }, [refresh]);
  async function create(input: IRequestInput) {
    await sendRequest(input, draftId.current); draftId.current = crypto.randomUUID(); await refresh(); setView('mine'); setFilter('pending'); toast.success('申请已提交');
  }
  async function update(id: string, status: Status, note = '') {
    if (actionRunning.current) return; actionRunning.current = true; setBusy(true);
    try { await sendUpdate(id, status, note); setSelectedId(null); setRejectId(null); await refresh(); toast.success(status === 'approved' ? '已同意购买' : status === 'rejected' ? '已记录，这次先不买' : status === 'purchased' ? '已标记购买' : '申请已撤回'); }
    catch (error) { toast.error(error instanceof Error ? error.message : '操作失败'); await refresh(true); }
    finally { actionRunning.current = false; setBusy(false); }
  }
  async function logout() { try { await api('/auth/logout', {}); sessionEpoch.current++; setSession({ user: null, pair: null, recognitionAvailable: false }); setRequests([]); setSettingsOpen(false); setSelectedId(null); setRejectId(null); setPhoto(null); setFormOpen(false); draftId.current = crypto.randomUUID(); } catch (error) { toast.error(error instanceof Error ? error.message : '退出失败'); } }
  function authenticated(next: SessionState) { sessionEpoch.current++; draftId.current = crypto.randomUUID(); setRequests([]); setSession(next); void refresh(); }
  const selected = requests.find(request => request.id === selectedId); const rejecting = requests.find(request => request.id === rejectId);
  const waiting = requests.filter(request => request.applicant === 'partner' && request.status === 'pending');
  const displayed = requests.filter(request => (view === 'mine' ? request.applicant === 'me' : request.applicant === 'partner') && (filter === 'all' || (filter === 'closed' ? ['rejected', 'cancelled', 'purchased'].includes(request.status) : request.status === filter)));
  const focused = view === 'inbox' && filter === 'pending' ? waiting[0] : undefined;
  return <main className="oa-page"><Toaster position="top-center" toastOptions={{ className: 'oa-toast' }}/><header className="topbar"><div className="brand"><span className="brand-name">一起花<span className="brand-stop">.</span></span></div>{session?.user && <button className="identity-button" onClick={() => setSettingsOpen(true)}><span>{session.user.displayName}</span><ChevronDown size={14}/></button>}</header>
    {loading ? <div className="loading-state"><LoaderCircle size={25} className="animate-spin"/><p>正在连接…</p></div> : connectionError && !session ? <div className="empty-state"><h2>暂时无法连接</h2><p role="alert">{connectionError}</p><button className="empty-create" onClick={() => void refresh()}><RefreshCw size={17}/>重试</button></div> : !session?.user ? <AuthPanel onSession={authenticated}/> : !session.pair ? <PairPanel onSession={authenticated}/> : <>
    {connectionError && <button className="connection-error" onClick={() => void refresh()}>{connectionError} · 重试</button>}
    <section className="workspace"><header className="workspace-heading"><div><h1>{view === 'inbox' ? '待我决定' : '我的申请'}</h1>{waiting.length > 0 && view === 'inbox' && filter === 'pending' && <p>{waiting.length} 笔待审批</p>}</div>{view === 'inbox' && <button className={`history-toggle ${filter === 'all' ? 'selected' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter(filter === 'all' ? 'pending' : 'all')}>{filter === 'all' ? '返回待办' : '历史'}</button>}</header>
    {view === 'mine' && <div className="status-filters">{filters.map(item => <button key={item.id} className={filter === item.id ? 'active' : ''} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>}
    <div className="request-list">{displayed.length ? focused ? <FocusRequest request={focused} onOpen={() => setSelectedId(focused.id)} onApprove={() => void update(focused.id, 'approved')} onReject={() => setRejectId(focused.id)} onPhoto={() => setPhoto({ photos: focused.photos, index: 0 })} busy={busy} applicantName={session.pair.partnerName}/> : displayed.map(request => <RequestCard key={request.id} request={request} applicantName={request.applicant === 'me' ? '我' : session.pair.partnerName} onOpen={() => setSelectedId(request.id)}/>) : <div className="empty-state"><span className="empty-check"><Check size={25}/></span><h2>{view === 'inbox' ? filter === 'all' ? '还没有审批记录' : '没有待审批的申请' : '这里还没有申请'}</h2>{view === 'mine' && <button className="empty-create" onClick={() => setFormOpen(true)}>申请一笔<Plus size={16}/></button>}</div>}</div></section>
    <div className="nav-dock"><nav className="bottom-nav" aria-label="主要导航"><button className={`nav-item ${view === 'inbox' ? 'active' : ''}`} aria-pressed={view === 'inbox'} onClick={() => { setView('inbox'); setFilter('pending'); }}><span className="nav-icon"><Inbox size={21}/>{waiting.length > 0 && <i/>}</span><span>审批</span></button><button className="new-request" onClick={() => setFormOpen(true)}><Plus size={22}/><span>申请一笔</span></button><button className={`nav-item ${view === 'mine' ? 'active' : ''}`} aria-pressed={view === 'mine'} onClick={() => { setView('mine'); setFilter('pending'); }}><FileText size={21}/><span>我的申请</span></button></nav></div>
    <RequestForm open={formOpen} person="me" onClose={() => setFormOpen(false)} onCreate={create} recognize={session.recognitionAvailable ? recognizePhotos : undefined} partnerName={session.pair.partnerName}/>
    {selected && <RequestDetail key={selected.id} request={selected} person="me" onClose={() => setSelectedId(null)} onUpdate={(id, status, note) => void update(id, status, note)} onReject={() => { setSelectedId(null); setRejectId(selected.id); }} busy={busy} partnerName={session.pair.partnerName}/>}
    {rejecting && <RejectSheet request={rejecting} busy={busy} onClose={() => setRejectId(null)} onConfirm={note => update(rejecting.id, 'rejected', note)}/>}
    {photo && <PhotoViewer photos={photo.photos} index={photo.index} onClose={() => setPhoto(null)}/>}
    </>}
    {settingsOpen && session?.user && <SettingsSheet session={session} onClose={() => setSettingsOpen(false)} onLogout={logout}/>}
  </main>;
}
