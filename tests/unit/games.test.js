// tests/unit/games.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const { loadFrontendScripts } = require('../helpers/loadFrontendScript');

const mod = loadFrontendScripts(['games.js']);

function parseMoves(pgn) {
  const g = new Chess();
  g.load_pgn(pgn, { sloppy: true });
  return g.history({ verbose: true });
}

test('buildMoveAnalysisFromStored: fenAfter of move i matches fenBefore of move i+1 (no broken chain)', () => {
  const moves = parseMoves('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5');
  const storedAnalysis = moves.map((m) => ({ san: m.san, classification: 'book', cpLoss: 0, eval: 20 }));

  const result = mod.buildMoveAnalysisFromStored(moves, storedAnalysis);

  for (let i = 0; i < result.length - 1; i++) {
    assert.equal(result[i].fenAfter, result[i + 1].fenBefore, `chain broken at move ${i}`);
  }
});

test('buildMoveAnalysisFromStored: final position matches replaying the PGN directly', () => {
  const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6';
  const moves = parseMoves(pgn);
  const storedAnalysis = moves.map((m) => ({ san: m.san, classification: 'book', cpLoss: 0, eval: 0 }));

  const result = mod.buildMoveAnalysisFromStored(moves, storedAnalysis);

  const reference = new Chess();
  reference.load_pgn(pgn, { sloppy: true });

  assert.equal(result[result.length - 1].fenAfter, reference.fen());
});

test('buildMoveAnalysisFromStored: preserves classification/cpLoss/eval from the stored payload', () => {
  const moves = parseMoves('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6 5. O-O d6');
  const storedAnalysis = moves.map((m, i) => ({
    san: m.san,
    classification: i === 6 ? 'good' : 'book',
    cpLoss: i === 6 ? 17 : 0,
    eval: i * 5,
  }));

  const result = mod.buildMoveAnalysisFromStored(moves, storedAnalysis);

  assert.equal(result[6].classification, 'good');
  assert.equal(result[6].cpLoss, 17);
  assert.equal(result[6].score, 30); // eval field maps to .score, matching analyzeGame()'s own shape
  assert.equal(result[0].classification, 'book');
});

test('buildMoveAnalysisFromStored: a missing entry produces null at that index, not a crash', () => {
  const moves = parseMoves('1. e4 e5 2. Nf3 Nc6');
  const storedAnalysis = [
    { san: 'e4', classification: 'book', cpLoss: 0, eval: 20 },
    null, // e.g. a free-play move that was never analyzed
    { san: 'Nf3', classification: 'book', cpLoss: 0, eval: 15 },
    { san: 'Nc6', classification: 'book', cpLoss: 0, eval: 10 },
  ];

  assert.doesNotThrow(() => mod.buildMoveAnalysisFromStored(moves, storedAnalysis));
  const result = mod.buildMoveAnalysisFromStored(moves, storedAnalysis);
  assert.equal(result[1], null);
  assert.equal(result[0].classification, 'book');
  assert.equal(result[2].classification, 'book');
});

test('buildMoveAnalysisFromStored: move objects are the same references passed in (renderMoveBadges relies on this)', () => {
  const moves = parseMoves('1. e4 e5');
  const storedAnalysis = moves.map((m) => ({ san: m.san, classification: 'book', cpLoss: 0, eval: 0 }));
  const result = mod.buildMoveAnalysisFromStored(moves, storedAnalysis);
  assert.equal(result[0].move, moves[0]);
  assert.equal(result[1].move, moves[1]);
});
