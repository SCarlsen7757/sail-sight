"""Integration checks against the disposable database and API started by start-security-test.ps1."""
import concurrent.futures, http.cookiejar, json, os, struct, urllib.request, urllib.error, urllib.parse, uuid
from pathlib import Path

BASE=os.environ.get('SECURITY_API_ROOT','http://127.0.0.1:18080/api/v1')
ORIGIN=os.environ.get('SECURITY_ORIGIN','http://localhost:18081')
ADMIN_EMAIL=os.environ.get('SECURITY_ADMIN_EMAIL','security-admin@test.local')
PASSWORD=next(x.split('=',1)[1] for x in Path(os.environ.get('SECURITY_TEST_ENV','.security-test.env')).read_text().splitlines() if x.startswith('POSTGRES_PASSWORD='))
checks=0
class Client:
 def __init__(self):
  self.jar=http.cookiejar.CookieJar(); self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
 def call(self,method,path,body=None,headers=None,csrf=True):
  h={'Origin':ORIGIN}
  if csrf:
   for c in self.jar:
    if c.name=='sailsight.csrf':h['X-CSRF-Token']=c.value
  if body is not None and not isinstance(body,bytes):body=json.dumps(body).encode();h['Content-Type']='application/json'
  h.update(headers or {})
  try:r=self.opener.open(urllib.request.Request(BASE+path,data=body,headers=h,method=method),timeout=120)
  except urllib.error.HTTPError as e:r=e
  raw=r.read()
  try:data=json.loads(raw)
  except ValueError:data=raw.decode(errors='replace')
  return r.status,data,r.headers
def expect(result,status,label):
 global checks
 assert result[0]==status, f'{label}: expected {status}, got {result[0]}: {str(result[1])[:400]}'
 checks+=1; return result[1]
admin=Client();expect(admin.call('GET','/auth/providers'),200,'providers')
expect(admin.call('POST','/auth/login',{'email':ADMIN_EMAIL,'password':PASSWORD}),200,'admin login')
aid=expect(admin.call('GET','/me'),200,'admin profile')['id']
expect(admin.call('PATCH','/me',{'displayName':'forged'},csrf=False),403,'cookie-only csrf')
expect(admin.call('PATCH','/me',{'displayName':'forged'},headers={'Origin':'https://hostile.test'}),403,'hostile origin')
expect(admin.call('PATCH',f'/admin/users/{aid}',{'role':'User'}),409,'final administrator')

def account(role='User'):
 email=f'{uuid.uuid4().hex}@test.local'
 data=expect(admin.call('POST','/admin/users',{'email':email,'displayName':'Test','role':role}),201,'create account')
 url=urllib.parse.urlparse(data['setupUrl']);query=urllib.parse.parse_qs(url.query)
 client=Client();client.call('GET','/auth/providers')
 payload={'userId':query['userId'][0],'token':query['token'][0],'password':PASSWORD}
 expect(client.call('POST','/auth/setup/complete',payload),200,'setup redemption')
 expect(Client().call('POST','/auth/setup/complete',payload),400,'setup replay')
 return client,query['userId'][0]

owner,oid=account(); teammate,tid=account();other,uid=account()
team=expect(owner.call('POST','/teams',{'name':'Test crew'}),201,'create team')['id']
invite=expect(owner.call('POST',f'/teams/{team}/invites',{'email':expect(teammate.call('GET','/me'),200,'team profile')['email'],'role':'Admin'}),200,'invite admin')
expect(teammate.call('POST',f'/me/invites/{invite["id"]}/accept'),200,'accept team invite')
expect(teammate.call('PATCH',f'/teams/{team}/members/{tid}',{'role':'Owner'}),403,'team administrator self-promotion')
expect(owner.call('PATCH',f'/teams/{team}/members/{tid}',{'role':'999'}),400,'undefined role')
expect(owner.call('PATCH',f'/teams/{team}/members/{oid}',{'role':'Member'}),409,'final team owner')

def vkx(samples=10003):
 data=bytearray(b'\xff\x01'+bytes(6)+b'\x08'+bytes(12)+b'\x0a')
 for i in range(samples):
  time=1700000000000+i*100
  if i==10:data.extend(b'\x04'+struct.pack('<QBi',time,3,0))
  data.extend(b'\x02'+struct.pack('<Qii7f',time,550000000,120000000,1,0,0,1,0,0,0))
  if i==samples-1:data.extend(b'\x04'+struct.pack('<QBi',time,4,0))
 return bytes(data)
def upload(client,data,name='private-sentinel.vkx'):
 boundary='security-boundary'
 body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n').encode()+data+f'\r\n--{boundary}--\r\n'.encode()
 return client.call('POST','/sessions',body,{'Content-Type':f'multipart/form-data; boundary={boundary}'})
file=vkx();session=expect(upload(owner,file),201,'valid upload');sid=session['id'];rid=session['races'][0]['id']
boatclass=expect(admin.call('POST','/boat-classes',{'name':uuid.uuid4().hex}),201,'create boat class')['id']
foreignboat=expect(other.call('POST','/boats',{'name':'Foreign boat','boatClassId':boatclass}),201,'create foreign boat')['id']
foreigncourse=expect(other.call('POST','/courses',{'name':'Foreign course','year':2026,'legs':[]}),201,'create foreign course')['id']
expect(owner.call('PATCH',f'/sessions/{sid}',{'boatId':foreignboat,'notes':'illegal'}),400,'reject foreign boat')
expect(owner.call('PATCH',f'/sessions/{sid}',{'courseId':foreigncourse,'notes':'illegal'}),400,'reject foreign course')
expect(owner.call('PATCH',f'/races/{rid}',{'courseId':foreigncourse,'notes':'illegal'}),400,'reject foreign race course')
assert expect(owner.call('GET',f'/sessions/{sid}'),200,'unchanged rejected assignment')['notes'] is None;checks+=1
expect(upload(owner,file),409,'duplicate upload')
expect(upload(owner,b'\xff\x01'),400,'malformed upload')
lateFailure=bytearray(file)
struct.pack_into('<Q',lateFailure,len(lateFailure)-13,1700000000000+10003*100)
rollbackName='rollback-'+uuid.uuid4().hex
expect(upload(owner,lateFailure,rollbackName+'.vkx'),400,'invalid race rolls back inserted session')
rolledBack=expect(owner.call('GET','/sessions?search='+rollbackName),200,'rollback session search')
assert rolledBack['total']==0;checks+=1
expect(owner.call('PATCH',f'/sessions/{sid}',{'notes':'session-secret','isPublic':True}),200,'publish')
expect(owner.call('PATCH',f'/races/{rid}',{'notes':'race-secret'}),200,'race notes')
expect(owner.call('PUT',f'/sessions/{sid}/shares',{'teamId':team}),200,'team share')
for c in [Client(),other]:
 data=expect(c.call('GET',f'/sessions/{sid}'),200,'public detail')
 assert data['fileName']=='' and data['contentHash']=='' and data['notes'] is None and data['races'][0]['notes'] is None
 assert 'sentinel' not in data['displayName'];checks+=1
 data=expect(c.call('GET','/sessions?search=private-sentinel'),200,'public filename search');assert data['total']==0;checks+=1
 data=expect(c.call('GET',f'/races/{rid}'),200,'public race detail');assert data['notes'] is None;checks+=1
data=expect(teammate.call('GET',f'/sessions/{sid}'),200,'team detail');assert data['notes']=='session-secret';checks+=1
expect(teammate.call('PATCH',f'/sessions/{sid}',{'notes':'illegal'}),404,'team read only')
expect(owner.call('DELETE',f'/teams/{team}/members/{tid}'),204,'remove member')
data=expect(teammate.call('GET',f'/sessions/{sid}'),200,'removed member public projection');assert data['notes'] is None;checks+=1
first=owner.call('GET',f'/races/{rid}/telemetry/positions?from=-1');expect(first,200,'prestart telemetry');assert len(first[1])==10000;checks+=1
second=expect(owner.call('GET',f'/races/{rid}/telemetry/positions?from=-1&offset={first[2]["X-Next-Offset"]}'),200,'telemetry continuation')
assert len(second)==3 and first[1][-1]['time']<second[0]['time'];checks+=1
expect(owner.call('GET',f'/races/{rid}/telemetry?from=100&to=1'),400,'reversed window')
expect(owner.call('GET',f'/races/{rid}/telemetry?from=-100'),400,'out-of-session window')
expect(admin.call('DELETE',f'/admin/users/{oid}'),409,'ownership deletion conflict')
expect(Client().call('GET','/me',headers={'Authorization':'Bearer vkx_oldtoken'}),401,'old bearer token rejected')
expect(owner.call('GET','/me/tokens'),404,'PAT endpoint removed');expect(owner.call('GET',f'/races/{rid}/summary'),404,'AI endpoint removed')

# Replacement setup links invalidate both previous links and existing sessions.
replacement=expect(admin.call('POST',f'/admin/users/{uid}/setup-link'),200,'replacement setup link')
expect(other.call('GET','/me'),401,'recovery revokes cookie')
newest=expect(admin.call('POST',f'/admin/users/{uid}/setup-link'),200,'second replacement setup link')
old=urllib.parse.parse_qs(urllib.parse.urlparse(replacement['setupUrl']).query)
expect(Client().call('POST','/auth/setup/complete',{'userId':uid,'token':old['token'][0],'password':PASSWORD}),400,'replacement rejects previous link')

# Failed registration must not consume invitation uses.
invitation=expect(admin.call('POST','/admin/invitations',{'role':'User','maxUses':1,'expiresInDays':1}),201,'create account invitation')
token=urllib.parse.parse_qs(urllib.parse.urlparse(invitation['url']).query)['token'][0]
email=f'{uuid.uuid4().hex}@test.local'
expect(Client().call('POST','/auth/invitation/redeem',{'token':token,'email':email,'password':'short','displayName':'Test'}),400,'invitation failure rollback')
validated=expect(Client().call('GET','/auth/invitation/validate?token='+urllib.parse.quote(token)),200,'invitation not consumed')
assert validated['remainingUses']==1;checks+=1
expect(Client().call('POST','/auth/invitation/redeem',{'token':token,'email':email,'password':PASSWORD,'displayName':'Test'}),200,'invitation succeeds after rollback')

# Two simultaneous self-demotions cannot remove the final owner.
invite=expect(owner.call('POST',f'/teams/{team}/invites',{'email':expect(teammate.call('GET','/me'),200,'team profile')['email'],'role':'Owner'}),200,'invite second owner')
expect(teammate.call('POST',f'/me/invites/{invite["id"]}/accept'),200,'accept owner invite')
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 results=list(pool.map(lambda pair: pair[0].call('PATCH',f'/teams/{team}/members/{pair[1]}',{'role':'Member'})[0],[(owner,oid),(teammate,tid)]))
assert sorted(results)==[200,409],results;checks+=1

# Two administrators race to demote themselves; exactly one must survive.
backup,bid=account('Admin')
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 results=list(pool.map(lambda pair: pair[0].call('PATCH',f'/admin/users/{pair[1]}',{'role':'User'})[0],[(admin,aid),(backup,bid)]))
assert sorted(results)==[200,409],results;checks+=1
demoted=admin if results[0]==200 else backup
survivor=backup if results[0]==200 else admin
expect(demoted.call('GET','/me'),401,'demotion revokes cookie immediately')
if results[0]==200:
 expect(survivor.call('PATCH',f'/admin/users/{aid}',{'role':'Admin'}),200,'restore original administrator')
 admin=Client();admin.call('GET','/auth/providers');expect(admin.call('POST','/auth/login',{'email':ADMIN_EMAIL,'password':PASSWORD}),200,'restored administrator login')
expect(admin.call('PATCH',f'/admin/users/{bid}',{'role':'User'}),200,'leave original administrator')

# Deletion preserves a transferred team's history and revokes the deleted account.
former,formerId=account()
transferred=expect(former.call('POST','/teams',{'name':'Transferred history'}),201,'create transferable team')['id']
expect(admin.call('DELETE',f'/admin/users/{formerId}'),409,'sole team owner cannot be deleted')
invite=expect(former.call('POST',f'/teams/{transferred}/invites',{'email':expect(teammate.call('GET','/me'),200,'successor profile')['email'],'role':'Owner'}),200,'invite successor owner')
expect(teammate.call('POST',f'/me/invites/{invite["id"]}/accept'),200,'accept successor ownership')
expect(former.call('DELETE',f'/teams/{transferred}/members/{formerId}'),204,'former owner leaves')
expect(admin.call('DELETE',f'/admin/users/{formerId}'),204,'delete former creator')
expect(former.call('GET','/me'),401,'deleted account cookie revoked')
expect(teammate.call('GET',f'/teams/{transferred}'),200,'team survives creator deletion')

# A notification stream must revalidate before sending another update.
streamUser,streamUid=account()
stream=streamUser.opener.open(urllib.request.Request(BASE+'/me/notifications/stream'),timeout=35)
assert stream.readline().startswith(b'data:');checks+=1
expect(admin.call('POST',f'/admin/users/{streamUid}/setup-link'),200,'revoke streaming account')
expect(owner.call('POST','/boat-classes/requests',{'name':'Stream update'}),201,'trigger stream update')
assert b'data:' not in stream.read();stream.close();checks+=1
print(f'Passed {checks} integration assertions; session {sid}.')
