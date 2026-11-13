import { useState } from 'react';
import { Check, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import PhotoViewer from '@/components/PhotoViewer';
import AppSheet from '@/components/AppSheet';
import { people, statusLabels, money, timeLabel, otherPerson } from '@/lib/oa-types';
import type { IRequest, Person, Status } from '@/lib/oa-types';
interface RequestDetailProps { request: IRequest; person: Person; onClose(): void; onUpdate(id: string, status: Status, note?: string): void; onReject?: () => void; busy?: boolean; partnerName?: string }
export default function RequestDetail({ request, person, onClose, onUpdate, onReject, busy = false, partnerName }: RequestDetailProps) {
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const isMine = request.applicant === person;
  const canDecide = !isMine && request.status === 'pending';
  const photo = photoIndex === null ? undefined : request.photos[photoIndex];
  const caption = request.status === 'pending' ? `等待${isMine ? partnerName || '对方' : '我'}同意` : request.status === 'rejected' ? '这次先不购买，可重新发起申请' : request.status === 'cancelled' ? '已撤回，不再等待审批' : request.status === 'purchased' ? '已标记购买' : '对方已同意，可以购买';
  const footer = canDecide ? <>
    <div className="decision-actions">{rejecting ? <><Button disabled={busy} variant="outline" onClick={() => setRejecting(false)}>返回</Button><Button disabled={busy} variant="destructive" onClick={() => onUpdate(request.id, 'rejected', note.trim())}>确认不通过</Button></> : <><Button disabled={busy} variant="outline" onClick={() => { if (onReject) onReject(); else { setRejecting(true); setNoteOpen(true); } }}>暂时不买</Button><Button disabled={busy} className="press-button" onClick={() => onUpdate(request.id, 'approved', note.trim())}>同意购买<Check size={18}/></Button></>}</div>
    <p className="action-caption">{rejecting ? '不通过后，对方需要重新申请' : '同意后，对方才可以标记购买'}</p>
  </> : isMine && request.status === 'approved' ? <><Button disabled={busy} className="primary-action" onClick={() => onUpdate(request.id, 'purchased')}>我已购买<ArrowRight size={18}/></Button><p className="action-caption">只记录状态，不会实际下单或付款</p></> : isMine && request.status === 'pending' ? <><p className="action-caption pending-caption">审批通过前，先不购买。</p><Button disabled={busy} variant="outline" className="primary-action secondary-action" onClick={() => onUpdate(request.id, 'cancelled')}>撤回申请</Button></> : undefined;
  return <>
    <AppSheet open busy={busy} title="申请详情" description={`${isMine ? '我' : partnerName || '对方'}发起 · ${request.category}`} onClose={onClose} footer={footer}>
      <div className="detail-main"><h2>{request.title}</h2><div className="detail-amount"><span>¥</span><strong>{money(request.amountCents)}</strong></div><span className={`request-status ${request.status}`}><i/>{statusLabels[request.status]}</span></div>
      {request.reason && <p className="detail-reason">{request.reason}</p>}
      {request.photos.length > 0 && <section className="detail-photos"><div className="field-heading"><span>申请照片</span><small>点击放大</small></div><div className="detail-photo-grid">{request.photos.map((picture, i) => <button key={`${picture.name}-${i}`} onClick={() => setPhotoIndex(i)} aria-label={`放大申请照片 ${i + 1}`}><Image src={picture.dataUrl} alt={`申请照片 ${i + 1}`}/><ArrowUpRight size={14}/></button>)}</div></section>}
      <dl className="detail-facts"><div><dt>审批人</dt><dd>{isMine ? partnerName || '对方' : '我'}</dd></div><div><dt>申请时间</dt><dd>{timeLabel(request.createdAt)}</dd></div><div><dt>当前进展</dt><dd>{caption}</dd></div>{request.decidedAt && <div><dt>{request.status === 'cancelled' ? '撤回时间' : '审批时间'}</dt><dd>{timeLabel(request.decidedAt)}</dd></div>}{request.purchasedAt && <div><dt>购买标记</dt><dd>{timeLabel(request.purchasedAt)}</dd></div>}</dl>
      {request.decisionNote && <blockquote className="decision-note"><span>对方的留言</span><p>{request.decisionNote}</p></blockquote>}
      {canDecide && <section className="reason-field">{!noteOpen ? <button className="add-reason" onClick={() => setNoteOpen(true)}>给对方留句话<span>选填</span></button> : <><label htmlFor="decision-note">{rejecting ? '为什么先不买？' : '给对方留句话'} <small>选填</small></label><textarea id="decision-note" value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={200} placeholder={rejecting ? '例如：这次先等等。' : '例如：好呀，买吧。'}/></>}</section>}
    </AppSheet>
    {photoIndex !== null && <PhotoViewer photos={request.photos} index={photoIndex} onClose={() => setPhotoIndex(null)}/>}
  </>;
}
