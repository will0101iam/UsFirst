#!/usr/bin/env python3
"""Controlled local transport bench; static builds only, never contacts production/LLM.
800ms per request + 50KB/s, anonymous bootstrap fixture identical for both versions.
"""
import hashlib, json, mimetypes, pathlib, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ROOT = pathlib.Path(__file__).resolve().parent.parent
PROBE = "performance.mark('bench-start');new MutationObserver(function(){if(document.querySelector('.auth-panel')&&!performance.getEntriesByName('bench-ready').length){performance.mark('bench-ready');}}).observe(document.documentElement,{childList:true,subtree:true});"
probe_hash = hashlib.sha256(PROBE.encode()).digest()
import base64
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/api/bootstrap':
            body = json.dumps({'session': {'user': None, 'pair': None, 'recognitionAvailable': False}, 'requests': [], 'revision': 'bench'}).encode()
            mime = 'application/json'; policy = None
        elif path == '/sw.js':
            self.send_error(404); return
        else:
            filename = (self.server.root / (path.lstrip('/') or 'index.html')).resolve()
            if not filename.is_relative_to(self.server.root) or not filename.is_file(): self.send_error(404); return
            body = filename.read_bytes(); mime = mimetypes.guess_type(str(filename))[0] or 'application/octet-stream'; policy = None
            if filename.suffix == '.html':
                html = body.decode().replace('<head>', '<head><script>' + PROBE + '</script>')
                body = html.encode(); policy = "default-src 'self'; script-src 'self' 'sha256-" + base64.b64encode(probe_hash).decode() + "'"
                for script in __import__('re').findall(r'<script data-usfirst-boot>([\s\S]*?)</script>', html):
                    policy += " 'sha256-" + base64.b64encode(hashlib.sha256(script.encode()).digest()).decode() + "'"
                policy += "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'"
        time.sleep(.8)
        self.send_response(200); self.send_header('Content-Type', mime); self.send_header('Content-Length', str(len(body))); self.send_header('Cache-Control', 'no-store')
        if policy: self.send_header('Content-Security-Policy', policy)
        self.end_headers()
        try:
            for offset in range(0, len(body), 5000):
                chunk=body[offset:offset+5000]; time.sleep(len(chunk)/50000); self.wfile.write(chunk); self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError): pass
for port, relative in [(32917, '_backup/performance-baseline-7de43b0'), (32918, 'dist')]:
    server=ThreadingHTTPServer(('127.0.0.1',port),Handler); server.root=(ROOT/relative).resolve()
    threading.Thread(target=server.serve_forever,daemon=True).start()
print('Controlled benchmark ready: old http://127.0.0.1:32917 / new http://127.0.0.1:32918; 800ms RTT, 50KB/s; no production writes',flush=True)
threading.Event().wait()
