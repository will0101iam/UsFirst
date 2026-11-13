import { useState } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api';
import type { SessionState } from '@/lib/api';
export default function AuthPanel({ onSession }: { onSession(value: SessionState): void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try { const result = await api<SessionState>(`/auth/${mode}`, { username: username.trim(), password, ...(mode === 'register' ? { displayName: displayName.trim() } : {}) }); setPassword(''); onSession(result); }
    catch (value) { setError(value instanceof Error ? value.message : '登录失败，请重试'); }
    finally { setBusy(false); }
  }
  return <section className="auth-panel"><p className="auth-eyebrow">UsFirst</p><h1>{mode === 'login' ? '欢迎回来' : '从我们开始'}</h1><p className="auth-subtitle">{mode === 'login' ? '登录一起花' : '注册后，用邀请码连接对方'}</p>
    <form onSubmit={submit} className="account-form">
      {mode === 'register' && <label>昵称<input value={displayName} onChange={e => setDisplayName(e.target.value)} required maxLength={20} autoComplete="nickname" placeholder="对方眼中的你" disabled={busy}/></label>}
      <label>账号<input value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}" autoCapitalize="none" autoCorrect="off" autoComplete="username" placeholder="英文、数字或下划线" disabled={busy}/></label>
      <label>密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === 'register' ? 10 : 1} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder={mode === 'register' ? '至少 10 位' : '输入密码'} disabled={busy}/></label>
      {error && <p className="account-error" role="alert">{error}</p>}
      <button type="submit" className="press-button account-submit" disabled={busy}>{busy ? <LoaderCircle size={18} className="animate-spin"/> : null}{mode === 'login' ? '登录' : '创建账号'}<ArrowRight size={18}/></button>
    </form>
    <button className="account-switch" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setPassword(''); }}>{mode === 'login' ? '还没账号？注册' : '已有账号？登录'}</button>
  </section>;
}
