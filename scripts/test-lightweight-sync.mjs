import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const db = new DatabaseSync(':memory:');
for (const file of ['0001_initial.sql','0002_push_subscriptions.sql','0003_lightweight_sync.sql']) db.exec(readFileSync('migrations/'+file,'utf8'));
if (process.env.SYNC_MUTANT === 'no-version-update') db.exec('DROP TRIGGER request_sync_update');
const reads=[];
function statement(sql,args=[]) { return { bind(...v){return statement(sql,v)}, async first(){reads.push(sql);return db.prepare(sql).get(...args)||null}, async all(){reads.push(sql);return {results:db.prepare(sql).all(...args)}}, async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}} } }
const DB={prepare:statement,async batch(items){db.exec('BEGIN');try {const result=[];for(const s of items)result.push(await s.run());db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}};
const built=await build({entryPoints:['worker/index.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2023'});
const worker=(await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))).default;
const cookies={};let checks=0;
async function call(who,path,body,expected=200){const response=await worker.fetch(new Request('https://usfirst.example/api'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookies[who]||'',Origin:'https://usfirst.example','X-UsFirst':'1','CF-Connecting-IP':who,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB});const data=await response.json();assert.equal(response.status,expected,path+': '+JSON.stringify(data));if(response.headers.has('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];checks++;return data}
try {
 for(const who of ['a','b','c','d'])await call(who,'/auth/register',{username:'sync_'+who,displayName:who,password:randomBytes(20).toString('hex')});
 for(const [a,b] of [['a','b'],['c','d']]){const inv=await call(a,'/invites',{});await call(b,'/invites/join',{code:inv.code})}
 const input={id:randomUUID(),title:'同步申请',amountCents:2900,category:'网购',reason:'',photos:[]};
 const created=await call('a','/requests',input,201);
 assert.equal(created.request.id,input.id,'success must return authoritative request');
 assert.equal(created.request.applicant,'me');
 const initial=await call('b','/bootstrap?sync=2');assert.equal(initial.mode,'reset');assert.equal(initial.requests[0].id,input.id);
 reads.length=0;
 const same=await call('b','/bootstrap?sync=2&revision='+encodeURIComponent(initial.revision));assert.equal(same.mode,'unchanged');assert.equal(same.requests,null);assert.equal(reads.length,1,'unchanged must use one authorization/version SQL');assert.ok(!reads[0].includes('FROM requests'),'unchanged does not scan requests');
 const legacy=await call('b','/bootstrap');
 reads.length=0;await call('b','/bootstrap?revision='+legacy.revision);
 assert.equal(reads.length,2);assert.ok(reads[1].includes('FROM requests'));
 const dispatchComparison={legacyUnchangedSQL:reads.length,candidateUnchangedSQL:1,legacyUnchangedListQueries:1,candidateUnchangedListQueries:0};
 const rejected=await call('a','/requests/'+input.id+'/status',{status:'approved'},409);
 assert.ok(rejected.error);assert.equal((await call('b','/bootstrap?sync=2&revision='+encodeURIComponent(initial.revision))).mode,'unchanged');
 const approved=await call('b','/requests/'+input.id+'/status',{status:'approved',note:'可以'});assert.equal(approved.request.status,'approved');assert.ok(approved.request.decidedAt);
 const delta=await call('b','/bootstrap?sync=2&revision='+encodeURIComponent(initial.revision));assert.equal(delta.mode,'delta');assert.equal(delta.requests.length,1);assert.equal(delta.requests[0].status,'approved');
 const before=db.prepare('SELECT sync_version FROM pairs WHERE id=(SELECT pair_id FROM members WHERE user_id=(SELECT id FROM users WHERE username=?))').get('sync_a').sync_version;
 await call('a','/requests',input);assert.equal(db.prepare('SELECT sync_version FROM pairs WHERE id=(SELECT pair_id FROM members WHERE user_id=(SELECT id FROM users WHERE username=?))').get('sync_a').sync_version,before,'idempotent retry cannot bump version');
 const cross=await call('c','/bootstrap?sync=2&revision='+encodeURIComponent(delta.revision));assert.equal(cross.mode,'reset');assert.equal(cross.requests.length,0);
 await call('c','/requests/'+input.id,undefined,404);
 // Populate >300 historical records with equal timestamps to expose offset/tie errors; local-only SQL fixture.
 const pair=db.prepare('SELECT pair_id FROM members WHERE user_id=(SELECT id FROM users WHERE username=?)').get('sync_a').pair_id;
 const uid=db.prepare('SELECT id FROM users WHERE username=?').get('sync_a').id;
 const insert=db.prepare("INSERT INTO requests(id,pair_id,applicant_id,title,amount_cents,category,reason,status,created_at,payload_hash) VALUES(?,?,?,?,1,'其他','','purchased',?,?)");
 for(let i=0;i<335;i++)insert.run(randomUUID(),pair,uid,'历史'+i,1000,'h'+i);
 const fresh=await call('b','/bootstrap?sync=2');assert.ok(fresh.requests.length<=150,'initial bounded');assert.ok(fresh.requests.some(r=>r.id===input.id),'active preserved despite old creation time');
 let cursor=null,ids=[];do{const page=await call('a','/requests/page?view=mine&filter=all'+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert.ok(page.requests.length<=30);ids.push(...page.requests.map(r=>r.id));cursor=page.cursor}while(cursor);
 assert.equal(ids.length,336);assert.equal(new Set(ids).size,336,'pagination no omissions/duplicates on timestamp ties');
 assert.equal((await call('c','/requests/page?view=mine&filter=all')).requests.length,0);
 await call('a','/requests/page?view=mine&filter=all&cursor=bad',undefined,400);
 const tooMany=await call('b','/bootstrap?sync=2&revision='+encodeURIComponent(delta.revision));assert.equal(tooMany.mode,'reset','large delta resets bounded initial rather than skipping rows');
 const latest=await call('b','/bootstrap?sync=2');
 db.prepare('DELETE FROM requests WHERE id=?').run(input.id);
 const deletion=await call('b','/bootstrap?sync=2&revision='+encodeURIComponent(latest.revision));assert.ok(deletion.removed.includes(input.id));
 // Forced write failure rolls back both truth and version.
 const version=db.prepare('SELECT sync_version FROM pairs WHERE id=?').get(pair).sync_version;
 db.exec("CREATE TRIGGER fail_photo BEFORE INSERT ON photos BEGIN SELECT RAISE(ABORT,'test_failure');END;");
 const badId=randomUUID();await call('a','/requests',{...input,id:badId,photos:[{name:'test.jpg',dataUrl:'data:image/jpeg;base64,'+readFileSync('scripts/fixtures/test-photo.jpg').toString('base64')}]},500);
 assert.equal(db.prepare('SELECT sync_version FROM pairs WHERE id=?').get(pair).sync_version,version);assert.equal(db.prepare('SELECT id FROM requests WHERE id=?').get(badId),undefined);
 await call('b','/auth/logout',{});const revoked=await call('b','/bootstrap?sync=2&revision='+encodeURIComponent(latest.revision));assert.equal(revoked.session.user,null);assert.deepEqual(revoked.requests,[]);
 console.log(JSON.stringify({ok:true,checks,dispatchComparison,scope:'real Worker + SQLite; version guards, delta, identity, paging 336 rows, rollback, revoked sessions',productionRequests:0}));
} finally {db.close()}
