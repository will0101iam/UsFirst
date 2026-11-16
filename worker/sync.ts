// New opt-in protocol. Old /bootstrap and /requests remain compatible.
interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
export interface SyncDB { prepare(sql: string): Statement }
export interface PageRow { id: string; created_at: number; photo_metadata: string; [key: string]: unknown }
export interface SyncBundle { version: number; rows: string; removed: string }
const metadata = `(SELECT json_group_array(json_object('id',p.id,'name',p.name)) FROM photos p WHERE p.request_id=r.id ORDER BY p.id)`;
// A single SQLite read snapshot captures both the version and matching data.
// Never stamp data selected before a write with a version read after that write.
export async function readSync(db: SyncDB, pairId: string, since: number | null, userId: string): Promise<SyncBundle> {
  const selection = since === null
    ? `SELECT r.*,${metadata} AS photo_metadata FROM requests r WHERE r.pair_id=? AND (r.id IN (SELECT id FROM requests WHERE pair_id=? ORDER BY created_at DESC,id DESC LIMIT 30) OR r.id IN (SELECT id FROM requests WHERE pair_id=? AND applicant_id=? AND status='pending' ORDER BY created_at DESC,id DESC LIMIT 30) OR r.id IN (SELECT id FROM requests WHERE pair_id=? AND applicant_id<>? AND status='pending' ORDER BY created_at DESC,id DESC LIMIT 30) OR r.id IN (SELECT id FROM requests WHERE pair_id=? AND applicant_id=? AND status='approved' ORDER BY created_at DESC,id DESC LIMIT 30) OR r.id IN (SELECT id FROM requests WHERE pair_id=? AND applicant_id<>? AND status='approved' ORDER BY created_at DESC,id DESC LIMIT 30)) ORDER BY r.created_at DESC,r.id DESC`
    : `SELECT r.*,${metadata} AS photo_metadata FROM requests r WHERE r.pair_id=? AND r.change_version>? ORDER BY r.created_at DESC,r.id DESC LIMIT 301`;
  const rowJson = `json_object('id',id,'pair_id',pair_id,'applicant_id',applicant_id,'title',title,'amount_cents',amount_cents,'category',category,'reason',reason,'status',status,'created_at',created_at,'decided_at',decided_at,'purchased_at',purchased_at,'decision_note',decision_note,'photo_metadata',photo_metadata)`;
  const sql = `SELECT sync_version AS version,(SELECT json_group_array(${rowJson}) FROM (${selection})) AS rows,(SELECT json_group_array(request_id) FROM (SELECT request_id FROM request_tombstones WHERE pair_id=? AND change_version>? LIMIT 301)) AS removed FROM pairs WHERE id=?`;
  const args = since === null ? [pairId,pairId,pairId,userId,pairId,userId,pairId,userId,pairId,userId,pairId,-1,pairId] : [pairId,since,pairId,since,pairId];
  const result = await db.prepare(sql).bind(...args).first<SyncBundle>();
  if (!result) throw new Error('Pair missing');
  return result;
}
export async function historyPage(db: SyncDB, pairId: string, userId: string, params: URLSearchParams) {
  const view = params.get('view') || 'mine', filter = params.get('filter') || 'all';
  if (!['mine','inbox'].includes(view) || !['all','pending','approved','closed'].includes(filter)) throw new Error('Invalid page');
  const raw = params.get('cursor');
  let cursor: { time: number; id: string } | null = null;
  if (raw) {
    const match = raw.match(/^(\d{1,16}):([a-f0-9-]{36})$/);
    if (!match || !Number.isSafeInteger(Number(match[1]))) throw new Error('Invalid cursor');
    cursor = { time: Number(match[1]), id: match[2] };
  }
  const status = filter === 'all' ? '' : filter === 'closed' ? " AND r.status IN ('rejected','cancelled','purchased')" : ' AND r.status=?';
  const sql = `SELECT (SELECT json_group_array(json_object('id',id,'pair_id',pair_id,'applicant_id',applicant_id,'title',title,'amount_cents',amount_cents,'category',category,'reason',reason,'status',status,'created_at',created_at,'decided_at',decided_at,'purchased_at',purchased_at,'decision_note',decision_note,'photo_metadata',photo_metadata)) FROM (SELECT r.*,${metadata} AS photo_metadata FROM requests r WHERE r.pair_id=? AND r.applicant_id${view === 'mine' ? '=' : '<>'}?${status}${cursor ? ' AND (r.created_at<? OR (r.created_at=? AND r.id<?))' : ''} ORDER BY r.created_at DESC,r.id DESC LIMIT 31)) AS rows`;
  const args: unknown[] = [pairId,userId];
  if (filter === 'pending' || filter === 'approved') args.push(filter);
  if (cursor) args.push(cursor.time,cursor.time,cursor.id);
  const result = await db.prepare(sql).bind(...args).first<{ rows: string }>();
  const rows = JSON.parse(result?.rows || '[]') as PageRow[];
  const more = rows.length > 30; rows.length = Math.min(rows.length,30);
  const last = rows.at(-1);
  return { rows, cursor: more && last ? `${last.created_at}:${last.id}` : null };
}
