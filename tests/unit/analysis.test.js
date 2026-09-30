// tests/unit/analysis.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFrontendScripts } = require('../helpers/loadFrontendScript');

// analysis.js's functions reference PIECE_VALUES from utils.js and Chess/
// engineType as globals, so both files load into the same sandbox context.
const mod = loadFrontendScripts(['utils.js', 'analysis.js']);

test.beforeEach(() => {
  mod.engineType = 'modern'; // reset between tests; some tests flip this to 'legacy'
});

// --- classifyMove -----------------------------------------------------

test('classifyMove: early low-loss move is book', () => {
  const result = mod.classifyMove('e4', 'e2e4', 5, false, 0, 'startpos-fen', []);
  assert.equal(result, 'book');
});

test('classifyMove: matching the engine\'s move with no sacrifice is best', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const result = mod.classifyMove('e5', 'e7e5', 0, false, 20, fen, []);
  assert.equal(result, 'best');
});

test('classifyMove: matching the engine\'s move WITH a sacrifice is brilliant', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const result = mod.classifyMove('e5', 'e7e5', 0, true, 20, fen, []);
  assert.equal(result, 'brilliant');
});

test('classifyMove: low loss + big gap to the next-best line is great', () => {
  // Sharp position: the runner-up move is a full pawn worse than the best.
  const lines = [{ multipv: 1, score: 150 }, { multipv: 2, score: 10 }];
  const result = mod.classifyMove('Qh4', 'g1f3', 10, false, 20, 'some-fen', lines);
  assert.equal(result, 'great');
});

test('classifyMove: low loss but the alternatives were nearly as good is just good', () => {
  // Flexible position: runner-up is barely behind the best move.
  const lines = [{ multipv: 1, score: 30 }, { multipv: 2, score: 25 }];
  const result = mod.classifyMove('a4', 'e4e5', 0, false, 17, 'some-fen', lines);
  assert.equal(result, 'good');
});

test('classifyMove: low loss with no second line available falls back to good', () => {
  const lines = [{ multipv: 1, score: 30 }];
  const result = mod.classifyMove('a4', 'e4e5', 0, false, 17, 'some-fen', lines);
  assert.equal(result, 'good');
});

test('classifyMove: threshold boundaries (modern engine)', () => {
  const lines = []; // no second line -> low-loss branch always resolves to 'good', not 'great'
  assert.equal(mod.classifyMove('x', 'y', 20, false, 20, 'fen', lines), 'good');   // <=20 -> good (no gap data)
  assert.equal(mod.classifyMove('x', 'y', 50, false, 20, 'fen', lines), 'good');   // <=50 -> good
  assert.equal(mod.classifyMove('x', 'y', 51, false, 20, 'fen', lines), 'miss');   // >50 -> miss
  assert.equal(mod.classifyMove('x', 'y', 100, false, 20, 'fen', lines), 'miss');  // <=100 -> miss
  assert.equal(mod.classifyMove('x', 'y', 101, false, 20, 'fen', lines), 'bad');   // >100 -> bad
  assert.equal(mod.classifyMove('x', 'y', 250, false, 20, 'fen', lines), 'bad');   // <=250 -> bad
  assert.equal(mod.classifyMove('x', 'y', 251, false, 20, 'fen', lines), 'blunder'); // >250 -> blunder
});

test('classifyMove: legacy engine is more forgiving via the threshold multiplier', () => {
  mod.engineType = 'legacy';
  // 100cp would be 'bad' on the modern engine (>50, <=100 -> actually 'miss';
  // pick a value that's 'blunder' on modern but not on legacy: 260cp.
  const modernResult = (() => { mod.engineType = 'modern'; return mod.classifyMove('x', 'y', 260, false, 20, 'fen', []); })();
  mod.engineType = 'legacy';
  const legacyResult = mod.classifyMove('x', 'y', 260, false, 20, 'fen', []);
  assert.equal(modernResult, 'blunder');   // 260 > 250 on modern's ×1 multiplier
  assert.equal(legacyResult, 'bad');       // 260 <= 250*2.5=625 on legacy's ×2.5 multiplier
});

// --- detectSacrifice ----------------------------------------------------
//
// NOTE: while writing these tests, trying to construct a genuine "true"
// case for the ORIGINAL detectSacrifice() implementation turned out to be
// impossible — it compared the mover's own material immediately before vs.
// after their own move, which a legal chess move can never reduce (captures
// only remove the opponent's piece; promotions only add value). That means
// `isSacrifice` always evaluated false and `Brilliant` was dead,
// unreachable code. Fixed in analysis.js to check whether the piece just
// moved is immediately recapturable by the opponent for less than it's
// worth — these tests are against that corrected version.

test('detectSacrifice: true for a real sacrifice (queen moves where only a pawn can take it)', () => {
  const fen = '4k3/8/8/3p4/8/8/8/4K2Q w - - 0 1'; // White queen h1, Black pawn d5
  const move = { from: 'h1', to: 'e4' }; // Qe4 — only the d5 pawn can recapture on e4
  assert.equal(mod.detectSacrifice(fen, move), true);
});

test('detectSacrifice: false for a quiet developing move', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const move = { from: 'g1', to: 'f3' }; // Nf3, nothing can capture on f3
  assert.equal(mod.detectSacrifice(fen, move), false);
});

test('detectSacrifice: false for an even-ish trade (a recapture exists, but the value gap is too small)', () => {
  // White knight (320) captures a black knight on d5; a black bishop (330)
  // can recapture there. The mover isn't really giving anything up — the
  // recapturing piece costs the opponent more than what was placed — so
  // this must NOT count as a sacrifice, unlike the no-recapture-available
  // case above.
  const fen = '4k3/1b6/8/3n4/8/2N5/8/4K3 w - - 0 1';
  const move = { from: 'c3', to: 'd5' }; // Nxd5, recapturable by the b7 bishop
  assert.equal(mod.detectSacrifice(fen, move), false);
});

test('detectSacrifice: false for an illegal/malformed move rather than throwing', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const move = { san: 'Nxe5' }; // not a legal move from this position
  assert.doesNotThrow(() => mod.detectSacrifice(fen, move));
  assert.equal(mod.detectSacrifice(fen, move), false);
});

// --- computeGameStats ---------------------------------------------------

function analysisEntry(classification, cpLoss) {
  return { move: { san: 'x' }, classification, cpLoss, score: 0 };
}

test('computeGameStats: matches the worked example from the README', () => {
  // Real game from this session: every move Book/Good/Best, zero mistakes,
  // yet accuracy isn't 100% — this is the exact scenario the README's
  // "Accuracy calculation" section documents.
  const whiteCpLoss = [5, 0, 9, 8, 4, 8, 17, 0, 9, 42, 13];
  const blackCpLoss = [7, 5, 0, 8, 4, 4, 0, 0, 5, 5];
  const moveAnalysis = [];
  for (let i = 0; i < whiteCpLoss.length + blackCpLoss.length; i++) {
    const isWhite = i % 2 === 0;
    const cpLoss = isWhite ? whiteCpLoss[i / 2] : blackCpLoss[(i - 1) / 2];
    moveAnalysis.push(analysisEntry('good', cpLoss));
  }

  const stats = mod.computeGameStats(moveAnalysis);
  assert.equal(Math.round(stats.whiteAccuracy * 10) / 10, 97.9);
  assert.equal(Math.round(stats.blackAccuracy * 10) / 10, 99.2);
});

test('computeGameStats: counts blunders/brilliants/misses/bestMoves correctly', () => {
  const moveAnalysis = [
    analysisEntry('best', 0),
    analysisEntry('blunder', 300),
    analysisEntry('brilliant', 0),
    analysisEntry('bad', 150),
    analysisEntry('miss', 80),
    analysisEntry('book', 5), // book should NOT count as a "best move" — see the comment in analysis.js
  ];
  const stats = mod.computeGameStats(moveAnalysis);
  assert.equal(stats.blunders, 1);
  assert.equal(stats.brilliants, 1);
  assert.equal(stats.misses, 2); // 'bad' and 'miss' both count
  assert.equal(stats.bestMoves, 1); // only the literal 'best' entry, not 'book'
});

test('computeGameStats: skips null entries (unanalyzed free-play moves) without throwing', () => {
  const moveAnalysis = [analysisEntry('best', 0), null, analysisEntry('good', 10)];
  assert.doesNotThrow(() => mod.computeGameStats(moveAnalysis));
  const stats = mod.computeGameStats(moveAnalysis);
  assert.equal(stats.bestMoves, 1);
});

test('computeGameStats: a side with zero moves gets 100% accuracy, not NaN', () => {
  const moveAnalysis = [analysisEntry('best', 0)]; // only White has moved
  const stats = mod.computeGameStats(moveAnalysis);
  assert.equal(stats.blackAccuracy, 100);
});

test('computeGameStats: accuracy never goes negative even with huge average loss', () => {
  const moveAnalysis = [analysisEntry('blunder', 5000)];
  const stats = mod.computeGameStats(moveAnalysis);
  assert.equal(stats.whiteAccuracy, 0);
});
