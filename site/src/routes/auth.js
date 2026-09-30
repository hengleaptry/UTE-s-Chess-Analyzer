// routes/auth.js

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signSession, setSessionCookie, clearSessionCookie, requireAuth } = require('../middleware/auth');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return badRequest(res, 'Username must be 3-20 characters: letters, numbers, underscores only.');
  }
  if (typeof password !== 'string' || password.length < 8) {
    return badRequest(res, 'Password must be at least 8 characters.');
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return badRequest(res, 'That username is already taken.');

  const passwordHash = await bcrypt.hash(password, 12);
  const info = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, passwordHash);

  const user = { id: info.lastInsertRowid, username };
  setSessionCookie(res, signSession(user));
  res.status(201).json({ user });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return badRequest(res, 'Username and password are required.');
  }

  const row = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username);
  // Compare against a dummy hash even when the user doesn't exist, so the
  // response time doesn't leak whether a username is registered.
  const hashToCheck = row ? row.password_hash : '$2a$12$invalidsaltinvalidsaltinvalidsaltinvOK';
  const valid = await bcrypt.compare(password, hashToCheck);

  if (!row || !valid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const user = { id: row.id, username: row.username };
  setSessionCookie(res, signSession(user));
  res.json({ user });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
