// server.js — the actual process entrypoint. Kept intentionally thin:
// all app construction lives in app.js so tests can import that directly.

require('dotenv').config();

const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Chess Analyzer server running at http://localhost:${PORT}`);
});
