// Run inside the trusted web container against a disposable API instance.
import assert from 'node:assert/strict';
const base = process.env.API_BASE_URL ?? 'http://api:8080';
async function post(path, ip, body) {
  return fetch(`${base}/api/v1${path}`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:8081', 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify(body)
  });
}
const seed = Math.floor(Math.random() * 200) + 1;
const a = `198.18.${seed}.1`, b = `198.18.${seed}.2`;
for (let i = 0; i < 5; i++)
  assert.equal((await post('/auth/login', a, { email: `missing-${i}@test.local`, password: 'Invalid-test-password-123!' })).status, 401);
assert.equal((await post('/auth/login', a, { email: 'missing@test.local', password: 'Invalid-test-password-123!' })).status, 429);
assert.equal((await post('/auth/login', b, { email: 'missing@test.local', password: 'Invalid-test-password-123!' })).status, 401);
assert.equal((await post('/auth/invitation/redeem', a, { token: 'invalid', email: 'missing@test.local', password: 'Invalid-test-password-123!', displayName: 'Test' })).status, 400);
console.log('Login IP partitions and separate invitation budget: passed (8 assertions).');
