#!/usr/bin/env node
// Generate only if absent; never print or persist a VAPID private key.
import { spawnSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const listed=spawnSync('npx',['wrangler','secret','list'],{cwd,encoding:'utf8',timeout:120000});
if(listed.status!==0)throw new Error('无法检查已有推送密钥，未做变更');
const secrets=JSON.parse(listed.stdout);
if(secrets.some(s=>s.name==='WEB_PUSH_KEYS')) { console.log('推送密钥已存在，保持原值。'); process.exit(0); }
const key=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const jwk=await webcrypto.subtle.exportKey('jwk',key.privateKey);
const publicKey=Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url');
const input=JSON.stringify({WEB_PUSH_KEYS:JSON.stringify({publicKey,privateKey:jwk.d})});
const configured=spawnSync('npx',['wrangler','secret','bulk'],{cwd,input,encoding:'utf8',timeout:180000});
// Do not surface CLI input/output if an unexpected error echoes it.
if(configured.status!==0)throw new Error('推送密钥配置未确认；请先核验 Secret 名称，不要直接覆盖重试');
console.log('推送密钥已安全配置为 Worker Secret，未写入文件。');
