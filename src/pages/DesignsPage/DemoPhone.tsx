import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Plus, Inbox, FileText, Heart, RotateCcw, Camera } from 'lucide-react';
import { money, sampleRequests, statusLabels } from '@/lib/oa-types';
import type { IRequest, IRequestInput, Person, Status } from '@/lib/oa-types';
import type { Variant, DemoScreen, DemoView } from './design-data';
import DemoForm from './DemoForm';
import DemoDetail from './DemoDetail';
interface DemoPhoneProps { variant: Variant; initial: DemoScreen }
export default function DemoPhone({ variant, initial }: DemoPhoneProps) {
  const [requests,setRequests] = useState<IRequest[]>(() => structuredClone(sampleRequests));
  const [person,setPerson] = useState<Person>('me');
  const [screen,setScreen] = useState<DemoScreen>(initial);
  const [view,setView] = useState<DemoView>('inbox');
  const [selectedId,setSelectedId] = useState('sample-1');
  const [notice,setNotice] = useState('');
  const [showHistory,setShowHistory] = useState(false);
  const pool = requests.filter(item => view === 'mine' ? item.applicant === person : item.applicant !== person);
  const waiting = pool.filter(item => item.status === 'pending');
  const shown = showHistory ? pool : view === 'mine' ? pool : waiting;
  const selected = requests.find(item => item.id === selectedId);
  const current = waiting[0];
  const focusRequest = current || pool[0];
  function go(next: DemoView) { setView(next); setScreen('home'); setNotice(''); setShowHistory(false); }
  function open(request: IRequest) { setSelectedId(request.id); setScreen('detail'); }
  function create(input: IRequestInput) {
    const request: IRequest = { ...input, id:crypto.randomUUID(), applicant:person, status:'pending', createdAt:new Date().toISOString(), sample:true };
    setRequests(previous => [request,...previous]); setView('mine'); setScreen('home'); setNotice('已提交示例申请，切换对方身份可审批。');
  }
  function decide(status: Status, note = '', id = selectedId) {
    const request = requests.find(item => item.id === id);
    if (!request) return;
    const mine = request.applicant === person;
    const allowed = ((status === 'approved' || status === 'rejected') && !mine && request.status === 'pending') || (status === 'purchased' && mine && request.status === 'approved') || (status === 'cancelled' && mine && request.status === 'pending');
    if (!allowed) { setNotice('只能由对方审批。'); return; }
    setRequests(previous => previous.map(item => item.id === id ? { ...item,status,decisionNote:note } : item)); setScreen('home'); setNotice(status === 'approved' ? '已同意，对方可以购买了。' : status === 'rejected' ? '这次先不买，已告诉对方。' : '状态已更新。');
  }
  function reset() { setRequests(structuredClone(sampleRequests)); setScreen(initial); setView('inbox'); setPerson('me'); setNotice(''); setShowHistory(false); setSelectedId('sample-1'); }
  const name = screen === 'new' ? '申请一笔' : screen === 'detail' ? '申请详情' : '一起花';
  return <div className={`demo-app variant-${variant}`}>
    <header className="demo-app-header">{screen === 'home' ? <><strong className="demo-brand">一起花{variant === 'note' ? <span> / for two</span> : <i/>}</strong><button className="demo-identity" onClick={() => { setPerson(previous => previous === 'me' ? 'partner' : 'me'); setScreen('home'); setNotice('已切换演示身份'); }}>{person === 'me' ? '我' : '她'}<span>演示</span></button></> : <><button className="demo-back" onClick={() => setScreen('home')} aria-label="返回首页"><ArrowLeft size={19}/></button><strong>{name}</strong><button className="demo-back" onClick={reset} aria-label="重置演示"><RotateCcw size={17}/></button></>}</header>
    {notice && <div className="demo-notice" role="status"><Check size={14}/>{notice}<button onClick={() => setNotice('')} aria-label="关闭反馈">×</button></div>}
    {screen === 'new' ? <DemoForm onCreate={create}/> : screen === 'detail' && selected ? <DemoDetail request={selected} person={person} onDecide={decide}/> : <>
      <div className="demo-home-scroll">
        {variant === 'clear' && <><div className="clear-head"><span>两个人的消费清单</span><h1>{view === 'inbox' ? '等我点头' : '我的申请'}<small>{waiting.length}</small></h1><p>{view === 'inbox' ? '先商量，再下单。' : '对方同意后，就可以买了。'}</p></div><div className="clear-switch"><button className={view === 'inbox' ? 'selected' : ''} onClick={() => go('inbox')}>待我审批</button><button className={view === 'mine' ? 'selected' : ''} onClick={() => go('mine')}>我的申请</button></div><div className="clear-list-title"><span>{showHistory ? '全部申请' : '当前申请'}</span><button onClick={() => setShowHistory(!showHistory)}>{showHistory ? '仅待办' : '查看历史'}</button></div><div className="clear-list">{shown.map(item => <button key={item.id} className="clear-row" onClick={() => open(item)}><span className={`clear-check ${item.status !== 'pending' ? 'done' : ''}`}>{item.status !== 'pending' && <Check size={13}/>}</span><span className="clear-row-text"><strong>{item.title}</strong><small>{item.category} · {statusLabels[item.status]}</small></span><span className="clear-money">¥{money(item.amountCents)}</span><ChevronRight size={15}/></button>)}</div><p className="demo-local-note">示例申请 · 登录与同步待接入</p></>}
        {variant === 'note' && <><div className="note-head"><span>两个人的小约定</span><h1>花钱之前，<br/>和你说一声<span>。</span></h1></div><div className="note-view-switch"><button className={view === 'inbox' ? 'selected' : ''} onClick={() => go('inbox')}>对方的便笺 {waiting.length > 0 && <small>{waiting.length}</small>}</button><button className={view === 'mine' ? 'selected' : ''} onClick={() => go('mine')}>我的便笺</button></div>{shown.map((item,index) => <button key={item.id} className="note-paper" onClick={() => open(item)}><div className="note-paper-top"><span>TO {item.applicant === person ? '对方' : '我'}</span><small>便笺 {String(index + 1).padStart(2,'0')} · 示例</small></div><h2>{item.title}</h2><p>{item.reason || '想和你商量这笔消费。'}</p><div className="note-amount"><span>预计花费</span><strong><small>¥</small>{money(item.amountCents)}</strong></div><div className="note-paper-bottom"><span>{statusLabels[item.status]}</span><span>看看这笔<ArrowRight size={15}/></span></div></button>)}<button className="note-history" onClick={() => setShowHistory(!showHistory)}>{showHistory ? '只看待办' : '看看以前的便笺'}<ArrowRight size={14}/></button><p className="demo-local-note">示例演示，不会实际购买。</p></>}
        {variant === 'focus' && <><div className="focus-view-switch"><button className={view === 'inbox' ? 'selected' : ''} onClick={() => go('inbox')}>待我决定</button><button className={view === 'mine' ? 'selected' : ''} onClick={() => go('mine')}>我的申请</button></div>{view === 'inbox' && focusRequest ? <><div className="focus-head"><span>这一笔，等你决定</span><p>{waiting.length ? `${waiting.length} 笔待审批` : '当前申请已处理'}</p></div><div className="focus-feature"><span className="focus-category">{focusRequest.category} · 示例申请</span><h1>{focusRequest.title}</h1><div className="focus-amount"><span>¥</span><strong>{money(focusRequest.amountCents)}</strong></div><p>{focusRequest.reason}</p><button className="focus-detail-link" onClick={() => open(focusRequest)}>完整申请<ArrowRight size={17}/></button></div>{focusRequest.status === 'pending' && <div className="focus-inline-actions"><button className="demo-secondary" onClick={() => open(focusRequest)}>暂时不买</button><button className="demo-primary" onClick={() => decide('approved','',focusRequest.id)}>同意购买<Check size={18}/></button></div>}<p className="demo-local-note">一次只决定一件事。</p></> : <div className="focus-mine"><h1>我的申请</h1>{pool.map(item => <button key={item.id} onClick={() => open(item)}><span><strong>{item.title}</strong><small>{statusLabels[item.status]}</small></span><b>¥{money(item.amountCents)}</b><ArrowRight size={17}/></button>)}</div>}</>}
        {!shown.length && variant !== 'focus' && <div className="demo-empty"><Check size={26}/><h2>暂时没有待办</h2><p>对方申请后，会出现在这里。</p></div>}
      </div>
      <nav className="demo-bottom-nav" aria-label="演示导航">{variant === 'note' ? <><button onClick={() => setScreen('new')} className="note-new"><Plus size={19}/>写一张便笺</button><button onClick={reset} className="demo-reset" aria-label="重置演示"><RotateCcw size={17}/></button></> : <><button onClick={() => go('inbox')} className={view === 'inbox' ? 'active' : ''}><Inbox size={20}/><span>审批</span></button><button className="demo-new" onClick={() => setScreen('new')} aria-label="发起申请">{variant === 'clear' ? <Plus size={24}/> : <><Plus size={18}/><span>申请</span></>}</button><button onClick={() => go('mine')} className={view === 'mine' ? 'active' : ''}><FileText size={20}/><span>我的</span></button></> }</nav>
    </>}
  </div>;
}
