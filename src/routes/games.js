// routes/games.js

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // every route below requires a logged-in user

const MAX_PGN_BYTES = 200_000;
const MAX_ANALYSIS_BYTES = 2_000_000; // move-by-move classification data can be sizeable for long games

// List the current user's saved games (lightweight — no pgn/analysis payload).
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, white_player, black_player, result, white_accuracy, black_accuracy, created_at
       FROM games WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(req.user.id);
  res.json({ games: rows });
});

// Fetch one saved game in full, including its PGN and stored analysis.
router.get('/:id', (req, res) => {
  const row = db
    .prepare('SELECT * FROM games WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Game not found.' });

  let analysis = null;
  if (row.analysis_json) {
    try {
      analysis = JSON.parse(row.analysis_json);
    } catch (e) {
      analysis = null; // corrupt/old data shouldn't crash the request
    }
  }

  res.json({
    game: {
      id: row.id,
      title: row.title,
      pgn: row.pgn,
      whitePlayer: row.white_player,
      blackPlayer: row.black_player,
      result: row.result,
      whiteAccuracy: row.white_accuracy,
      blackAccuracy: row.black_accuracy,
      analysis,
      createdAt: row.created_at,
    },
  });
});

// Save a newly analyzed game.
router.post('/', (req, res) => {
  const { title, pgn, whitePlayer, blackPlayer, result, whiteAccuracy, blackAccuracy, analysis } = req.body || {};

  if (typeof pgn !== 'string' || !pgn.trim()) {
    return res.status(400).json({ error: 'PGN is required.' });
  }
  if (Buffer.byteLength(pgn, 'utf8') > MAX_PGN_BYTES) {
    return res.status(413).json({ error: 'PGN is too large.' });
  }

  let analysisJson = null;
  if (analysis !== undefined && analysis !== null) {
    analysisJson = JSON.stringify(analysis);
    if (Buffer.byteLength(analysisJson, 'utf8') > MAX_ANALYSIS_BYTES) {
      return res.status(413).json({ error: 'Analysis data is too large.' });
    }
  }

  const safeTitle = (typeof title === 'string' && title.trim()) ? title.trim().slice(0, 120) : 'Untitled game';

  const info = db
    .prepare(
      `INSERT INTO games (user_id, title, pgn, white_player, black_player, result, white_accuracy, black_accuracy, analysis_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      safeTitle,
      pgn,
      typeof whitePlayer === 'string' ? whitePlayer.slice(0, 120) : null,
      typeof blackPlayer === 'string' ? blackPlayer.slice(0, 120) : null,
      typeof result === 'string' ? result.slice(0, 20) : null,
      typeof whiteAccuracy === 'number' ? whiteAccuracy : null,
      typeof blackAccuracy === 'number' ? blackAccuracy : null,
      analysisJson
    );

  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM games WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Game not found.' });
  res.json({ ok: true });
});

module.exports = router;
