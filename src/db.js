// db.js — SQLite setup (better-sqlite3: synchronous, no connection pool needed
// for a small app like this, and it keeps every route handler simple).

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Tests set DB_PATH=:memory: so each test run gets a fresh, isolated
// database with no cleanup required and no interference with the real
// data/chess-analyzer.db file.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'chess-analyzer.db');

if (DB_PATH !== ':memory:') {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
if (DB_PATH !== ':memory:') db.pragma('journal_mode = WAL'); // WAL isn't supported for in-memory databases
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS games (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    pgn            TEXT NOT NULL,
    white_player   TEXT,
    black_player   TEXT,
    result         TEXT,
    white_accuracy REAL,
    black_accuracy REAL,
    analysis_json  TEXT,     -- serialized move-by-move classification, so re-opening a
                              -- saved game doesn't require re-running Stockfish
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id);
`);

module.exports = db;
