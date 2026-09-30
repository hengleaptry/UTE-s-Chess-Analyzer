// middleware/auth.js — verifies the httpOnly JWT cookie and attaches req.user.

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set a real secret.');
}

const COOKIE_NAME = 'session';
const TOKEN_TTL = '7d';

function signSession(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

// Attaches req.user if a valid session cookie is present; never blocks the
// request on its own (routes decide whether auth is required).
function readSession(req, _res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = { id: payload.sub, username: payload.username };
    } catch (e) {
      // expired/invalid cookie — treat as logged out rather than erroring
    }
  }
  next();
}

// Route guard for endpoints that require a logged-in user.
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

module.exports = { signSession, setSessionCookie, clearSessionCookie, readSession, requireAuth, COOKIE_NAME };
