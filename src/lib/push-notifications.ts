import { api } from './api';
export function pushSupported() {
  return typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}
function bounded<T>(work: Promise<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('通知设置超时，请重新打开设置确认状态。')), ms);
    work.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
async function activated(registration: ServiceWorkerRegistration) {
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) throw new Error('通知组件尚未就绪，请稍后重试。');
  if (worker.state === 'activated') return;
  await bounded(new Promise<void>((resolve, reject) => {
    const changed = () => {
      if (worker.state === 'activated' || worker.state === 'redundant') {
        worker.removeEventListener('statechange', changed);
        if (worker.state === 'activated') resolve(); else reject(new Error('通知组件更新失败，请稍后重新开启。'));
      }
    };
    worker.addEventListener('statechange', changed); changed();
  }), 30000);
}
export async function pushState() {
  if (!pushSupported()) return { enabled: false, supported: false };
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return { supported: true, enabled: false };
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(subscription.endpoint))), b => b.toString(16).padStart(2, '0')).join('');
  const state = await api<{ enabled: boolean }>('/push/status?endpointHash=' + hash);
  return { supported: true, enabled: state.enabled && Notification.permission === 'granted' };
}
export async function enablePush(current: () => boolean = () => true) {
  const guard = () => { if (!current()) throw new Error('账号或同步状态已变化，请重新打开通知设置。'); };
  guard();
  if (!pushSupported()) throw new Error('请从 iPhone 主屏幕打开一起花，再开启通知。');
  // Permission MUST be requested synchronously from the button's click, before network awaits.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('未获得通知权限。可在 iPhone 设置 → 通知中允许一起花。');
  guard();
  const config = await api<{ available: boolean; publicKey: string | null }>('/push/config');
  guard();
  if (!config.available || !config.publicKey) throw new Error('通知服务暂不可用，请稍后重试。');
  const registration = await bounded(navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }));
  await bounded(registration.update());
  await activated(registration);
  guard();
  const previous = await registration.pushManager.getSubscription();
  // Recreate on explicit opt-in so a prior account/key cannot silently stay bound.
  if (previous && !(await bounded(previous.unsubscribe()))) throw new Error('旧通知订阅未能关闭，请稍后重试。');
  const key = Uint8Array.from(atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const subscription = await bounded(registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  // If this POST times out, keep the subscription; reopening settings checks actual server status.
  guard();
  await api('/push/subscribe', { subscription: subscription.toJSON() });
}
export async function disablePush() {
  await api('/push/unsubscribe', {});
  await stopDevicePush();
}
export async function stopDevicePush() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription && !(await bounded(subscription.unsubscribe(), 5000))) throw new Error('本设备通知未能关闭');
  const notifications = await registration?.getNotifications();
  notifications?.forEach(notification => notification.close());
}
