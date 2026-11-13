import { useState } from 'react';
import { Check, ArrowUpRight, ArrowLeft } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { money, people, otherPerson, statusLabels, timeLabel } from '@/lib/oa-types';
import type { IRequest, Person, Status } from '@/lib/oa-types';
interface DemoDetailProps { request: IRequest; person: Person; onDecide(status: Status, note?: string): void; compact?: boolean }
export default function DemoDetail({ request, person, onDecide, compact = false }: DemoDetailProps) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const canDecide = request.applicant !== person && request.status === 'pending';
  const mine = request.applicant === person;
  return <div className={`demo-detail ${compact ? 'compact' : ''}`}>
    <div className="demo-detail-body">
      <div className="demo-detail-meta">{people[request.applicant]}的申请 <span>{request.category} · 示例</span></div>
      <h2>{request.title}</h2><div className="demo-detail-money"><small>¥</small>{money(request.amountCents)}</div>
      <span className={`demo-state ${request.status}`}>{statusLabels[request.status]}</span>
      {request.reason && <p className="demo-detail-reason">{request.reason}</p>}
      {request.photos.length > 0 && <div className="demo-photo-grid">{request.photos.map((picture,i) => <button key={`${picture.name}-${i}`} onClick={() => setPhoto(picture.dataUrl)} aria-label={`放大照片 ${i + 1}`}><Image src={picture.dataUrl} alt={`申请照片 ${i + 1}`}/></button>)}</div>}
      <dl><div><dt>审批人</dt><dd>{people[otherPerson(request.applicant)]}</dd></div><div><dt>申请时间</dt><dd>{timeLabel(request.createdAt)}</dd></div>{request.decisionNote && <div><dt>对方留言</dt><dd>{request.decisionNote}</dd></div>}</dl>
      {canDecide && <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={rejecting ? '为什么先不买？（选填）' : '给对方留句话（选填）'} maxLength={200} rows={2} aria-label="审批留言"/>}
    </div>
    <div className="demo-decision-footer">
      {canDecide ? <div className="demo-decision-buttons">{rejecting ? <><button onClick={() => setRejecting(false)} className="demo-secondary"><ArrowLeft size={16}/>返回</button><button onClick={() => onDecide('rejected',note.trim())} className="demo-danger">确认不通过</button></> : <><button onClick={() => setRejecting(true)} className="demo-secondary">暂时不买</button><button onClick={() => onDecide('approved',note.trim())} className="demo-primary">同意购买<Check size={18}/></button></>}</div> : mine && request.status === 'approved' ? <button onClick={() => onDecide('purchased')} className="demo-primary">我已购买<Check size={18}/></button> : mine && request.status === 'pending' ? <button className="demo-secondary" onClick={() => onDecide('cancelled')}>撤回申请</button> : <p className="demo-completed"><Check size={17}/>{statusLabels[request.status]}</p>}
      <small>{request.status === 'pending' ? '同意后，再购买。' : '仅演示，不会实际下单或付款。'}</small>
    </div>
    {photo && <div className="demo-lightbox" role="dialog" aria-label="放大的照片"><button onClick={() => setPhoto(null)}><ArrowUpRight size={16}/>关闭照片</button><Image src={photo} alt="放大的申请照片"/></div>}
  </div>;
}
