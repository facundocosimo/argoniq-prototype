// Real HTTP session and PDF access checks; no AI calls, password resets or fixture resets.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:3100';
const id = (n) => `a1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const cookies = new Map();
async function request(path, body) {
  const response = await fetch(base + path, {
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    headers: {
      origin: base,
      'content-type': 'application/json',
      cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
    },
  });
  for (const raw of response.headers.getSetCookie()) {
    const pair = raw.split(';')[0];
    const split = pair.indexOf('=');
    cookies.set(pair.slice(0, split), pair.slice(split + 1));
  }
  return response;
}
const source = (n) => `/api/storage/tenants/${id(1)}/documents/${id(n)}/source.pdf`;
assert.equal((await request(source(20))).status, 404);
const login = await request('/api/auth/sign-in/email', {
  email: 'operator@training.invalid',
  password: 'Training-only-password-2026',
});
assert.equal(login.status, 200, 'synthetic operator can sign in');
try {
  assert.equal((await request('/api/auth/organization', { tenantId: id(1) })).status, 200);
  const machines = await request('/machines');
  assert.equal(machines.status, 200);
  assert.match(await machines.text(), /ATLAS-DEMO-001/);
  for (const [n, name] of [
    [20, 'atlas-operator-en'],
    [21, 'atlas-operator-it'],
  ]) {
    const response = await request(source(n));
    assert.equal(response.status, 200, name);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      await readFile(new URL(`../../output/pdf/${name}.pdf`, import.meta.url)),
    );
  }
  assert.equal((await request(source(23))).status, 404, 'internal manual stays private');
  console.log(
    'PASS sample-user HTTP login, workspace access, machine list, PDF downloads, and anonymous/internal access denials',
  );
} finally {
  assert.equal((await request('/api/auth/sign-out', {})).status, 200);
}
