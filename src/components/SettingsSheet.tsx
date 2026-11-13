import { useState } from 'react';
import { LogOut } from 'lucide-react';
import AppSheet from '@/components/AppSheet';
import type { SessionState } from '@/lib/api';
export default function SettingsSheet({ session, onClose, onLogout }: { session: SessionState; onClose(): void; onLogout(): Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function logout() { setBusy(true); try { await onLogout(); } finally { setBusy(false); } }
  return <AppSheet open onClose={onClose} busy={busy} title="我们" description="一起花 · UsFirst" footer={<button className="focus-secondary account-submit" disabled={busy} onClick={() => void logout()}><LogOut size={17}/>退出登录</button>}><div className="settings-facts"><div><span>我的昵称</span><strong>{session.user?.displayName}</strong></div><div><span>我的账号</span><strong>{session.user?.username}</strong></div><div><span>已连接</span><strong>{session.pair?.partnerName || '尚未连接'}</strong></div></div><section className="settings-install"><h3>添加到 iPhone 主屏幕</h3><p>在 Safari 打开一起花，点击分享，选择「添加到主屏幕」。</p></section><section className="settings-install"><h3>图片识别</h3><p>选择图片会发送给 OpenRouter 的 Qwen3.7 Flash，用于提取申请字段；核对后再提交。{!session.recognitionAvailable && '当前服务密钥未配置，可手动填写。'}</p></section><p className="settings-footnote">一起花只记录审批与购买状态，不会代你下单或阻止购物平台付款。请妥善保存密码，目前不提供密码找回。</p></AppSheet>;
}
