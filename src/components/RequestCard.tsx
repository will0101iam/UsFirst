import { ArrowUpRight, Check, ImageIcon } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { money, people, statusLabels, timeLabel } from '@/lib/oa-types';
import type { IRequest } from '@/lib/oa-types';
interface RequestCardProps { request: IRequest; onOpen(): void }
export default function RequestCard({ request, onOpen }: RequestCardProps) {
  const ready = request.status === 'approved';
  return <button className={`request-card ${ready ? 'ready' : ''}`} onClick={onOpen} aria-label={`查看${request.title}，${statusLabels[request.status]}`}>
    <div className="card-kicker"><span>{people[request.applicant]} · {request.category}{request.sample && ' · 示例'}</span><time>{timeLabel(request.createdAt)}</time></div>
    <div className="card-top"><h3>{request.title}</h3><strong><small>¥</small>{money(request.amountCents)}</strong></div>
    {request.reason && <p className="card-reason">{request.reason}</p>}
    {request.photos.length > 0 && <div className="card-attachment"><Image src={request.photos[0].dataUrl} alt="申请照片预览"/><span><ImageIcon size={13}/>{request.photos.length} 张照片</span></div>}
    <div className="card-bottom"><span className={`request-status ${request.status}`}>{ready && <Check size={14}/>}<i/>{statusLabels[request.status]}</span><span className="card-open">{request.status === 'pending' ? '查看申请' : '查看详情'}<ArrowUpRight size={15}/></span></div>
  </button>;
}
