import http.client, json, struct, time
from pathlib import Path

# Use the complete Compose stack so the file passes through the browser proxy.
password=next(x.split('=',1)[1] for x in Path('.security-compose.env').read_text().splitlines() if x.startswith('POSTGRES_PASSWORD='))
cookies={}
def request(method,path,body=None,headers=None):
 conn=http.client.HTTPConnection('localhost',8081,timeout=180)
 h={'Origin':'http://localhost:8081','Cookie':'; '.join(f'{k}={v}' for k,v in cookies.items())}
 if 'sailsight.csrf' in cookies:h['X-CSRF-Token']=cookies['sailsight.csrf']
 h.update(headers or {})
 conn.request(method,path,body,h);r=conn.getresponse()
 for name,value in r.getheaders():
  if name.lower()=='set-cookie':
   key,val=value.split(';',1)[0].split('=',1);cookies[key]=val
 data=r.read();conn.close();return r.status,data
assert request('GET','/api/v1/auth/providers')[0]==200
assert request('POST','/api/v1/auth/login',json.dumps({'email':'compose-admin@test.local','password':password}),{'Content-Type':'application/json'})[0]==200
path=Path('.security-boundary.vkx')
base=b'\xff\x01'+bytes(6)+b'\x08'+bytes(12)+b'\x0a'+b'\x02'+struct.pack('<Qii7f',int(time.time()*1000),550000000,120000000,1,0,0,1,0,0,0)
remaining=200_000_000-len(base)
# Internal record lengths 53, 17 and 13 allow an exact 200,000,000-byte file.
n=remaining//53
while True:
 rem=remaining-n*53
 found=next(((a,(rem-a*17)//13) for a in range(rem//17+1) if (rem-a*17)%13==0),None)
 if found:break
 n-=1
with path.open('wb') as f:
 f.write(base);chunk=(b'\x21'+bytes(52))*10_000
 for _ in range(n//10_000):f.write(chunk)
 f.write((b'\x21'+bytes(52))*(n%10_000));f.write((b'\x0e'+bytes(16))*found[0]);f.write((b'\x07'+bytes(12))*found[1])
assert path.stat().st_size==200_000_000
prefix=b'--boundary\r\nContent-Disposition: form-data; name="file"; filename="boundary.vkx"\r\nContent-Type: application/octet-stream\r\n\r\n'
suffix=b'\r\n--boundary--\r\n'
def upload(extra=0,cancel=False):
 conn=http.client.HTTPConnection('localhost',8081,timeout=180)
 conn.putrequest('POST','/api/v1/sessions')
 for k,v in {'Origin':'http://localhost:8081','Cookie':'; '.join(f'{k}={v}' for k,v in cookies.items()),'X-CSRF-Token':cookies['sailsight.csrf'],'Content-Type':'multipart/form-data; boundary=boundary','Content-Length':str(len(prefix)+200_000_000+extra+len(suffix))}.items():conn.putheader(k,v)
 conn.endheaders();conn.send(prefix)
 with path.open('rb') as f:
  while chunk:=f.read(65536):
   conn.send(chunk)
   if cancel:conn.close();return None
 if extra:conn.send(b'\x00'*extra)
 conn.send(suffix);r=conn.getresponse();status=r.status;body=r.read();conn.close();return status,body
try:
 started=time.monotonic();result=upload();assert result[0]==201,result;print(f'Exact 200,000,000-byte file: 201 in {time.monotonic()-started:.2f}s')
 result=upload(1);assert result[0]==413,result;print('200,000,001-byte file: 413')
 upload(cancel=True);print('Cancelled upload connection closed during streaming')
finally:path.unlink()
