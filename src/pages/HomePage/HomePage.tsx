import { useState } from 'react';
import { Plus, ArrowRight, Inbox, FileText, Check, ChevronDown } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import RequestForm from '@/components/RequestForm';
import RequestDetail from '@/components/RequestDetail';
import RequestCard from '@/components/RequestCard';
import FocusRequest from '@/components/FocusRequest';
import AboutDialog from '@/components/AboutDialog';
import { people, otherPerson } from '@/lib/oa-types';
import type { IRequestInput, Person, Status } from '@/lib/oa-types';
import { loadRequests, saveRequests } from '@/lib/oa-storage';
import './home.css';
import './c3.css';
type View = 'inbox' | 'mine';
type Filter = 'all' | 'pending' | 'approved' | 'closed';
const filters: { id: Filter; label: string }[] = [{ id: 'pending', label: '待审批' }, { id: 'approved', label: '可购买' }, { id: 'closed', label: '已结束' }, { id: 'all', label: '全部' }];
export default function HomePage() {
  const [requests, setRequests] = useState(loadRequests);
  const [person, setPerson] = useState<Person>('me');
  const [view, setView] = useState<View>('inbox');
  const [filter, setFilter] = useState<Filter>('pending');
  const [formOpen, setFormOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const waitingOnMe = requests.filter(request => request.applicant !== person && request.status === 'pending');
  const pool = requests.filter(request => view === 'mine' ? request.applicant === person : request.applicant !== person);
  const displayed = pool.filter(request => filter === 'all' || (filter === 'closed' ? ['rejected', 'cancelled', 'purchased'].includes(request.status) : request.status === filter));
  const selected = requests.find(request => request.id === selectedId);
  const focused = view === 'inbox' && filter === 'pending' ? waitingOnMe[0] : undefined;
  async function createRequest(input: IRequestInput) {
    const next = [{ ...input, id: crypto.randomUUID(), applicant: person, status: 'pending' as const, createdAt: new Date().toISOString() }, ...requests];
    saveRequests(next); setRequests(next); setView('mine'); setFilter('pending');
    toast.success(`申请已提交，等${people[otherPerson(person)]}点头。`);
  }
  function updateRequest(id: string, status: Status, note = '') {
    const request = requests.find(item => item.id === id);
    if (!request) return;
    const mine = request.applicant === person;
    const valid = ((status === 'approved' || status === 'rejected') && !mine && request.status === 'pending') || (status === 'cancelled' && mine && request.status === 'pending') || (status === 'purchased' && mine && request.status === 'approved');
    if (!valid) { toast.error('当前身份不能进行这项操作。'); return; }
    const now = new Date().toISOString();
    const next = requests.map(item => item.id === id ? { ...item, status, ...(status === 'purchased' ? { purchasedAt: now } : { decidedAt: now, decisionNote: note }) } : item);
    try {
      saveRequests(next); setRequests(next); setSelectedId(null);
      const messages: Partial<Record<Status, string>> = { approved: '已同意，对方可以购买了。', rejected: '已记录，这次先不买。', cancelled: '申请已撤回。', purchased: '已标记购买。' };
      toast.success(messages[status] || '已更新');
    } catch (error) { toast.error(error instanceof Error ? error.message : '保存失败。'); }
  }
  function switchPerson(next: Person) { setPerson(next); setSelectedId(null); setFilter('pending'); toast.info(`已切换为${people[next]} · 演示身份`); }
  function chooseView(next: View) { setView(next); setFilter('pending'); }
  const title = view === 'inbox' ? '这一笔，等你决定' : '我的申请';
  const hint = view === 'inbox' ? waitingOnMe.length ? `${waitingOnMe.length} 笔消费，等你点头。` : '暂时没有需要你审批的消费。' : '想买的东西，先和对方商量。';
  return <main className="oa-page">
    <Toaster position="top-center" toastOptions={{ className: 'oa-toast' }}/>
    <header className="topbar"><div className="brand"><span className="brand-name">一起花<span className="brand-stop">.</span></span><span className="brand-sub">两个人的小约定</span></div><DropdownMenu><DropdownMenuTrigger asChild><button className="identity-button"><span>{people[person]}</span><small>演示</small><ChevronDown size={14}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="identity-menu"><DropdownMenuLabel>切换演示视角 · 非登录</DropdownMenuLabel>{(['me', 'partner'] as Person[]).map(value => <DropdownMenuItem key={value} onSelect={() => switchPerson(value)}>{people[value]}{person === value && <Check size={15} className="ml-auto"/>}</DropdownMenuItem>)}<DropdownMenuSeparator/><DropdownMenuItem onSelect={() => setAboutOpen(true)}>使用说明与主屏幕安装</DropdownMenuItem></DropdownMenuContent></DropdownMenu></header>
    <div className="prototype-note"><span/>本地原型 · 登录与双手机同步未接入</div>
    <div className="view-toggle" aria-label="查看申请"><button className={view === 'inbox' ? 'active' : ''} aria-pressed={view === 'inbox'} onClick={() => chooseView('inbox')}>待我决定</button><button className={view === 'mine' ? 'active' : ''} aria-pressed={view === 'mine'} onClick={() => chooseView('mine')}>我的申请</button></div>
    <section className="workspace"><header className="workspace-heading"><div><h1>{title}</h1><p>{hint}</p></div>{view === 'inbox' && <button className={`history-toggle ${filter === 'all' ? 'selected' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter(filter === 'all' ? 'pending' : 'all')}>{filter === 'all' ? '返回待办' : '历史'}</button>}</header>
      {view === 'mine' && <div className="status-filters" aria-label="申请状态">{filters.map(item => <button key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>}
      <div className="request-list" key={`${view}-${filter}-${person}`}>{displayed.length ? focused ? <FocusRequest request={focused} onOpen={() => setSelectedId(focused.id)} onApprove={() => updateRequest(focused.id, 'approved')} /> : displayed.map(request => <RequestCard key={request.id} request={request} onOpen={() => setSelectedId(request.id)}/>) : <div className="empty-state"><span className="empty-check">{view === 'inbox' ? <Check size={25} strokeWidth={1.5}/> : <FileText size={25} strokeWidth={1.5}/>}</span><h2>{view === 'inbox' ? '都处理好了' : '这里还没有申请'}</h2><p>{view === 'inbox' ? '对方有新的消费申请时，再来看看。' : filter === 'approved' ? '对方同意后，就会出现在这里。' : '填写想买的东西和金额，交给对方。'}</p>{view === 'mine' && filter !== 'approved' && <button className="empty-create" onClick={() => setFormOpen(true)}>申请一笔<ArrowRight size={16}/></button>}</div>}</div>
      <p className="list-caption">{view === 'inbox' ? '只审批对方的申请。标注「示例」的记录供体验。' : '同意后再购买。标注「示例」的记录供体验。'}</p>
    </section>
    <div className="nav-dock"><nav className="bottom-nav" aria-label="主要导航"><button className={`nav-item ${view === 'inbox' ? 'active' : ''}`} aria-pressed={view === 'inbox'} onClick={() => chooseView('inbox')}><span className="nav-icon"><Inbox size={21} strokeWidth={1.7}/>{waitingOnMe.length > 0 && <i/>}</span><span>审批</span></button><button className="new-request" onClick={() => setFormOpen(true)} aria-label="发起消费申请"><Plus size={22} strokeWidth={1.8}/><span>申请一笔</span></button><button className={`nav-item ${view === 'mine' ? 'active' : ''}`} aria-pressed={view === 'mine'} onClick={() => chooseView('mine')}><FileText size={21} strokeWidth={1.7}/><span>我的申请</span></button></nav></div>
    <RequestForm open={formOpen} person={person} onClose={() => setFormOpen(false)} onCreate={createRequest}/>
    {selected && <RequestDetail key={`${selected.id}-${person}`} request={selected} person={person} onClose={() => setSelectedId(null)} onUpdate={updateRequest}/>}
    <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)}/>
  </main>;
}
