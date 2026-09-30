// tests/integration/games.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startTestServer, stopTestServer } = require('../helpers/testServer');
const { TestClient } = require('../helpers/testClient');

function uniqueUsername() {
  return 'user_' + crypto.randomBytes(6).toString('hex');
}

async function registeredClient(baseUrl) {
  const client = new TestClient(baseUrl);
  const username = uniqueUsername();
  await client.post('/api/auth/register', { username, password: 'correcthorse' });
  return client;
}

const SAMPLE_GAME = {
  title: 'Italian Game test',
  pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',
  whitePlayer: 'Alice',
  blackPlayer: 'Bob',
  result: '*',
  whiteAccuracy: 92.5,
  blackAccuracy: 87.3,
  analysis: [
    { san: 'e4', classification: 'book', cpLoss: 0, eval: 20 },
    { san: 'e5', classification: 'book', cpLoss: 5, eval: 15 },
  ],
};

test('games routes', async (t) => {
  const { server, baseUrl } = await startTestServer();
  t.after(() => stopTestServer(server));

  await t.test('all games routes require auth', async () => {
    const anon = new TestClient(baseUrl);
    assert.equal((await anon.get('/api/games')).status, 401);
    assert.equal((await anon.post('/api/games', SAMPLE_GAME)).status, 401);
    assert.equal((await anon.get('/api/games/1')).status, 401);
    assert.equal((await anon.del('/api/games/1')).status, 401);
  });

  await t.test('save requires a non-empty pgn', async () => {
    const client = await registeredClient(baseUrl);
    const res = await client.post('/api/games', { title: 'no pgn', pgn: '' });
    assert.equal(res.status, 400);
  });

  await t.test('save then list then fetch round-trips correctly', async () => {
    const client = await registeredClient(baseUrl);

    const saveRes = await client.post('/api/games', SAMPLE_GAME);
    assert.equal(saveRes.status, 201);
    assert.ok(saveRes.body.id);

    const listRes = await client.get('/api/games');
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.games.length, 1);
    assert.equal(listRes.body.games[0].title, SAMPLE_GAME.title);
    // The list endpoint is metadata-only — no pgn/analysis payload, to keep
    // it fast (see README "Backend & API").
    assert.equal(listRes.body.games[0].pgn, undefined);

    const getRes = await client.get(`/api/games/${saveRes.body.id}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.game.pgn, SAMPLE_GAME.pgn);
    assert.equal(getRes.body.game.whitePlayer, SAMPLE_GAME.whitePlayer);
    assert.equal(getRes.body.game.whiteAccuracy, SAMPLE_GAME.whiteAccuracy);
    assert.equal(getRes.body.game.analysis.length, 2);
    assert.equal(getRes.body.game.analysis[1].classification, 'book');
  });

  await t.test('a user cannot read another user\'s game', async () => {
    const owner = await registeredClient(baseUrl);
    const saveRes = await owner.post('/api/games', SAMPLE_GAME);

    const intruder = await registeredClient(baseUrl);
    const res = await intruder.get(`/api/games/${saveRes.body.id}`);
    assert.equal(res.status, 404); // not 403 — existence isn't confirmed either, matching current behavior
  });

  await t.test('a user cannot delete another user\'s game', async () => {
    const owner = await registeredClient(baseUrl);
    const saveRes = await owner.post('/api/games', SAMPLE_GAME);

    const intruder = await registeredClient(baseUrl);
    const delRes = await intruder.del(`/api/games/${saveRes.body.id}`);
    assert.equal(delRes.status, 404);

    // Confirm it's still there for the actual owner.
    const getRes = await owner.get(`/api/games/${saveRes.body.id}`);
    assert.equal(getRes.status, 200);
  });

  await t.test('delete removes the game for its owner', async () => {
    const client = await registeredClient(baseUrl);
    const saveRes = await client.post('/api/games', SAMPLE_GAME);

    const delRes = await client.del(`/api/games/${saveRes.body.id}`);
    assert.equal(delRes.status, 200);

    const getRes = await client.get(`/api/games/${saveRes.body.id}`);
    assert.equal(getRes.status, 404);
  });

  await t.test('deleting a nonexistent game returns 404', async () => {
    const client = await registeredClient(baseUrl);
    const res = await client.del('/api/games/999999');
    assert.equal(res.status, 404);
  });

  await t.test('an oversized pgn is rejected', async () => {
    const client = await registeredClient(baseUrl);
    const res = await client.post('/api/games', { ...SAMPLE_GAME, pgn: 'x'.repeat(250_000) });
    assert.equal(res.status, 413);
  });

  await t.test('a game with no analysis payload still saves (pre-analysis save)', async () => {
    const client = await registeredClient(baseUrl);
    const res = await client.post('/api/games', { title: 'unanalyzed', pgn: '1. e4 e5' });
    assert.equal(res.status, 201);

    const getRes = await client.get(`/api/games/${res.body.id}`);
    assert.equal(getRes.body.game.analysis, null);
  });

  await t.test('each user only sees their own games in the list', async () => {
    const userA = await registeredClient(baseUrl);
    const userB = await registeredClient(baseUrl);

    await userA.post('/api/games', { ...SAMPLE_GAME, title: "A's game" });
    await userB.post('/api/games', { ...SAMPLE_GAME, title: "B's game" });

    const listA = await userA.get('/api/games');
    const listB = await userB.get('/api/games');

    assert.equal(listA.body.games.length, 1);
    assert.equal(listA.body.games[0].title, "A's game");
    assert.equal(listB.body.games.length, 1);
    assert.equal(listB.body.games[0].title, "B's game");
  });
});
