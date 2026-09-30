// tests/helpers/testServer.js
//
// Boots the real Express app (src/app.js) against an ephemeral port with an
// isolated in-memory SQLite database, for integration tests. Node's test
// runner spawns a separate process per test file, so setting these env vars
// here — before src/app.js (and its transitive require of src/db.js) is
// ever required — is safe and won't leak across test files.

const http = require('http');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-production';
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

const { createApp } = require('../../src/app');

async function startTestServer() {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://localhost:${port}` };
}

function stopTestServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

module.exports = { startTestServer, stopTestServer };
