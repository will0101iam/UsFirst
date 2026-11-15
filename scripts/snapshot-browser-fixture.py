#!/usr/bin/env python3
"""Isolated synthetic snapshot browser fixture; never calls production or real accounts."""
import base64, hashlib, json, mimetypes, pathlib, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
root = (pathlib.Path(__file__).resolve().parent.parent / 'dist').resolve()
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_GET(self):
        route=self.path.split('?',1)[0]
        session={'user':{'username':'fixture_a','displayName':'测试甲'},'pair':{'partnerName':'测试乙'},'recognitionAvailable':False}
        requests=[{'id':'ba97ea02-3d08-4b41-a8b6-05f70fe75d2a','applicant':'partner','title':'本机快照测试申请','amountCents':2900,'category':'网购','reason':'虚构记录，仅用于启动验收','photos':[],'status':'pending','createdAt':'2026-11-15T08:00:00Z'}]
        policy=None
        if route=='/api/bootstrap':
            time.sleep(12); body=json.dumps({'session':session,'requests':requests,'revision':'fixture'}).encode(); mime='application/json'
        elif route=='/sw.js': self.send_error(404); return
        else:
            f=(root/(route.lstrip('/') or 'index.html')).resolve()
            if not f.is_relative_to(root) or not f.is_file(): self.send_error(404); return
            body=f.read_bytes(); mime=mimetypes.guess_type(str(f))[0] or 'application/octet-stream'
            if f.suffix=='.html':
                snap={'version':1,'account':'fixture_a','savedAt':int(time.time()*1000),'session':session,'requests':requests}
                seed="localStorage.setItem('usfirst:snapshot:v1',"+json.dumps(json.dumps(snap))+ ");localStorage.removeItem('usfirst:snapshot-generation:v1');new MutationObserver(function(){if(document.querySelector('.focus-request')&&!performance.getEntriesByName('snapshot-visible').length)performance.mark('snapshot-visible');}).observe(document.documentElement,{childList:true,subtree:true});"
                html=body.decode().replace('<head>','<head><script>'+seed+'</script>');body=html.encode()
                scripts=__import__('re').findall(r'<script(?: data-usfirst-boot)?>([\s\S]*?)</script>',html)
                policy="default-src 'self';script-src 'self' "+' '.join("'sha256-"+base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()+"'" for s in scripts)+";style-src 'self' 'unsafe-inline';connect-src 'self';img-src 'self' data: blob:"
        self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store')
        if policy:self.send_header('Content-Security-Policy',policy)
        self.end_headers()
        try:self.wfile.write(body)
        except (BrokenPipeError,ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',32923),Handler)
print('Synthetic snapshot fixture on http://127.0.0.1:32923; bootstrap delayed 12s, no production calls',flush=True)
server.serve_forever()
