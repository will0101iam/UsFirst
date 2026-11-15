import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const code=readFileSync('public/boot.js','utf8');
function element(tag='div'){return {tagName:tag.toUpperCase(),textContent:'',hidden:false,children:[],style:{},attrs:{},appendChild(child){this.children.push(child);return child},replaceChildren(...children){this.children=children},setAttribute(k,v){this.attrs[k]=v},addEventListener(){}};}
function run(raw,options={}) {
 const elements={'boot-shell':element('section'),'boot-status':element('p'),'boot-retry':element('button'),'boot-records':element('div'),'root':{firstElementChild:options.emptyRoot?null:{},textContent:options.emptyRoot?'':'一起花正在连接',getBoundingClientRect:()=>({height:options.emptyRoot?0:780})}};
 const events=new Map(),timers=new Map();let id=0;const store=new Map(raw?[['usfirst:snapshot:v1',raw]]:[]);
 const context={URL,AbortController,Response,Headers,Promise,Date,JSON,Number,RegExp,Event,console,TextEncoder,setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimeout:i=>timers.delete(i),location:{pathname:options.recoverPath||'/',search:'',hash:'',protocol:'https:',hostname:'usfirst.example',reload(){}},history:{replaceState(_a,_b,url){context.location.pathname=url}},document:{hidden:false,getElementById:id=>elements[id]||null,createElement:element,addEventListener(n,f){events.set(n,f)}},navigator:{onLine:true},window:{dispatchEvent(){},localStorage:{getItem:k=>store.get(k)||null,removeItem:k=>store.delete(k)},addEventListener(n,f){events.set(n,f)}},fetch:()=>new Promise(()=>{})};
 if(options.storageFailure)Object.defineProperty(context.window,'localStorage',{get(){throw new Error('storage denied')}});
 vm.runInNewContext(code,context);
 return {elements,events,timers,context};
}
const snapshot={version:1,account:'test_a',savedAt:Date.now(),session:{user:{username:'test_a',displayName:'甲'},pair:{partnerName:'乙'},recognitionAvailable:false},requests:[{id:'a',title:'先显示的申请',amountCents:2900,reason:'',category:'网购',applicant:'partner',status:'pending',createdAt:new Date().toISOString(),photos:[]}]};
const first=run(JSON.stringify(snapshot));
assert.ok(first.elements['boot-records'].children.length>0,'cached read-only home must render before external React JS/network');
assert.ok(JSON.stringify(first.elements['boot-records']).includes('先显示的申请'));
assert.equal(first.elements['boot-shell'].hidden,false);
const expired=run(JSON.stringify({...snapshot,savedAt:Date.now()-25*3600000}));assert.equal(expired.elements['boot-records'].children.length,0);
const denied=run('',{storageFailure:true});assert.equal(denied.elements['boot-shell'].hidden,false,'storage unavailable keeps recovery shell');
const mounting=run('');mounting.events.get('usfirst:mounted')();assert.equal(mounting.elements['boot-shell'].hidden,true);
mounting.events.get('usfirst:fatal')();assert.equal(mounting.elements['boot-shell'].hidden,false,'React failure restores independent shell');assert.equal(mounting.elements['boot-retry'].hidden,false);
const invisible=run('',{emptyRoot:true});invisible.events.get('usfirst:mounted')();assert.equal(invisible.elements['boot-shell'].hidden,false,'mounted event must not hide recovery until visible app exists');
for(const recoverPath of ['/recover','/recover.html']){const recovered=run('',{recoverPath});assert.equal(recovered.context.location.pathname,'/','Cloudflare canonical recovery route must normalize before React mounts');}
console.log(JSON.stringify({ok:true,checks:9,scope:'boot script without React/network; validated snapshot immediate paint and independent fatal recovery'}));
