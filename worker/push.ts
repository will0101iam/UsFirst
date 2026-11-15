import { buildPushPayload } from '@block65/webcrypto-web-push';
import { z } from 'zod';

export interface PushStatement {
  bind(...values: unknown[]): PushStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface PushEnv {
  DB: { prepare(sql: string): PushStatement; batch(statements: PushStatement[]): Promise<{ meta: { changes: number } }[]> };
  WEB_PUSH_KEYS?: string;
}
interface PushKeys { publicKey: string; privateKey: string }
export function pushKeys(env: PushEnv): PushKeys | null {
  try {
    const keys = JSON.parse(env.WEB_PUSH_KEYS || '') as PushKeys;
    return /^[A-Za-z0-9_-]{87}$/.test(keys.publicKey) && /^[A-Za-z0-9_-]{43}$/.test(keys.privateKey) ? keys : null;
  } catch { return null; }
}
export function validPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    // Exact provider allowlist + no redirects: clients cannot make the Worker fetch arbitrary hosts.
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
      && ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com'].includes(url.hostname);
  } catch { return false; }
}
export const subscriptionSchema = z.object({
  endpoint: z.string().max(2048).refine(validPushEndpoint),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/) }),
});
export async function validatePushKey(value: string) {
  const bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  await crypto.subtle.importKey('raw', bytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}
export type PushKind = 'request' | 'approved' | 'rejected';
export function notificationData(id: string, kind: PushKind) {
  // No names, price, title, image or decision note appear on the lock screen.
  return { title: '一起花', body: kind === 'request' ? '收到一笔新申请，点开查看。' : '你的申请有了审批结果，点开查看。', requestId: id, tag: `usfirst-${id}` };
}
export async function notifyUser(env: PushEnv, userId: string, id: string, kind: PushKind) {
  const keys = pushKeys(env);
  if (!keys) return;
  const { results } = await env.DB.prepare('SELECT p.endpoint_hash,p.endpoint,p.p256dh,p.auth,p.session_hash FROM push_subscriptions p JOIN sessions s ON s.token_hash=p.session_hash WHERE p.user_id=? AND s.user_id=? AND s.expires_at>? LIMIT 5').bind(userId, userId, Date.now()).all<{ endpoint_hash: string; endpoint: string; p256dh: string; auth: string; session_hash: string }>();
  await Promise.allSettled(results.map(async row => {
    if (!validPushEndpoint(row.endpoint)) return;
    const payload = await buildPushPayload({ data: notificationData(id, kind), options: { ttl: 3600, urgency: 'normal' } }, { endpoint: row.endpoint, expirationTime: null, keys: { p256dh: row.p256dh, auth: row.auth } }, { ...keys, subject: 'https://usfirst.sopia.work' });
    // Recheck after encryption: do not send to a logged-out or reassigned subscription.
    const active = await env.DB.prepare('SELECT 1 AS active FROM push_subscriptions p JOIN sessions s ON s.token_hash=p.session_hash WHERE p.endpoint_hash=? AND p.session_hash=? AND p.user_id=? AND s.expires_at>?').bind(row.endpoint_hash, row.session_hash, userId, Date.now()).first();
    if (!active) return;
    const response = await fetch(row.endpoint, { ...payload, redirect: 'error', signal: AbortSignal.timeout(8000) });
    await response.body?.cancel();
    if (response.status === 404 || response.status === 410) await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint_hash=? AND session_hash=?').bind(row.endpoint_hash, row.session_hash).run();
    // Best effort: no automatic resend of potentially delivered messages. No endpoint/token logs.
  }));
}
