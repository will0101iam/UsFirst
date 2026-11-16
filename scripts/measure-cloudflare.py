#!/usr/bin/env python3
"""Read-only UsFirst transport baseline; no real credentials, account writes or private bodies.
Each curl is a fresh connection. Separates DNS/TCP/TLS, first byte, body download and
Worker Server-Timing. Invalid-session lookup is a one-SQL proxy, NOT paired home timing.
Does not change DNS, VPN, proxy settings, placement or system configuration.
"""
import argparse, datetime, hashlib, json, pathlib, re, statistics, subprocess
parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True)
parser.add_argument('--rounds',type=int,default=3)
parser.add_argument('--environment',default='macos-user-network')
args=parser.parse_args()
if not 1<=args.rounds<=5:raise SystemExit('rounds must be 1..5')
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'dist/index.html').read_text()
main=re.search(r'<script\b[^>]*src="(/assets/[^\"]+\.js)"[^>]*>',html).group(1)
build=re.search(r'name="usfirst-build" content="([^\"]+)"',html).group(1)
revision=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()
base='https://usfirst.sopia.work'
probes=[('health','/api/health',False),('anonymous-bootstrap','/api/bootstrap',False),('invalid-session-lookup','/api/bootstrap',True),('html','/',False),('main-js',main,False)]
result={'contract':{'revision':revision,'build':build,'base':base,'environment':args.environment,'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runner':'curl fresh process per request; existing system networking unchanged','request':'GET; no real session; no automatic retry; HTTP negotiated; curl --compressed; redirects disabled','rounds':args.rounds,'connect_timeout_s':8,'total_timeout_s':15,'boundaries':{'dns_ms':'time_namelookup','tcp_ms':'time_connect-time_namelookup','tls_ms':'time_appconnect-time_connect','request_to_first_byte_ms':'time_starttransfer-time_pretransfer (includes network, not only Worker)','body_ms':'time_total-time_starttransfer','server_ms':'Server-Timing app; includes Worker logic; invalid session one SQL, anonymous zero SQL'},'placement_decision':'EVIDENCE_REQUIRED until real target + unchanged fingerprint + paired A/B/semantics/guard. No production placement change in baseline.'},'samples':[]}
marker='\n__USFIRST_CURL_METRICS__'
for round_no in range(args.rounds):
 order=probes[round_no%len(probes):]+probes[:round_no%len(probes)]
 for name,path,lookup in order:
  cmd=['curl','--silent','--show-error','--compressed','--connect-timeout','8','--max-time','15','--dump-header','-','--write-out',marker+'%{json}',base+path]
  if lookup:cmd.extend(['--header','Cookie: usfirst_session='+'0'*64])
  run=subprocess.run(cmd,capture_output=True)
  row={'round':round_no+1,'probe':name,'path':path,'exit_code':run.returncode}
  stdout=run.stdout
  if marker.encode() in stdout:
   response,metric=stdout.rsplit(marker.encode(),1)
   try:m=json.loads(metric)
   except Exception:m={}
   blocks=response.split(b'\r\n\r\n');headers=b'';body=b''
   for i,block in enumerate(blocks):
    if block.startswith(b'HTTP/'):
     headers=block
     body=b'\r\n\r\n'.join(blocks[i+1:])
   if not headers:
    blocks=response.split(b'\n\n')
    for i,block in enumerate(blocks):
     if block.startswith(b'HTTP/'):headers=block;body=b'\n\n'.join(blocks[i+1:])
   hs=headers.decode('latin1');allowed={}
   for line in hs.splitlines()[1:]:
    if ':' not in line:continue
    k,v=line.split(':',1)
    if k.lower() in ['server-timing','cf-ray','cf-cache-status','content-type','content-encoding','cache-control','cf-placement']:allowed[k.lower()]=v.strip()
   t=lambda k:float(m.get(k,0) or 0)
   row.update(http_status=m.get('http_code'),http_version=m.get('http_version'),headers=allowed,received_bytes=m.get('size_download'),dns_ms=round(t('time_namelookup')*1000,2),tcp_ms=round(max(0,t('time_connect')-t('time_namelookup'))*1000,2),tls_ms=round(max(0,t('time_appconnect')-t('time_connect'))*1000,2),request_to_first_byte_ms=round(max(0,t('time_starttransfer')-t('time_pretransfer'))*1000,2),body_ms=round(max(0,t('time_total')-t('time_starttransfer'))*1000,2),total_ms=round(t('time_total')*1000,2))
   server=re.search(r'(?:^|,)\s*app;dur=([\d.]+)',allowed.get('server-timing',''))
   if server:row['server_ms']=float(server.group(1))
   if run.returncode==0:
    if path.startswith('/api'):
     try:
      value=json.loads(body)
      row['oracle_ok']=(value=={'ok':True,'service':'UsFirst'}) if name=='health' else value.get('session')=={'user':None,'pair':None,'recognitionAvailable':False} and value.get('requests')==[] and isinstance(value.get('revision'),str)
     except Exception:row['oracle_ok']=False
    elif name=='html':row['oracle_ok']=('content="'+build+'"').encode() in body and b'id="boot-shell"' in body
    else:row['oracle_ok']=hashlib.sha256(body).digest()==hashlib.sha256((root/('dist'+path)).read_bytes()).digest()
  if run.returncode:row['error']=run.stderr.decode(errors='replace').strip()[-350:]
  result['samples'].append(row)
  pathlib.Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2))
  print(json.dumps(row,ensure_ascii=False),flush=True)
summary={}
for name,_,_ in probes:
 rows=[r for r in result['samples'] if r['probe']==name]
 good=[r for r in rows if r['exit_code']==0 and r.get('http_status')==200 and r.get('oracle_ok')]
 s={'attempted':len(rows),'successful':len(good),'failed_or_invalid':len(rows)-len(good)}
 for k in ['total_ms','dns_ms','tcp_ms','tls_ms','request_to_first_byte_ms','body_ms','server_ms']:
  vals=[r[k] for r in good if k in r]
  if vals:s[k]={'median':round(statistics.median(vals),2),'min':min(vals),'max':max(vals)}
 summary[name]=s
result['summary']=summary
pathlib.Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps({'summary':summary},ensure_ascii=False),flush=True)
