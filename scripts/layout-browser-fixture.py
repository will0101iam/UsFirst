#!/usr/bin/env python3
"""Deterministic layout fixture. Exercises shipped CSS standalone branch, not an iPhone emulator.
No real accounts, network or push. Open / and /?standalone=1 to compare browser vs app layout.
"""
import base64, hashlib, json, mimetypes, pathlib, re, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs
root=(pathlib.Path(__file__).resolve().parent.parent/'dist').resolve()
session={'user':{'username':'layout_fixture','displayName':'布局测试甲'},'pair':{'partnerName':'布局测试乙'},'recognitionAvailable':False}
def rows(long=False):
 return [{'id':f'ba97ea02-3d08-4b41-a8b6-{i:012d}','applicant':'partner','title':'测试申请 '+str(i),'amountCents':2900,'category':'网购','reason':('虚构长申请，用于检验内容变化不带动导航。'*12 if long else '布局回归'),'photos':[],'status':'pending','createdAt':'2026-11-15T08:00:00Z'} for i in range(10 if long else 1)]
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  url=urlsplit(self.path);route=url.path;query=parse_qs(url.query);policy=None
  if route=='/api/bootstrap':
   time.sleep(3);body=json.dumps({'session':session,'requests':rows(),'revision':'layout-new'}).encode();mime='application/json'
  elif route=='/sw.js':self.send_error(404);return
  else:
   file=(root/(route.lstrip('/') or 'index.html')).resolve()
   if not file.is_relative_to(root) or not file.is_file():self.send_error(404);return
   body=file.read_bytes();mime=mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
   if file.suffix=='.html':
    snapshot={'version':1,'account':'layout_fixture','savedAt':int(time.time()*1000),'session':session,'requests':rows(True)}
    seed="localStorage.setItem('usfirst:snapshot:v1',"+json.dumps(json.dumps(snapshot))+");localStorage.removeItem('usfirst:snapshot-generation:v1');"
    probe="""(()=>{let first=null,finished=false;const result=[];function read(){const dock=document.querySelector('.nav-dock');if(!dock)return null;return {dockTop:dock.getBoundingClientRect().top,navTop:document.querySelector('.bottom-nav').getBoundingClientRect().top,position:getComputedStyle(dock).position,docHeight:document.documentElement.scrollHeight,viewport:innerHeight,scrollY:scrollY,readonly:!!document.querySelector('.snapshot-status:not([aria-hidden=true])'),content:!!document.querySelector('.home-scroll')};}function tick(){let now=read();if(now&&!first){first=now;const sc=document.querySelector('.home-scroll')||document.scrollingElement;sc.scrollTop=50;}if(now&&first&&!now.readonly&&!finished){finished=true;const checks={documentDoesNotScroll:first.docHeight<=first.viewport+1&&now.docHeight<=now.viewport+1,navigationNotViewportFixed:now.position==='static',contentScroller:now.content,noSyncShift:Math.abs(first.navTop-now.navTop)<1};const afterZero=read();document.documentElement.style.setProperty('--layout-safe-bottom','34px');const afterSafe=read();checks.noSafeAreaDrop=Math.abs(afterZero.navTop-afterSafe.navTop)<1;document.documentElement.dataset.layoutResult=JSON.stringify({first,after:now,afterZero,afterSafe,checks,ok:Object.values(checks).every(Boolean)});document.documentElement.dataset.layoutDone='true';}if(!finished)requestAnimationFrame(tick);}requestAnimationFrame(tick);})();"""
    html=body.decode()
    if 'standalone' in query:html=html.replace('(display-mode:standalone)','(min-width:0px)').replace('(display-mode: standalone)','(min-width:0px)').replace('env(safe-area-inset-bottom)','var(--layout-safe-bottom,0px)')
    html=html.replace('<head>','<head><script>'+seed+probe+'</script>');body=html.encode()
    scripts=re.findall(r'<script(?: data-usfirst-boot)?>([\s\S]*?)</script>',html)
    policy="default-src 'self';script-src 'self' "+' '.join("'sha256-"+base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()+"'" for s in scripts)+";style-src 'self' 'unsafe-inline';connect-src 'self';img-src 'self' data: blob:"
  self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)))
  if policy:self.send_header('Content-Security-Policy',policy)
  self.end_headers()
  try:self.wfile.write(body)
  except(BrokenPipeError,ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',32931),Handler)
print('Local layout fixture http://127.0.0.1:32931/?standalone=1; css branch exercise only',flush=True)
server.serve_forever()
