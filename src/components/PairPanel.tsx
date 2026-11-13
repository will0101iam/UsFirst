import { useState } from 'react';
import { ArrowRight, Copy, LoaderCircle, Link } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { SessionState } from '@/lib/api';
export default function PairPanel({ onSession }: { onSession(value: SessionState): void }) {
  const [invite, setInvite] = useState(''); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function generate() { if (busy) return; setBusy(true); setError(''); try { const value = await api<{ code: string }>('/invites', {}); setInvite(value.code); } catch (value) { setError(value instanceof Error ? value.message : '生成失败'); } finally { setBusy(false); } }
  async function join(event: React.FormEvent) { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { onSession(await api<SessionState>('/invites/join', { code: code.replace(/[\s-]/g, '').toUpperCase() })); toast.success('连接成功'); } catch (value) { setError(value instanceof Error ? value.message : '连接失败'); } finally { setBusy(false); } }
  async function copy() { try { await navigator.clipboard.writeText(invite); toast.success('邀请码已复制'); } catch { toast.error('请长按邀请码复制'); } }
  return <section className="pair-panel"><div className="pair-symbol"><Link size={28}/></div><h1>连接彼此</h1><p>一人生成邀请码，另一人输入。<br/>连接后，你们的申请交给彼此审批。</p>
    <div className="pair-invite">{invite ? <><small>邀请码 · 24 小时有效</small><code className="invite-code">{invite.slice(0, 8)}<wbr/>{invite.slice(8)}</code><button onClick={() => void copy()} className="pair-copy"><Copy size={16}/>复制邀请码</button><button disabled={busy} onClick={() => void generate()} className="account-switch">重新生成</button></> : <button className="press-button account-submit" disabled={busy} onClick={() => void generate()}>{busy && <LoaderCircle className="animate-spin" size={18}/>}生成我的邀请码</button>}</div>
    <div className="pair-divider"><span>或输入对方的邀请码</span></div><form onSubmit={join} className="account-form"><label className="sr-only" htmlFor="pair-code">对方的邀请码</label><input id="pair-code" value={code} onChange={e => setCode(e.target.value)} placeholder="粘贴邀请码" required maxLength={40} autoCapitalize="characters" autoComplete="off" spellCheck={false} disabled={busy}/><button type="submit" className="press-button account-submit" disabled={busy || code.replace(/[\s-]/g, '').length !== 16}>{busy && <LoaderCircle size={18} className="animate-spin"/>}连接对方<ArrowRight size={18}/></button></form>
    {error && <p className="account-error" role="alert">{error}</p>}
  </section>;
}
