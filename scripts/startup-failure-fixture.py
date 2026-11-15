#!/usr/bin/env python3
"""Production HTML startup failure reproduction. No real accounts or production calls.
?mode=blocked: entry JS fails; snapshot should still paint from inline boot.
?mode=empty: no snapshot and entry JS fails; recovery text/button remain visible.
?mode=api: entry loads but bootstrap fails; application must show a recoverable error.
?standalone=1 only activates actual CSS branch; not an iPhone emulator.
"""
import base64,hashlib,json,mimetypes,pathlib,re,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit,parse_qs
root=(pathlib.Path(__file__).resolve().parent.parent/'dist').resolve()
snapshot={'version':1,'account':'startup_fixture','savedAt':0,'session':{'user':{'username':'startup_fixture','displayName':'启动测试甲'},'pair':{'partnerName':'启动测试乙'},'recognitionAvailable':False},'requests':[{'id':'ba97ea02-3d08-4b41-a8b6-000000000001','applicant':'partner','title':'主脚本失败仍可见的申请','amountCents':2900,'category':'网购','reason':'虚构记录','photos':[],'status':'pending','createdAt':'2026-11-15T08:00:00Z'}]}
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  url=urlsplit(self.path);query=parse_qs(url.query);route=url.path;policy=None
  if route=='/api/bootstrap':
   mode=parse_qs(urlsplit(self.headers.get('Referer','')).query).get('mode',['api'])[0]
   if mode=='healthy':
    body=json.dumps({'session':snapshot['session'],'requests':snapshot['requests'],'revision':'healthy-fixture'}).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(body);return
   self.send_response(503);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"error":"fixture bootstrap unavailable"}');return
  if route=='/sw.js':self.send_error(404);return
  if route=='/blocked-entry.js':self.send_error(503);return
  file=(root/(route.lstrip('/') or 'index.html')).resolve()
  if not file.is_relative_to(root) or not file.is_file():self.send_error(404);return
  body=file.read_bytes();mime=mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
  if file.suffix=='.html':
   mode=query.get('mode',['blocked'])[0];snapshot['savedAt']=int(time.time()*1000)
   seed="localStorage.removeItem('usfirst:snapshot:v1');localStorage.removeItem('usfirst:snapshot-generation:v1');"
   if mode in ['blocked','healthy','stream']:seed+="localStorage.setItem('usfirst:snapshot:v1',"+json.dumps(json.dumps(snapshot))+");"
   html=body.decode().replace('<head>','<head><script>'+seed+'</script>')
   if mode not in ['api','healthy']:html=re.sub(r'(<script\b[^>]*type="module"[^>]*src=")[^"]+',r'\1/blocked-entry.js',html)
   if 'standalone' in query:html=html.replace('(display-mode:standalone)','(min-width:0px)').replace('(display-mode: standalone)','(min-width:0px)')
   body=html.encode();scripts=re.findall(r'<script(?: data-usfirst-boot)?>([\s\S]*?)</script>',html)
   policy="default-src 'self';script-src 'self' "+' '.join("'sha256-"+base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()+"'" for s in scripts)+";style-src 'self' 'unsafe-inline';connect-src 'self';img-src 'self' data: blob:"
  self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store')
  if policy:self.send_header('Content-Security-Policy',policy)
  self.end_headers()
  try:
   if file.suffix=='.html' and query.get('mode',[''])[0]=='stream':
    end=body.index(b'</script>',body.index(b'<script data-usfirst-boot>'))+len(b'</script>');self.wfile.write(body[:end]);self.wfile.flush();time.sleep(20);self.wfile.write(body[end:])
   else:self.wfile.write(body)
  except(BrokenPipeError,ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',32933),Handler)
print('Startup failure fixture http://127.0.0.1:32933/?mode=blocked&standalone=1; synthetic only',flush=True)
server.serve_forever()
