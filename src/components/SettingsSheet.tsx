import { useEffect, useRef, useState } from 'react';
import { snapshotGeneration } from '@/lib/home-snapshot';
import { LogOut, Bell } from 'lucide-react';
import AppSheet from '@/components/AppSheet';
import { disablePush, enablePush, pushState } from '@/lib/push-notifications';
import type { SessionState } from '@/lib/api';
export default function SettingsSheet({ session, onClose, onLogout, readOnly = false, canWrite }: { session: SessionState; onClose(): void; onLogout(): Promise<void>; readOnly?: boolean; canWrite(): boolean }) {
  const generation = useRef(snapshotGeneration());
  const sameAccount = () => generation.current === snapshotGeneration();
  const current = () => sameAccount() && canWrite();
  const [busy, setBusy] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [notificationNote, setNotificationNote] = useState('');
  useEffect(() => {
    let active = true;
    void pushState().then(state => { if (active) { setEnabled(state.enabled); if (!state.supported) setNotificationNote('请先添加到 iPhone 主屏幕，再从图标打开一起花。'); } }).catch(() => { if (active) setNotificationNote('通知状态读取失败，可重新打开设置确认。'); });
    return () => { active = false; };
  }, []);
  async function toggleNotifications() {
    if (!current()) { setNotificationNote('请先完成同步，再设置通知。'); return; }
    setNotificationBusy(true); setNotificationNote('');
    try { if (enabled) await disablePush(); else await enablePush(sameAccount); setEnabled(!enabled); setNotificationNote(enabled ? '本设备通知已关闭。' : '已开启：新申请和审批结果会通知你。'); }
    catch (error) { setNotificationNote(error instanceof Error ? error.message : '通知设置失败，请重试。'); }
    finally { setNotificationBusy(false); }
  }
  async function logout() { setBusy(true); try { await onLogout(); } finally { setBusy(false); } }
  return <AppSheet open onClose={onClose} busy={busy || notificationBusy} title="我们" description="一起花 · UsFirst" footer={<button className="focus-secondary account-submit" disabled={busy || notificationBusy} onClick={() => void logout()}><LogOut size={17}/>退出登录</button>}><div className="settings-facts"><div><span>我的昵称</span><strong>{session.user?.displayName}</strong></div><div><span>我的账号</span><strong>{session.user?.username}</strong></div><div><span>已连接</span><strong>{session.pair?.partnerName || '尚未连接'}</strong></div></div>
    <section className="settings-install"><h3>消息通知</h3><p>只提醒新申请和审批结果。锁屏不显示商品、金额或图片。</p><button className="focus-secondary account-submit" disabled={readOnly || busy || notificationBusy} onClick={() => void toggleNotifications()}><Bell size={17}/>{notificationBusy ? '正在设置…' : enabled ? '关闭本设备通知' : '开启通知'}</button>{readOnly && <p>请先完成同步，再设置通知。</p>}{notificationNote && <p role="status">{notificationNote}</p>}</section>
    <section className="settings-install"><h3>添加到 iPhone 主屏幕</h3><p>在 Safari 打开一起花，点击分享，选择「添加到主屏幕」。</p></section><section className="settings-install"><h3>图片识别</h3><p>选择图片会发送给 OpenRouter 的 Qwen3.7 Flash，用于提取申请字段；核对后再提交。{!session.recognitionAvailable && '当前服务密钥未配置，可手动填写。'}</p></section><p className="settings-footnote">一起花只记录审批与购买状态，不会代你下单或阻止购物平台付款。请妥善保存密码，目前不提供密码找回。</p></AppSheet>;
}
