import type { SessionState } from './api';
import type { IRequest } from './oa-types';
export const snapshotKey = 'usfirst:snapshot:v1';
export const snapshotGenerationKey = 'usfirst:snapshot-generation:v1';
const ttl = 24 * 60 * 60 * 1000;
export interface HomeSnapshot { version: 1; account: string; savedAt: number; session: SessionState; requests: IRequest[] }
function store(): Storage | undefined { try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; } }
function text(value: unknown, limit: number): value is string { return typeof value === 'string' && value.length <= limit; }
function validRequest(value: unknown): value is IRequest {
  if (!value || typeof value !== 'object') return false;
  const r = value as IRequest;
  return text(r.id, 64) && text(r.title, 60) && text(r.reason, 300) && ['me', 'partner'].includes(r.applicant)
    && ['pending', 'approved', 'rejected', 'purchased', 'cancelled'].includes(r.status) && ['网购', '外卖', '其他'].includes(r.category)
    && Number.isInteger(r.amountCents) && r.amountCents > 0 && r.amountCents <= 99999999
    && text(r.createdAt, 40) && Number.isFinite(Date.parse(r.createdAt))
    && (r.decidedAt === undefined || (text(r.decidedAt, 40) && Number.isFinite(Date.parse(r.decidedAt))))
    && (r.purchasedAt === undefined || (text(r.purchasedAt, 40) && Number.isFinite(Date.parse(r.purchasedAt))))
    && (r.decisionNote === undefined || text(r.decisionNote, 200));
}
function withoutPhotos(r: IRequest): IRequest {
  return { id: r.id, title: r.title, reason: r.reason, applicant: r.applicant, category: r.category, amountCents: r.amountCents, status: r.status, createdAt: r.createdAt, photos: [],
    ...(r.decidedAt ? { decidedAt: r.decidedAt } : {}), ...(r.purchasedAt ? { purchasedAt: r.purchasedAt } : {}), ...(r.decisionNote ? { decisionNote: r.decisionNote } : {}) };
}
export function snapshotGeneration(): string { try { return store()?.getItem(snapshotGenerationKey) || ''; } catch { return ''; } }
export function clearHomeSnapshot(reason = 'change'): void {
  try { if (reason === 'invalid' && !store()?.getItem(snapshotKey)) return; store()?.removeItem(snapshotKey); store()?.setItem(snapshotGenerationKey, reason + ':' + crypto.randomUUID()); } catch { /* Storage unavailable: online flow remains usable. */ }
}
export function readHomeSnapshot(): HomeSnapshot | null {
  try {
    const raw = store()?.getItem(snapshotKey); if (!raw) return null;
    if (raw.length > 300000) throw new Error('Oversized snapshot');
    const s = JSON.parse(raw) as HomeSnapshot;
    const user = s?.session?.user, pair = s?.session?.pair;
    if (s.version !== 1 || !user || !pair || !/^[a-z0-9_]{3,32}$/.test(user.username) || s.account !== user.username
      || !text(user.displayName, 20) || !text(pair.partnerName, 20) || !Number.isFinite(s.savedAt) || s.savedAt > Date.now() + 60000 || Date.now() - s.savedAt > ttl
      || !Array.isArray(s.requests) || s.requests.length > 300 || !s.requests.every(validRequest)) throw new Error('Invalid snapshot');
    return { version: 1, account: user.username, savedAt: s.savedAt, session: { user: { username: user.username, displayName: user.displayName }, pair: { partnerName: pair.partnerName }, recognitionAvailable: false }, requests: s.requests.map(withoutPhotos) };
  } catch { clearHomeSnapshot(); return null; }
}
export function saveHomeSnapshot(session: SessionState, requests: IRequest[], generation: string): void {
  if (generation !== snapshotGeneration()) return;
  if (!session.user || !session.pair) { clearHomeSnapshot(); return; }
  if (requests.length > 300 || !requests.every(validRequest)) return;
  const value: HomeSnapshot = { version: 1, account: session.user.username, savedAt: Date.now(), session: { user: { username: session.user.username, displayName: session.user.displayName }, pair: { partnerName: session.pair.partnerName }, recognitionAvailable: false }, requests: requests.map(withoutPhotos) };
  try { const raw = JSON.stringify(value); if (raw.length <= 300000) store()?.setItem(snapshotKey, raw); } catch { /* Quota/storage failure never changes server-confirmed results. */ }
}
