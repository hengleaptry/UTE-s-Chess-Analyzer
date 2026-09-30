// tests/unit/utils.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFrontendScripts } = require('../helpers/loadFrontendScript');

const mod = loadFrontendScripts(['utils.js']);

test('stripPgnNoise removes headers, comments, and variations', () => {
  const pgn = `[Event "Test"]\n[White "A"]\n\n1. e4 {a comment} e5 2. Nf3 ;line comment\nNc6 3. Bb5 (3. Bc4 Bc5) a6 $1`;
  const stripped = mod.stripPgnNoise(pgn);
  assert.ok(!stripped.includes('['), 'headers should be stripped');
  assert.ok(!stripped.includes('{'), 'comments should be stripped');
  assert.ok(!stripped.includes(';'), 'line comments should be stripped');
  assert.ok(!stripped.includes('('), 'variations should be stripped');
  assert.ok(!stripped.includes('$1'), 'NAGs should be stripped');
  assert.ok(stripped.includes('e4') && stripped.includes('Nf3') && stripped.includes('Bb5'));
});

test('stripPgnNoise handles nested variations', () => {
  const pgn = `1. e4 e5 (1... c5 (1... e6 2. d4) 2. Nf3) 2. Nf3`;
  const stripped = mod.stripPgnNoise(pgn);
  assert.ok(!stripped.includes('('));
  assert.ok(!stripped.includes(')'));
});

test('looksLikeFEN accepts a valid FEN', () => {
  assert.equal(mod.looksLikeFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), true);
});

test('looksLikeFEN rejects PGN move text', () => {
  assert.equal(mod.looksLikeFEN('1. e4 e5 2. Nf3 Nc6'), false);
});

test('looksLikeFEN rejects garbage', () => {
  assert.equal(mod.looksLikeFEN('not a fen at all'), false);
  assert.equal(mod.looksLikeFEN(''), false);
});

test('parsePGNHeaders extracts multiple headers', () => {
  const pgn = `[Event "Italian Game"]\n[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5`;
  const headers = mod.parsePGNHeaders(pgn);
  assert.equal(headers.Event, 'Italian Game');
  assert.equal(headers.White, 'Alice');
  assert.equal(headers.Black, 'Bob');
  assert.equal(headers.Result, '1-0');
});

test('parsePGNHeaders returns an empty object when there are no headers', () => {
  const headers = mod.parsePGNHeaders('1. e4 e5 2. Nf3 Nc6');
  // Not assert.deepEqual({}) here: `headers` was created inside the vm
  // sandbox, a different JS realm than this test file, so it has a
  // different Object.prototype identity even when structurally identical —
  // deepEqual/deepStrictEqual would spuriously fail. Check shape directly.
  assert.equal(Object.keys(headers).length, 0);
});
