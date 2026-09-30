// tests/helpers/loadFrontendScript.js
//
// The frontend is plain <script> files sharing one global scope (no bundler,
// no modules — see README "Tech Stack"), so they can't be `require()`d
// directly. This loads one or more of them into a vm sandbox that stubs just
// enough of the browser environment (Chess, a settable `engineType`) for
// their pure logic functions to run, and hands back the sandbox so tests can
// call those functions directly.
//
// This is the same approach used earlier in this project to verify the
// Stockfish worker-loading shim against the real library source before
// shipping it — running the actual file content, not reimplementing it.

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');

const PUBLIC_JS = path.join(__dirname, '..', '..', 'public', 'js');

function loadFrontendScripts(filenames) {
  const sandbox = { Chess, console };
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  // engine.js's `engineType` global, which classifyMove() reads to decide
  // how forgiving to be — default to the modern engine; tests can override
  // via sandbox.engineType = 'legacy' between calls.
  sandbox.engineType = 'modern';

  for (const filename of filenames) {
    const source = fs.readFileSync(path.join(PUBLIC_JS, filename), 'utf8');
    vm.runInContext(source, sandbox, { filename });
  }

  return sandbox;
}

module.exports = { loadFrontendScripts };
