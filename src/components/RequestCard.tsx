import { ArrowUpRight, Check, ImageIcon, RotateCw } from 'lucide-react';
import CachedPhoto from '@/components/CachedPhoto';
// Private photos use native image loading; no CDN transform/utility bundle on startup.
import { money, people, statusLabels, timeLabel } from '@/lib/oa-types';
import type { IRequest } from '@/lib/oa-types';
interface RequestCardProps { request: IRequest; onOpen(): void; onRetry?(): void; readOnly?: boolean; applicantName?: string }
export default function RequestCard({ request, onOpen, onRetry, readOnly = false, applicantName }: RequestCardProps) {
  const ready = request.status === 'approved';
  const pending = request.pendingSync;
  const failed = pending === 'failed';
  const label = pending ? failed ? '未送达 · 点按重发' : '正在送达…' : readOnly ? `上次记录：${request.status === 'approved' ? '已通过' : statusLabels[request.status]}` : statusLabels[request.status];
  return <button className={`request-card ${ready ? 'ready' : ''} ${pending ? 'sync-' + pending : ''}`} onClick={() => failed && onRetry ? onRetry() : onOpen()} aria-label={`查看${request.title}，${label}`}>
    <div className="card-kicker"><span>{applicantName || people[request.applicant]} · {request.category}</span><time>{timeLabel(request.createdAt)}</time></div>
    <div className="card-top"><h3>{request.title}</h3><strong><small>¥</small>{money(request.amountCents)}</strong></div>
    {request.reason && <p className="card-reason">{request.reason}</p>}
    {request.photos.length > 0 && <div className="card-attachment"><span className="photo-skeleton"><CachedPhoto src={request.photos[0].dataUrl} alt="申请照片预览"/></span><span><ImageIcon size={13}/>{request.photos.length} 张照片</span></div>}
    <div className="card-bottom"><span className={`request-status ${request.status} ${pending ? 'pending-sync' : ''}`}>{ready && !pending && <Check size={14}/>}{pending ? failed ? <RotateCw size={13}/> : <i className="sync-dot"/> : <i/>}{label}</span><span className="card-open">{pending ? failed ? '重发' : '已发出' : request.status === 'pending' ? '查看申请' : '查看详情'}{pending && !failed ? null : <ArrowUpRight size={15}/>}</span></div>
  </button>;
}
