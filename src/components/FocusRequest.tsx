import { ArrowRight, Check, ImageIcon } from 'lucide-react';
import CachedPhoto from '@/components/CachedPhoto';
// Private photos use native image loading; no CDN transform/utility bundle on startup.
import { money, people, timeLabel } from '@/lib/oa-types';
import type { IRequest } from '@/lib/oa-types';
interface FocusRequestProps { request: IRequest; onOpen(): void; onApprove(): void; onReject?: () => void; onPhoto?: () => void; busy?: boolean; readOnly?: boolean; applicantName?: string }
export default function FocusRequest({ request, onOpen, onApprove, onReject, onPhoto, busy = false, readOnly = false, applicantName }: FocusRequestProps) {
  return <section className="focus-request">
    <div className="focus-request-paper"><div className="focus-request-meta"><span>{applicantName || people[request.applicant]} · {request.category}</span><time>{timeLabel(request.createdAt)}</time></div><h2>{request.title}</h2><div className="focus-request-money"><span>¥</span><strong>{money(request.amountCents)}</strong></div><p className="focus-request-reason">{request.reason || '对方想和你商量这笔消费。'}</p>
      {request.photos.length > 0 && <button className="focus-request-photo" onClick={onPhoto || onOpen}><span className="photo-skeleton"><CachedPhoto src={request.photos[0].dataUrl} alt="申请图片预览" eager defer={900}/></span><span><ImageIcon size={16}/>{request.photos.length} 张图片，点击放大</span></button>}
      <button className="focus-request-more" onClick={onOpen}>完整申请<ArrowRight size={17}/></button>
    </div><div className="focus-request-actions"><button className="focus-secondary" disabled={busy || readOnly} onClick={onReject || onOpen}>暂时不买</button><button className="press-button" disabled={busy || readOnly} onClick={onApprove}>同意购买<Check size={19}/></button></div>
  </section>;
}
