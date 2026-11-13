import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import AppSheet from '@/components/AppSheet';
import { money } from '@/lib/oa-types';
import type { IRequest } from '@/lib/oa-types';
export default function RejectSheet({ request, busy, onClose, onConfirm }: { request: IRequest; busy: boolean; onClose(): void; onConfirm(note: string): Promise<void> }) {
  const [note, setNote] = useState('');
  return <AppSheet open title="这次先不买" description={`${request.title} · ¥${money(request.amountCents)}`} busy={busy} onClose={onClose} footer={<button className="press-button account-submit" disabled={busy} onClick={() => void onConfirm(note.trim())}>{busy && <LoaderCircle size={18} className="animate-spin"/>}确认不买</button>}><div className="reason-field"><label htmlFor="reject-note">给对方留句话 <small>选填</small></label><textarea id="reject-note" value={note} onChange={event => setNote(event.target.value)} rows={3} maxLength={200} placeholder="这次先等等" disabled={busy}/></div></AppSheet>;
}
