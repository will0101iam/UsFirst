import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, webcrypto, createECDH } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
const dir = mkdtempSync(join(tmpdir(), 'usfirst-push-test-'));
const db = new DatabaseSync(join(dir, 'test.sqlite'));
for (const file of ['0001_initial.sql','0002_push_subscriptions.sql','0003_lightweight_sync.sql']) db.exec(readFileSync('migrations/'+file,'utf8'));
function statement(sql, args=[]) { return { bind(...v){return statement(sql,v)}, async first(){return db.prepare(sql).get(...args)||null}, async all(){return {results:db.prepare(sql).all(...args)}}, async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}} }; }
const DB = {prepare:statement, async batch(items){db.exec('BEGIN');try { const out=[];for(const s of items)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e}}};
const built = await build({entryPoints:['worker/index.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2023'});
const worker=(await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))).default;
const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const jwk=await webcrypto.subtle.exportKey('jwk',pair.privateKey);
const pub=Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url');
const env={DB, WEB_PUSH_KEYS:JSON.stringify({publicKey:pub,privateKey:jwk.d})};
const cookies={}; const pending=[]; const sends=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{sends.push({url,init});return new Response('',{status:201})};
async function drain(){while(pending.length)await Promise.all(pending.splice(0));}
async function call(who,path,body,expected=200,extra={}) {
 const response=await worker.fetch(new Request('https://usfirst.example/api'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookies[who]||'',Origin:'https://usfirst.example','X-UsFirst':'1','CF-Connecting-IP':who,'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,{waitUntil:p=>pending.push(p)});
 const data=await response.json();assert.equal(response.status,expected,path+': '+JSON.stringify(data));if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return data;
}
function sub(endpoint='https://web.push.apple.com/Q'+randomUUID()) {const ec=createECDH('prime256v1');ec.generateKeys();const result={endpoint,keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};result.__ec=ec;return result;}
async function decrypt(body,subscription) {
 const {hkdfSync}=await import('node:crypto');const buffer=Buffer.from(body),salt=buffer.subarray(0,16),serverPublic=buffer.subarray(21,86);
 const secret=subscription.__ec.computeSecret(serverPublic);
 const ikm=Buffer.from(hkdfSync('sha256',secret,Buffer.from(subscription.keys.auth,'base64url'),Buffer.concat([Buffer.from('WebPush: info\0'),subscription.__ec.getPublicKey(),serverPublic]),32));
 const cek=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));const nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
 const key=await webcrypto.subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']);const plain=Buffer.from(await webcrypto.subtle.decrypt({name:'AES-GCM',iv:nonce},key,buffer.subarray(86)));let end=plain.length-1;while(plain[end]===0)end--;assert.equal(plain[end],2);return JSON.parse(plain.subarray(0,end));
}
try {
 await call('anon','/push/config',undefined,401);
 for(const who of ['a','b','c','d'])await call(who,'/auth/register',{username:'test_'+who,displayName:who,password:randomBytes(20).toString('hex')});
 assert.equal((await call('a','/push/config')).publicKey,pub);
 const sa=sub(),sb=sub(),sc=sub();
 await call('a','/push/subscribe',{subscription:sa});await call('b','/push/subscribe',{subscription:sb});await call('c','/push/subscribe',{subscription:sc});
 assert.equal((await call('b','/push/status')).enabled,true);
 await call('a','/push/subscribe',{subscription:sb},409);assert.equal((await call('b','/push/status')).enabled,true);
 await call('a','/push/subscribe',{subscription:sub('https://127.0.0.1/internal')},400);
 await call('a','/push/subscribe',{subscription:sub('https://web.push.apple.com.evil.example/foo')},400);
 await call('a','/push/subscribe',{subscription:sub('https://web.push.apple.com/foo')},403,{Origin:'https://evil.example'});
 const invite=await call('a','/invites',{});await call('b','/invites/join',{code:invite.code});
 const ci=await call('c','/invites',{});await call('d','/invites/join',{code:ci.code});
 const input={id:randomUUID(),title:'不要泄露的商品',amountCents:12345,category:'网购',reason:'私密理由',photos:[]};
 await call('a','/requests',input,201);await drain();assert.equal(sends.length,1);assert.equal(sends[0].url,sb.endpoint);
 assert.equal(sends[0].init.headers['content-encoding'],'aes128gcm');assert.equal(sends[0].init.body.byteLength,4096);assert.equal(sends[0].init.redirect,'error');
 const message=await decrypt(sends[0].init.body,sb);assert.equal(message.requestId,input.id);assert.equal(message.body,'收到一笔新申请，点开查看。');assert.ok(!JSON.stringify(message).includes(input.title));assert.ok(!JSON.stringify(message).includes(input.reason));assert.ok(!JSON.stringify(message).includes('12345'));
 assert.equal((await call('b','/requests/'+input.id)).request.title,input.title);await call('c','/requests/'+input.id,undefined,404);
 const auth=sends[0].init.headers.authorization;assert.ok(auth.startsWith('vapid t='));const token=auth.slice(8).split(',')[0];const [header,claims,sig]=token.split('.');assert.equal(JSON.parse(Buffer.from(claims,'base64url')).aud,'https://web.push.apple.com');assert.ok(await webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pair.publicKey,Buffer.from(sig,'base64url'),Buffer.from(header+'.'+claims)));
 await call('a','/requests',input);await drain();assert.equal(sends.length,1,'idempotent submit must not repush');
 await call('c','/requests/'+input.id+'/status',{status:'approved'},409);await drain();assert.equal(sends.length,1);
 await call('b','/requests/'+input.id+'/status',{status:'approved'});await drain();assert.equal(sends.length,2);assert.equal(sends[1].url,sa.endpoint);assert.equal((await decrypt(sends[1].init.body,sa)).body,'你的申请有了审批结果，点开查看。');
 await call('b','/requests/'+input.id+'/status',{status:'approved'},409);await drain();assert.equal(sends.length,2);
 await call('a','/requests/'+input.id+'/status',{status:'purchased'});await drain();assert.equal(sends.length,2);
 const rejected={...input,id:randomUUID()};await call('a','/requests',rejected,201);await drain();await call('b','/requests/'+rejected.id+'/status',{status:'rejected'});await drain();assert.equal(sends.length,4);assert.equal(sends[3].url,sa.endpoint);
 globalThis.fetch=async()=>{throw new TypeError('network failure')};const fail={...input,id:randomUUID()};await call('a','/requests',fail,201);await drain();assert.equal((await call('b','/requests')).requests.find(r=>r.id===fail.id).status,'pending');
 globalThis.fetch=async()=>new Response('',{status:410});await call('a','/requests',{...input,id:randomUUID()},201);await drain();assert.equal((await call('b','/push/status')).enabled,false);
 await call('b','/push/subscribe',{subscription:sb});await call('b','/auth/logout',{});assert.equal(db.prepare('SELECT count(*) AS n FROM push_subscriptions WHERE endpoint=?').get(sb.endpoint).n,0);
 await call('a','/push/unsubscribe',{});assert.equal((await call('a','/push/status')).enabled,false);assert.equal((await call('c','/push/status')).enabled,true);
 // Logout after enqueue but before sending: the final server check must suppress this push.
 await call('a','/push/subscribe',{subscription:sa});const before=db.prepare('SELECT count(*) AS n FROM push_subscriptions').get().n;let forbiddenCalls=0;globalThis.fetch=async()=>{forbiddenCalls++;throw new Error('must not send after logout')};
 await call('b','/auth/register',{username:'test_b_new',displayName:'b',password:randomBytes(20).toString('hex')});
 db.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=(SELECT id FROM users WHERE username=?)').run('test_a');
 const {notifyUser}=await import('data:text/javascript;base64,'+Buffer.from((await build({entryPoints:['worker/push.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2023'})).outputFiles[0].text).toString('base64'));await notifyUser(env,db.prepare('SELECT id FROM users WHERE username=?').get('test_a').id,input.id,'request');assert.equal(forbiddenCalls,0);assert.equal(db.prepare('SELECT count(*) AS n FROM push_subscriptions').get().n,before);
 assert.equal(db.prepare('SELECT count(*) AS n FROM requests').get().n,4);
 console.log(JSON.stringify({ok:true,scope:'real Worker through request boundary + SQLite transactions + real aes128gcm/VAPID; delivery transport isolated',checks:30,productionRequests:0}));
} finally {globalThis.fetch=originalFetch;db.close();rmSync(dir,{recursive:true,force:true});}
