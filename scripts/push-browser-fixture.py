#!/usr/bin/env python3
"""Render-only notification settings fixture; no real login, subscription or production call."""
import json, mimetypes, pathlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
root=(pathlib.Path(__file__).resolve().parent.parent/'dist').resolve()
request={'id':'fa48d670-abcd-4ec2-82e9-b1a0b6f49d78','applicant':'partner','title':'虚构通知验收申请','amountCents':2900,'category':'网购','reason':'仅用于本地验证','photos':[],'status':'pending','createdAt':'2026-11-15T08:00:00Z'}
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  route=self.path.split('?',1)[0]
  if route=='/api/bootstrap':body=json.dumps({'session':{'user':{'username':'push_fixture','displayName':'通知测试甲'},'pair':{'partnerName':'通知测试乙'},'recognitionAvailable':False},'requests':[request],'revision':'push-fixture'}).encode();mime='application/json'
  elif route=='/api/requests/'+request['id']:body=json.dumps({'request':request}).encode();mime='application/json'
  elif route=='/api/push/status':body=b'{"enabled":false}';mime='application/json'
  elif route=='/sw.js':self.send_error(404);return
  else:
   file=(root/(route.lstrip('/') or 'index.html')).resolve()
   if not file.is_relative_to(root) or not file.is_file():self.send_error(404);return
   body=file.read_bytes();mime=mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
  self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
server=ThreadingHTTPServer(('127.0.0.1',32929),Handler)
print('Render-only synthetic push fixture on http://127.0.0.1:32929; no production calls',flush=True)
server.serve_forever()
