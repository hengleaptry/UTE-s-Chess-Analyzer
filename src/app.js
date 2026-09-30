// app.js — builds and returns the Express app. No side effects at import
// time (no app.listen(), no dotenv.config()) so this can be safely required
// by tests, which need to control environment variables and the port
// themselves. server.js is the actual process entrypoint.

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { readSession } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const gamesRoutes = require('./routes/games');

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // The frontend loads Stockfish from jsDelivr/cdnjs, talks to a Worker built
  // from a blob: URL, and calls the public Lichess Explorer API — the CSP has
  // to explicitly allow all three or the app breaks silently in the browser
  // console.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
          workerSrc: ["'self'", 'blob:'],
          connectSrc: [
            "'self'",
            'https://cdnjs.cloudflare.com',
            'https://cdn.jsdelivr.net',
            'https://explorer.lichess.ovh',
          ],
          imgSrc: ["'self'", 'data:', 'https://upload.wikimedia.org'],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    })
  );

  app.use(express.json({ limit: '3mb' })); // saved games can carry a sizeable analysis payload
  app.use(cookieParser());
  app.use(readSession);

  // Rate-limit auth endpoints specifically (brute-force / spam signup protection).
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
  // Games endpoints are behind auth already, but a compromised or careless
  // client could otherwise hammer the save endpoint with no limit at all.
  const gamesLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/games', gamesLimiter, gamesRoutes);

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Any other request falls back to the SPA shell.
  app.get('/*splat', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

module.exports = { createApp };
