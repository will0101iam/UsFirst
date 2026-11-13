import { z } from 'zod';
import { recognitionConfig, recognitionPrompt } from '../src/lib/recognition-config';
import { parseRecognitionResult } from '../src/lib/image-recognition-contract';

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
interface Env {
  DB: { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<{ meta: { changes: number } }[]> };
  ASSETS: { fetch(request: Request): Promise<Response> };
  OPENROUTER_API_KEY?: string;
}
interface User { id: string; username: string; display_name: string }
interface Pair { id: string; partner_id: string; partner_name: string }
interface RequestRow {
  id: string; pair_id: string; applicant_id: string; title: string; amount_cents: number;
  category: '网购' | '外卖' | '其他'; reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'purchased' | 'cancelled';
  created_at: number; decided_at: number | null; purchased_at: number | null; decision_note: string | null;
}
const encoder = new TextEncoder();
const cookieName = 'usfirst_session';
const photoSchema = z.object({ name: z.string().max(255), dataUrl: z.string().max(900000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/) });
const photosSchema = z.array(photoSchema).max(3).superRefine((photos, ctx) => {
  for (const photo of photos) {
    try {
      const raw = atob(photo.dataUrl.split(',')[1]);
      if (raw.charCodeAt(0) !== 255 || raw.charCodeAt(1) !== 216 || raw.charCodeAt(2) !== 255) ctx.addIssue({ code: 'custom', message: '不是有效的 JPEG 图片' });
    } catch { ctx.addIssue({ code: 'custom', message: '图片编码无效' }); }
  }
});
const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/);
const passwordSchema = z.string().min(10).max(128);
const registerSchema = z.object({ username: usernameSchema, password: passwordSchema, displayName: z.string().trim().min(1).max(20) });
const loginSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(128) });
const createSchema = z.object({
  id: z.string().uuid(), title: z.string().trim().min(1).max(60), amountCents: z.number().int().min(1).max(99999999),
  category: z.enum(['网购', '外卖', '其他']), reason: z.string().trim().max(300), photos: photosSchema,
});
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const random = (bytes = 32) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join(''); }
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
}
function same(a: string, b: string) { let value = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) value |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return value === 0; }
function json(data: unknown, status = 200, cookie?: string) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
  if (cookie) headers.set('Set-Cookie', cookie);
  return new Response(JSON.stringify(data), { status, headers });
}
function sessionCookie(request: Request, token: string, maxAge: number) {
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
async function readBody(request: Request, limit = 4700000): Promise<unknown> {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError(415, '请求格式不正确');
  if (Number(request.headers.get('Content-Length')) > limit) throw new HttpError(413, '图片或内容过大');
  const reader = request.body?.getReader(); if (!reader) throw new HttpError(400, '请求内容为空');
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new HttpError(413, '图片或内容过大'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let at = 0; for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HttpError(400, '请求内容无效'); }
}
async function rate(env: Env, identity: string, name: string, max: number, seconds: number) {
  const now = Math.floor(Date.now() / 1000); const period = Math.floor(now / seconds);
  const key = `${name}:${await digest(identity)}:${period}`;
  await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').bind(key, (period + 1) * seconds).run();
  const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE key=?').bind(key).first<{ count: number }>();
  if (!row || row.count > max) throw new HttpError(429, '操作太频繁，请稍后再试');
}
async function currentUser(request: Request, env: Env): Promise<User | null> {
  const token = request.headers.get('Cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return env.DB.prepare('SELECT u.id,u.username,u.display_name FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token), Date.now()).first<User>();
}
async function pairFor(user: User, env: Env) {
  return env.DB.prepare('SELECT m.pair_id AS id, u.id AS partner_id, u.display_name AS partner_name FROM members m JOIN members other ON other.pair_id=m.pair_id AND other.user_id<>m.user_id JOIN users u ON u.id=other.user_id WHERE m.user_id=?').bind(user.id).first<Pair>();
}
async function sessionState(user: User | null, env: Env) {
  if (!user) return { user: null, pair: null, recognitionAvailable: false };
  const pair = await pairFor(user, env);
  return { user: { username: user.username, displayName: user.display_name }, pair: pair ? { partnerName: pair.partner_name } : null, recognitionAvailable: !!env.OPENROUTER_API_KEY };
}
async function newSession(request: Request, user: User, env: Env) {
  const token = random(); const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now),
    env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(Math.floor(now / 1000)),
    env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token), user.id, now + 30 * 86400000),
  ]);
  return json(await sessionState(user, env), 200, sessionCookie(request, token, 30 * 86400));
}
function requestData(row: RequestRow, user: User, photos: { id: string; name: string }[]) {
  return { id: row.id, applicant: row.applicant_id === user.id ? 'me' : 'partner', title: row.title, amountCents: row.amount_cents,
    category: row.category, reason: row.reason, status: row.status, createdAt: new Date(row.created_at).toISOString(),
    ...(row.decided_at ? { decidedAt: new Date(row.decided_at).toISOString() } : {}), ...(row.purchased_at ? { purchasedAt: new Date(row.purchased_at).toISOString() } : {}),
    ...(row.decision_note ? { decisionNote: row.decision_note } : {}), photos: photos.map(photo => ({ name: photo.name, dataUrl: `/api/photos/${photo.id}` })) };
}

async function api(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname; const method = request.method;
  if (!['GET', 'POST'].includes(method)) throw new HttpError(405, '不支持的操作');
  if (method === 'POST') {
    const origin = request.headers.get('Origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('X-UsFirst') !== '1' || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new HttpError(403, '请求来源不正确');
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  if (path === '/api/health' && method === 'GET') return json({ ok: true, service: 'UsFirst' });
  if ((path === '/api/auth/register' || path === '/api/auth/login') && method === 'POST') {
    await rate(env, ip, 'auth-ip', 20, 900);
    const raw = await readBody(request, 4096);
    const value = (path.endsWith('register') ? registerSchema : loginSchema).parse(raw);
    await rate(env, value.username, 'auth-name', 10, 900);
    if (path.endsWith('register')) {
      await rate(env, ip, 'register', 5, 86400);
      const input = registerSchema.parse(raw); const salt = random(16); const id = crypto.randomUUID();
      const hash = await passwordHash(input.password, salt);
      const result = await env.DB.prepare('INSERT OR IGNORE INTO users(id,username,display_name,password_hash,salt,created_at) VALUES(?,?,?,?,?,?)').bind(id, input.username, input.displayName, hash, salt, Date.now()).run();
      if (!result.meta.changes) throw new HttpError(409, '这个账号名已被使用');
      return newSession(request, { id, username: input.username, display_name: input.displayName }, env);
    }
    const found = await env.DB.prepare('SELECT id,username,display_name,password_hash,salt FROM users WHERE username=?').bind(value.username).first<User & { password_hash: string; salt: string }>();
    const calculated = await passwordHash(value.password, found?.salt || '00000000000000000000000000000000');
    if (!found || !same(calculated, found.password_hash)) throw new HttpError(401, '账号或密码不正确');
    return newSession(request, found, env);
  }
  const user = await currentUser(request, env);
  if (path === '/api/session' && method === 'GET') return json(await sessionState(user, env));
  if (!user) throw new HttpError(401, '请先登录');
  if (path === '/api/auth/logout' && method === 'POST') {
    const token = request.headers.get('Cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
    return json({ ok: true }, 200, sessionCookie(request, '', 0));
  }
  if (method === 'POST') await rate(env, user.id, 'write', 40, 60);
  if (path === '/api/invites' && method === 'POST') {
    if (await pairFor(user, env)) throw new HttpError(409, '你们已经连接');
    await rate(env, user.id, 'invite-create', 10, 3600);
    const code = random(8).toUpperCase(); const expiresAt = Date.now() + 86400000;
    await env.DB.prepare('INSERT INTO invites(code_hash,owner_id,expires_at) VALUES(?,?,?) ON CONFLICT(owner_id) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at').bind(await digest(code), user.id, expiresAt).run();
    return json({ code, expiresAt: new Date(expiresAt).toISOString() });
  }
  if (path === '/api/invites/join' && method === 'POST') {
    await rate(env, user.id, 'invite-join', 10, 3600);
    const { code } = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-F0-9]{16}$/) }).parse(await readBody(request, 1024));
    const hash = await digest(code); const now = Date.now();
    const invite = await env.DB.prepare('SELECT owner_id FROM invites WHERE code_hash=? AND expires_at>?').bind(hash, now).first<{ owner_id: string }>();
    if (!invite || invite.owner_id === user.id) throw new HttpError(400, '邀请码无效、已过期，或是你自己的邀请码');
    if (await pairFor(user, env)) throw new HttpError(409, '当前账号已经连接另一位用户');
    const pairId = crypto.randomUUID();
    const results = await env.DB.batch([
      env.DB.prepare('INSERT INTO pairs(id,created_at) SELECT ?,? WHERE EXISTS(SELECT 1 FROM invites WHERE code_hash=? AND owner_id=? AND expires_at>?) AND NOT EXISTS(SELECT 1 FROM members WHERE user_id IN (?,?))').bind(pairId, now, hash, invite.owner_id, now, user.id, invite.owner_id),
      env.DB.prepare('INSERT INTO members(user_id,pair_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM pairs WHERE id=?)').bind(user.id, pairId, pairId),
      env.DB.prepare('INSERT INTO members(user_id,pair_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM pairs WHERE id=?)').bind(invite.owner_id, pairId, pairId),
      env.DB.prepare('DELETE FROM invites WHERE owner_id IN (?,?) AND EXISTS(SELECT 1 FROM pairs WHERE id=?)').bind(user.id, invite.owner_id, pairId),
    ]);
    if (!results[0].meta.changes) throw new HttpError(409, '连接未成功，请对方重新生成邀请码');
    return json(await sessionState(user, env));
  }
  const pair = await pairFor(user, env);
  if (!pair) throw new HttpError(409, '先用邀请码连接对方');
  if (path === '/api/requests' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM requests WHERE pair_id=? ORDER BY created_at DESC LIMIT 300').bind(pair.id).all<RequestRow>();
    const photos = await env.DB.prepare('SELECT p.id,p.name,p.request_id FROM photos p JOIN requests r ON r.id=p.request_id WHERE r.pair_id=? ORDER BY p.id').bind(pair.id).all<{ id: string; name: string; request_id: string }>();
    return json({ requests: rows.results.map(row => requestData(row, user, photos.results.filter(photo => photo.request_id === row.id))) });
  }
  if (path === '/api/requests' && method === 'POST') {
    await rate(env, user.id, 'request-day', 50, 86400);
    const input = createSchema.parse(await readBody(request)); const payloadHash = await digest(JSON.stringify(input));
    const existing = await env.DB.prepare('SELECT applicant_id,payload_hash FROM requests WHERE id=?').bind(input.id).first<{ applicant_id: string; payload_hash: string }>();
    if (existing) {
      if (existing.applicant_id !== user.id || existing.payload_hash !== payloadHash) throw new HttpError(409, '申请编号已使用，请重新提交');
      return json({ ok: true, id: input.id });
    }
    const statements = [env.DB.prepare('INSERT OR IGNORE INTO requests(id,pair_id,applicant_id,title,amount_cents,category,reason,created_at,payload_hash) VALUES(?,?,?,?,?,?,?,?,?)').bind(input.id, pair.id, user.id, input.title, input.amountCents, input.category, input.reason, Date.now(), payloadHash)];
    input.photos.forEach((photo, index) => statements.push(env.DB.prepare('INSERT OR IGNORE INTO photos(id,request_id,name,data) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM requests WHERE id=? AND applicant_id=? AND payload_hash=?)').bind(`${input.id}-${index}`, input.id, photo.name, photo.dataUrl, input.id, user.id, payloadHash)));
    await env.DB.batch(statements);
    const saved = await env.DB.prepare('SELECT applicant_id,payload_hash FROM requests WHERE id=?').bind(input.id).first<{ applicant_id: string; payload_hash: string }>();
    if (!saved || saved.applicant_id !== user.id || saved.payload_hash !== payloadHash) throw new HttpError(409, '提交冲突，请重试');
    return json({ ok: true, id: input.id }, 201);
  }
  const actionMatch = path.match(/^\/api\/requests\/([a-f0-9-]{36})\/status$/);
  if (actionMatch && method === 'POST') {
    const input = z.object({ status: z.enum(['approved', 'rejected', 'purchased', 'cancelled']), note: z.string().trim().max(200).default('') }).parse(await readBody(request, 2048));
    const deciding = input.status === 'approved' || input.status === 'rejected'; const from = input.status === 'purchased' ? 'approved' : 'pending';
    const now = Date.now();
    const update = await env.DB.prepare(`UPDATE requests SET status=?, decided_at=CASE WHEN ?='purchased' THEN decided_at ELSE ? END, decision_note=CASE WHEN ?='purchased' THEN decision_note ELSE ? END, purchased_at=CASE WHEN ?='purchased' THEN ? ELSE purchased_at END WHERE id=? AND pair_id=? AND status=? AND applicant_id${deciding ? '<>' : '='}?`).bind(input.status, input.status, now, input.status, input.note, input.status, now, actionMatch[1], pair.id, from, user.id).run();
    if (!update.meta.changes) throw new HttpError(409, '申请状态已变化，或你无权执行这个操作');
    return json({ ok: true });
  }
  const photoMatch = path.match(/^\/api\/photos\/([a-f0-9-]{36}-[0-2])$/);
  if (photoMatch && method === 'GET') {
    const row = await env.DB.prepare('SELECT p.data FROM photos p JOIN requests r ON r.id=p.request_id WHERE p.id=? AND r.pair_id=?').bind(photoMatch[1], pair.id).first<{ data: string }>();
    if (!row) throw new HttpError(404, '图片不存在');
    const data = Uint8Array.from(atob(row.data.split(',')[1]), c => c.charCodeAt(0));
    return new Response(data, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (path === '/api/recognize' && method === 'POST') {
    if (!env.OPENROUTER_API_KEY) throw new HttpError(503, '图片识别尚未配置，仍可手动填写');
    await rate(env, user.id, 'recognize-minute', 3, 60); await rate(env, user.id, 'recognize-day', 30, 86400);
    const input = z.object({ photos: photosSchema.min(1) }).parse(await readBody(request));
    const response = await fetch(recognitionConfig.endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'UsFirst' },
      body: JSON.stringify({ model: recognitionConfig.model, temperature: recognitionConfig.temperature, max_tokens: recognitionConfig.maxTokens, reasoning: { enabled: false }, response_format: { type: 'json_object' }, provider: { require_parameters: true, data_collection: 'deny' },
        messages: [{ role: 'system', content: recognitionPrompt }, { role: 'user', content: [{ type: 'text', text: '提取这笔消费，供本人确认后发起申请。' }, ...input.photos.map(photo => ({ type: 'image_url', image_url: { url: photo.dataUrl } }))] }] }),
      signal: AbortSignal.timeout(40000),
    });
    if (!response.ok) throw new HttpError(502, response.status === 402 ? '识别服务余额不足，请手动填写' : '识别服务暂不可用，请重试或手动填写');
    const output = await response.json() as { choices?: { message?: { content?: string } }[] };
    try { return json(parseRecognitionResult(JSON.parse(output.choices?.[0]?.message?.content || ''))); }
    catch { throw new HttpError(502, '识别结果无效，请手动填写'); }
  }
  throw new HttpError(404, '接口不存在');
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (new URL(request.url).pathname.startsWith('/api/')) return await api(request, env);
      const response = await env.ASSETS.fetch(request); const headers = new Headers(response.headers);
      headers.set('X-Content-Type-Options', 'nosniff'); headers.set('Referrer-Policy', 'same-origin'); headers.set('X-Frame-Options', 'DENY');
      headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      if (error instanceof z.ZodError) return json({ error: '请检查填写内容、金额或图片格式' }, 400);
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return json({ error: '识别超时，请重试或手动填写' }, 504);
      return json({ error: '服务暂时不可用，请稍后重试' }, 500);
    }
  },
};
