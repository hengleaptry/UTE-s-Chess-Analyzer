// tests/integration/auth.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startTestServer, stopTestServer } = require('../helpers/testServer');
const { TestClient } = require('../helpers/testClient');

function uniqueUsername() {
  return 'user_' + crypto.randomBytes(6).toString('hex');
}

test('auth flows', async (t) => {
  const { server, baseUrl } = await startTestServer();
  t.after(() => stopTestServer(server));

  await t.test('register creates an account and sets a session cookie', async () => {
    const client = new TestClient(baseUrl);
    const username = uniqueUsername();
    const res = await client.post('/api/auth/register', { username, password: 'correcthorse' });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.username, username);
    assert.ok(client.cookie, 'a session cookie should have been set');
  });

  await t.test('register rejects a duplicate username', async () => {
    const username = uniqueUsername();
    const client1 = new TestClient(baseUrl);
    await client1.post('/api/auth/register', { username, password: 'correcthorse' });

    const client2 = new TestClient(baseUrl);
    const res = await client2.post('/api/auth/register', { username, password: 'differentpass' });
    assert.equal(res.status, 400);
  });

  await t.test('register rejects a too-short password', async () => {
    const client = new TestClient(baseUrl);
    const res = await client.post('/api/auth/register', { username: uniqueUsername(), password: 'short' });
    assert.equal(res.status, 400);
  });

  await t.test('register rejects an invalid username', async () => {
    const client = new TestClient(baseUrl);
    const res = await client.post('/api/auth/register', { username: 'a', password: 'correcthorse' });
    assert.equal(res.status, 400);
  });

  await t.test('login succeeds with correct credentials', async () => {
    const username = uniqueUsername();
    const setup = new TestClient(baseUrl);
    await setup.post('/api/auth/register', { username, password: 'correcthorse' });

    const client = new TestClient(baseUrl);
    const res = await client.post('/api/auth/login', { username, password: 'correcthorse' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.username, username);
  });

  await t.test('login fails with the wrong password', async () => {
    const username = uniqueUsername();
    const setup = new TestClient(baseUrl);
    await setup.post('/api/auth/register', { username, password: 'correcthorse' });

    const client = new TestClient(baseUrl);
    const res = await client.post('/api/auth/login', { username, password: 'wrongpassword' });
    assert.equal(res.status, 401);
  });

  await t.test('login fails for a username that does not exist', async () => {
    const client = new TestClient(baseUrl);
    const res = await client.post('/api/auth/login', { username: uniqueUsername(), password: 'whatever123' });
    assert.equal(res.status, 401);
  });

  await t.test('/me returns 401 with no session', async () => {
    const client = new TestClient(baseUrl);
    const res = await client.get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  await t.test('/me returns the logged-in user with a valid session', async () => {
    const username = uniqueUsername();
    const client = new TestClient(baseUrl);
    await client.post('/api/auth/register', { username, password: 'correcthorse' });

    const res = await client.get('/api/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.user.username, username);
  });

  await t.test('logout clears the session', async () => {
    const username = uniqueUsername();
    const client = new TestClient(baseUrl);
    await client.post('/api/auth/register', { username, password: 'correcthorse' });

    const logoutRes = await client.post('/api/auth/logout');
    assert.equal(logoutRes.status, 200);

    const meRes = await client.get('/api/auth/me');
    assert.equal(meRes.status, 401);
  });
});
