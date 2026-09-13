import http.cookiejar,json,struct,time,urllib.request,urllib.error,uuid
from pathlib import Path
password=next(x.split('=',1)[1] for x in Path('.security-compose.env').read_text().splitlines() if x.startswith('POSTGRES_PASSWORD='))
jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def call(method,path,body=None,content='application/json'):
 headers={'Origin':'http://localhost:8081','Content-Type':content}
 for cookie in jar:
  if cookie.name=='sailsight.csrf':headers['X-CSRF-Token']=cookie.value
 if isinstance(body,dict):body=json.dumps(body).encode()
 try:r=opener.open(urllib.request.Request('http://localhost:8081/api/v1'+path,data=body,headers=headers,method=method),timeout=180)
 except urllib.error.HTTPError as error:r=error
 data=r.read()
 try: payload=json.loads(data) if data else None
 except json.JSONDecodeError: payload=data.decode(errors='replace')[:1000]
 return r.status,payload
assert call('GET','/auth/providers')[0]==200
assert call('POST','/auth/login',{'email':'compose-admin@test.local','password':password})[0]==200
base_time=int(time.time()*1000)
def file(races):
 data=bytearray(b'\xff\x01'+bytes(6)+b'\x08'+bytes(12)+b'\x0a')
 for i in range(races*3):
  timestamp=base_time+i*100
  if i%3==1:data.extend(b'\x04'+struct.pack('<QBi',timestamp,3,0))
  data.extend(b'\x02'+struct.pack('<Qii7f',timestamp,550000000,120000000,1,0,0,1,0,0,0))
  if i%3==2:data.extend(b'\x04'+struct.pack('<QBi',timestamp,4,0))
 return data
def upload(data):
 boundary=uuid.uuid4().hex
 body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="workload.vkx"\r\n\r\n').encode()+data+f'\r\n--{boundary}--\r\n'.encode()
 return call('POST','/sessions',body,'multipart/form-data; boundary='+boundary)
for count in [1000,5000]:
 started=time.monotonic();status,data=upload(file(count));elapsed=time.monotonic()-started
 assert status==201,(status,data)
 assert len(data['races'])==count
 print(f'{count} races / {count*3} positions: {elapsed:.3f}s')
status,data=upload(file(10001));assert status==413,(status,data);print('10,001 races: 413')
status,data=upload(b'\xff\x01'+bytes(6)+(b'\x07'+bytes(12))*5_000_000)
assert status==413,(status,data);print('5,000,001 records: 413')
for attempt in range(21):
 status,_=upload(b'\xff')
 if status==429:print(f'Upload rate budget enforced after {attempt} additional attempts');break
else:raise AssertionError('Upload rate limiter did not reject')
