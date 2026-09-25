# ♟️ UTE's Chess Analyzer

[![Engine](https://img.shields.io/badge/engine-Stockfish%2016%20NNUE-1abc9c)](https://stockfishchess.org/)
[![WebAssembly](https://img.shields.io/badge/powered%20by-WebAssembly-654ff0)](https://webassembly.org/)
[![No Build Step](https://img.shields.io/badge/build%20step-none-2ecc71)]()
[![Stack](https://img.shields.io/badge/stack-HTML%20%2F%20CSS%20%2F%20JS-f1c40f)]()
[![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red)]()

A browser-based chess analysis tool powered by **Stockfish 16 NNUE**, with Chess.com-style move classification, a live evaluation graph, free-play/explore mode, and hand-drawn board annotations — all running client-side, no backend required.

Developed for the University for Technology and Entrepreneurship (UTE).

```bash
git clone <your-repo-url>
cd chess-analyzer
python3 -m http.server 8000
# open http://localhost:8000
```

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Controls](#controls)
- [Move Classification](#move-classification)
- [Engine Performance Settings](#engine-performance-settings)
- [Export Formats](#export-formats)
- [Glossary](#glossary)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [How the Engine Loads](#how-the-engine-loads)
- [Implementation Deep Dives](#implementation-deep-dives)
- [Browser Support](#browser-support)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Credits](#credits)

---

## Features

- **Stockfish 16 NNUE analysis** — runs entirely in a Web Worker via WebAssembly, with automatic fallback to a legacy asm.js engine if NNUE/WASM isn't supported in the browser.
- **Chess.com-style move classification** — moves are labeled `Book`, `Brilliant`, `Best`, `Great`, `Good`, `Miss`, `Bad`, or `Blunder` based on centipawn loss, sacrifice detection, and (for `Great`) how much better the played move was than the next-best alternative.
- **Live evaluation bar & graph** — track the game's momentum move-by-move, with a scrubber to jump to any point.
- **Free Play & Explore mode** — play out your own moves from any position, either from scratch or branching off a loaded game, with live engine feedback after every move.
- **Board annotations** — right-click and drag to draw arrows, right-click a square to highlight it (just like chess.com/lichess).
- **Opening Explorer** — live master-game statistics and popular continuations for the current position, pulled from the [Lichess Explorer API](https://lichess.org/api#tag/Opening-Explorer).
- **Game statistics** — accuracy percentages per side, blunder/brilliant/miss/best-move counts.
- **Export** — download your analysis as annotated PGN, full-detail JSON, the current position as FEN, or the evaluation graph as a PNG.
- **Configurable engine settings** — adjustable search depth, MultiPV (number of lines), and thread count.
- **Sound & theme** — move/capture/check sound effects with a volume slider, and a light/dark theme toggle.
- **Keyboard shortcuts** — navigate, flip the board, auto-play, and trigger analysis without touching the mouse.

## Tech Stack

| Layer         | Technology                                                                 |
|---------------|-----------------------------------------------------------------------------|
| Chess logic   | [chess.js](https://github.com/jhlywa/chess.js) (move generation & PGN/FEN) |
| Engine        | [Stockfish 16 NNUE](https://stockfishchess.org/) (WASM) with Stockfish 10 (asm.js) fallback |
| Opening data  | [Lichess Opening Explorer API](https://lichess.org/api#tag/Opening-Explorer) |
| UI            | Vanilla HTML / CSS / JavaScript — no frameworks, no build step             |

## Getting Started

This project uses **Web Workers and WebAssembly** to run Stockfish, which browsers block from local files loaded via `file://`. You must serve it over HTTP.

### Option 1 — VS Code Live Server (recommended)
1. Open the project folder in VS Code.
2. Install the **Live Server** extension (by Ritwick Dey).
3. Right-click `index.html` → **Open with Live Server**.

### Option 2 — Python
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000`.

### Option 3 — Node.js
```bash
npx serve .
```
Then open the URL it prints.

## Deployment

No backend, no build step, no environment variables — this deploys as-is to any static host. **GitHub Pages** is the simplest option for a project already on GitHub:

1. Push the repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Source**, select the branch (e.g. `main`) and the root folder.
4. Save — GitHub will publish it at `https://<your-username>.github.io/<repo-name>/`.

That's it; there's nothing else to configure since the app only talks to public CDNs and the Lichess API, both of which work fine from any origin.

## Controls

| Action              | Shortcut / Control            |
|----------------------|--------------------------------|
| Navigate moves       | `←` `→`                        |
| Auto-play            | `Space`                        |
| Flip board           | `F`                             |
| Analyze game         | `A`                              |
| Draw an arrow        | Right-click and drag              |
| Highlight a square   | Right-click                        |
| Move a piece         | Drag and drop, or click-click       |

## Move Classification

| Badge         | Meaning                                                                 |
|---------------|--------------------------------------------------------------------------|
| **Book**      | Recognized opening theory (early game, minimal loss)                    |
| **Brilliant** | Matches the engine's best move *and* involves a real material sacrifice |
| **Best**      | Matches the engine's top choice                                         |
| **Great**     | Near-zero loss in a sharp position where the next-best move was clearly worse |
| **Good**      | Small centipawn loss                                                    |
| **Miss**      | Moderate centipawn loss — a missed opportunity                          |
| **Bad**       | Significant centipawn loss                                              |
| **Blunder**   | Severe centipawn loss                                                   |

### How it actually works

Every move is analyzed by comparing two engine evaluations: the position **before** the move (what was the best achievable outcome?) and the position **after** it (what did the played move actually lead to?).

```js
const moverEvalBefore = beforeResult.score;   // engine's eval of the position, from the mover's perspective
const moverEvalAfter  = -afterResult.score;   // engine reports from the *next* side to move, so this is negated
const cpLoss = Math.max(0, moverEvalBefore - moverEvalAfter);
```

That negation matters: Stockfish always reports a score from the perspective of whoever is to move *next*. Since a move just changes whose turn it is, `afterResult.score` is naturally from the opponent's point of view — flipping its sign converts it back to "how good is this for the player who just moved," which is what `cpLoss` needs to be perspective-safe.

`cpLoss` then drives a tiered classification, with a more forgiving multiplier when the legacy (weaker) engine is active, since its evaluations are noisier:

```js
const isLegacy = engineType === 'legacy';
const thresholdMultiplier = isLegacy ? 2.5 : 1;

if (ply < 12 && cpLoss <= 30 * thresholdMultiplier) return 'book';
if (isMoveEquivalent(san, bestMove, fenBefore)) return isSacrifice ? 'brilliant' : 'best';
// ...cpLoss <= 20 → possibly 'great' (see below), else 'good'
if (cpLoss <= 50  * thresholdMultiplier) return 'good';
if (cpLoss <= 100 * thresholdMultiplier) return 'miss';
if (cpLoss <= 250 * thresholdMultiplier) return 'bad';
return 'blunder';
```

| cpLoss (modern engine) | cpLoss (legacy, ×2.5) | Classification |
|---|---|---|
| ≤ 30 (first 12 plies only) | ≤ 75 | `book` |
| 0, and matches engine's #1 move | 0, and matches engine's #1 move | `best` (or `brilliant`, see below) |
| ≤ 20 | ≤ 50 | `great` *or* `good` — see next section |
| ≤ 50 | ≤ 125 | `good` |
| ≤ 100 | ≤ 250 | `miss` |
| ≤ 250 | ≤ 625 | `bad` |
| above that | above that | `blunder` |

**Brilliant** is `best` (matches the engine's top move) *plus* a real material sacrifice, detected by comparing the mover's total material immediately before and after the move:

```js
function detectSacrifice(fenBefore, move) {
  // ...compute total piece value for the mover before and after the move
  return (moverBefore - moverAfter) >= 100; // lost at least a minor piece's worth, on purpose
}
```

**Great** is the subtlest one. A move that loses 0cp but wasn't the engine's literal #1 pick isn't necessarily impressive — in a flexible position, several moves might be equally fine. To tell a genuinely critical moment from an ordinary one, the app requests the engine's **top 2 lines** (not just 1) and checks the *gap* between them:

```js
if (cpLoss <= 20 * thresholdMultiplier) {
  const line1 = lines.find(l => l.multipv === 1);
  const line2 = lines.find(l => l.multipv === 2);
  const alternativeGap = line1.score - line2.score;
  return alternativeGap >= 100 * thresholdMultiplier ? 'great' : 'good';
}
```

If the second-best line is at least a pawn (`100cp`) worse than the best, the position was "sharp" — most other moves would have been clearly worse, so finding a near-optimal one is genuinely notable (`great`). If the gap is small, several moves were roughly equivalent, so it's just `good`. This is a heuristic approximation of chess.com's own classifier, not an exact reproduction — see [Known Limitations](#known-limitations).

## Engine Performance Settings

Full-game analysis time is driven by **Engine Depth** and which engine is active (NNUE is roughly 2x faster than the legacy fallback per move):

| Depth | Move time (modern engine) | Move time (legacy engine) |
|-------|---------------------------|------------------------------|
| 12 (Fast)      | 2.0s | 4.0s |
| 16 (Balanced)  | 4.0s | 8.0s |
| 20 (Deep)      | 8.0s | 15.0s |
| 25 (Very Deep) | 15.0s | 25.0s |

These are *per move*, so a 40-move game at depth 16 on the modern engine takes roughly 40 × 4s ≈ 2.7 minutes. Drop to depth 12 for a quick pass, or raise it for a deeper post-game review. Analysis also always requests at least 2 engine lines (regardless of the MultiPV setting) so `Great` moves can be told apart from ordinary ones — see [Move Classification](#move-classification).

## Export Formats

| Format | Contents |
|--------|----------|
| **PGN** | Standard PGN plus a comment after every move: `{ CLASSIFICATION \| CP Loss: N \| Eval: X.XX }` |
| **JSON** | Full move list (`san`, `classification`, `cpLoss`, `eval`) plus white/black accuracy |
| **FEN** | The position at the currently-viewed move, copied to your clipboard |
| **PNG** | A snapshot of the evaluation graph |

Example of an exported PGN:

```
[Event "Analyzed Game"]
[Date "2026-09-24"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5

{ BOOK | CP Loss: 0 | Eval: 0.25 }
{ BOOK | CP Loss: 6 | Eval: -0.31 }
{ BOOK | CP Loss: 9 | Eval: 0.22 }
{ BOOK | CP Loss: 0 | Eval: -0.13 }
```

## Glossary

A few terms used throughout the settings and tables above, for anyone not already familiar with chess engines:

| Term | Meaning |
|------|---------|
| **UCI** | Universal Chess Interface — the standard protocol apps use to talk to engines like Stockfish (send a position, get back an evaluation and a best move) |
| **Depth** | How many moves ahead the engine calculates before settling on an evaluation. Higher = stronger and slower. |
| **Centipawn (cp)** | 1/100th of a pawn's value — the engine's unit of evaluation. `+150cp` ≈ White is ahead by about 1.5 pawns' worth of advantage. |
| **CP Loss** | How much worse a played move's resulting evaluation is compared to the engine's best move from that position. Lower is better; `0` means the move was objectively optimal. |
| **MultiPV** | "Multiple Principal Variations" — how many candidate best-move lines the engine reports at once, instead of just its single top choice. |
| **NNUE** | "Efficiently Updatable Neural Network" — the neural-network evaluation function Stockfish 16 uses internally; it's why the modern engine is both stronger and pickier about WASM/SIMD support than the older asm.js build. |

## Project Structure

```
.
├── index.html            # App shell / layout
├── css/
│   └── styles.css        # All styling
└── js/
    ├── utils.js           # Constants, icons, PGN/FEN helpers
    ├── engine.js          # Stockfish worker loading & UCI communication
    ├── annotations.js     # Right-click arrows & square highlights
    ├── board.js           # Board rendering, drag/drop, free-play logic
    ├── analysis.js        # Move classification & game statistics
    ├── ui.js               # Eval graph, audio, export, opening explorer
    └── main.js             # Init, PGN loading, move navigation
```

## Architecture

```
PGN / FEN input
      │
      ▼
 chess.js  ──  move validation, board state, history
      │
      ▼
 board.js  ──  renders squares/pieces, handles drag-drop & clicks
      │
      ▼
 engine.js  ──UCI──▶  Stockfish Worker (WASM or asm.js fallback)
      │                        │
      ▼                        ▼
 analysis.js  ◀── centipawn evals, best move, PV lines
      │
      ▼
 ui.js  ──  eval bar/graph, move list, engine lines panel, export
```

`main.js` wires everything together on load (PGN parsing, navigation, keyboard shortcuts); `annotations.js` is an independent overlay for arrows/highlights that doesn't touch engine state at all.

## How the Engine Loads

This is the trickiest part of the codebase, so it's worth explaining properly rather than just asserting it works.

### The constraint

Stockfish is pulled from a CDN (jsDelivr for the modern NNUE build, cdnjs for the legacy fallback) instead of being bundled with the app. But browsers **refuse to construct a `Worker` directly from a cross-origin script URL** — `new Worker('https://cdn.../stockfish.js')` throws a `SecurityError`. The standard workaround is to fetch nothing directly and instead create a same-origin `Blob` whose only job is to `importScripts()` the real, cross-origin file — `importScripts()`, unlike the `Worker` constructor, *is* allowed to load cross-origin scripts:

```js
function createWorkerViaImportScripts(jsUrl) {
  const code = `importScripts(${JSON.stringify(jsUrl)});`;
  const blob = new Blob([code], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}
```

This alone is enough for the **legacy** engine (Stockfish 10, asm.js) — it has no separate `.wasm` file to locate and just starts talking UCI over `postMessage`/`onmessage` immediately.

### Why the modern engine needs more

The NNUE build ships a `.wasm` file alongside its `.js` file and has to find it at runtime. It auto-detects "am I running inside a Worker?" and, if so, tries to resolve the `.wasm` file's location **relative to its own script location** — which is meaningless when that "location" is a throwaway `blob:` URL with no relationship to where the `.wasm` file actually lives. The usual Emscripten escape hatch for this, a global `Module.locateFile` hook, is **not read at all** in this code path — the library builds its own internal config object when it detects a Worker and ignores anything set externally.

The fix is to stop the library from taking that auto-detecting path in the first place. Digging into the (minified) source shows a second, saner path: if `document.currentScript` exists, the library hands back its **raw, uninvoked factory function** via `document.currentScript._exports` instead of auto-running itself — and that raw factory *does* honor a `locateFile` override, because at that point we're the ones calling it.

```js
const code = `
  // Make the library think it's not running in a bare Worker, so it takes
  // the "hand back the factory" path instead of auto-running with a
  // location it can't resolve.
  self.window = self;
  self.document = { currentScript: {} };
  importScripts(${JSON.stringify(jsUrl)});

  const StockfishFactory = self.document.currentScript._exports;

  // Call the factory ourselves, with a locateFile override that actually
  // gets respected because we're the caller this time.
  const engine = await StockfishFactory({
    locateFile: (path) => path.includes('.wasm') ? ${JSON.stringify(wasmUrl)} : path
  });

  // Wire up UCI manually, using the library's own internal calling
  // convention (verified against its source, not guessed).
  engine.addMessageListener(line => postMessage(line));
  self.onmessage = (ev) => engine.onCustomMessage(ev.data);
`;
```

This was verified by actually running the fetched library source through a simulated Worker environment (mocked `self`/`document`) in Node, confirming `document.currentScript._exports` resolves to a real, callable factory and that the library's own auto-init never fires — rather than trusting a reading of the minified source alone.

### Fallback behavior

`initStockfish()` tries the modern engine first, with a generous timeout to allow for the ~40MB WASM download. If the handshake (`uci` → `uciok`) doesn't complete in time, or the worker reports an error, it falls back to the legacy engine automatically and reflects which one is active in the engine badge (`✓ Stockfish 16 NNUE Ready` vs `⚠ Stockfish 10 (Legacy - Less Accurate)`), rather than failing silently or hanging indefinitely.

See `js/engine.js` for the complete implementation.

## Implementation Deep Dives

The rest of the app has a few pieces of non-obvious logic worth documenting properly rather than leaving as "read the source."

### Engine request queueing

Stockfish can only run one search at a time — sending a second `go` command while it's still thinking a previous position corrupts both results. Every call site (`analyzeGame`, free-play analysis, explore-mode analysis) calls the same `analyzePosition()`, so the queueing lives in one place instead of being each caller's problem:

```js
let engineQueue = Promise.resolve();

function analyzePosition(fen, targetDepth, moveTimeMs, multiPvOverride) {
  const run = engineQueue.then(() => analyzePositionRaw(fen, targetDepth, moveTimeMs, multiPvOverride));
  engineQueue = run.then(() => {}, () => {}); // chain the next call after this one, success or failure
  return run;
}
```

Each call attaches itself to the tail of a running promise chain and becomes the new tail. Callers just `await analyzePosition(...)` as if the engine were free-threaded; in reality every request queues up and runs strictly one-after-another.

### Free play, explore mode & cancellation tokens

Free play triggers a fresh engine analysis after every move (`maybeAnalyzeExploredPosition`, `recordFreePlayMove`). If the user makes several moves quickly, older in-flight analyses shouldn't be allowed to overwrite the board with stale results once they finally resolve. Rather than pulling in `AbortController` plumbing through the engine layer, the app uses a simple monotonically-increasing token:

```js
let exploreToken = 0;

async function maybeAnalyzeExploredPosition() {
  const myToken = ++exploreToken;      // claim the current "generation"
  const result = await analyzePosition(fen, depth, moveTimeMs, multiPvCount);
  if (myToken !== exploreToken) return; // a newer move happened while we were waiting — discard
  updateEvalBar(result.score, stm === 'w');
  // ...
}
```

Anything that changes the position out from under an in-flight analysis (a new move, undo, resetting to the loaded game, starting a fresh board) bumps `exploreToken`. When a stale analysis finally resolves, its captured `myToken` no longer matches the current value, so it silently drops its own result instead of rendering it over newer state.

### Evaluation bar & graph scaling

A linear eval bar is nearly useless in practice — a +2 and a +9 position both look "basically winning," but a linear scale either maxes the bar out too early or makes ordinary advantages look tiny. The eval bar and graph both squash centipawn scores through `tanh` instead:

```js
const scaled = displayCP / 500;
percent = 50 + (50 * Math.tanh(scaled));
```

`tanh` approaches ±1 asymptotically, so the bar approaches full/empty for large advantages without ever quite reaching it, while still being close to linear for small ones — a ±100cp (~1 pawn) edge moves the bar noticeably, while the difference between +900 and +1500 barely matters visually, which matches how those advantages actually feel to play. Forced mates are handled as a special case (scores at or beyond `±10000`) and pin the bar to 95%/5% with an `M<n>` label instead of trying to scale an effectively-infinite score.

### Board annotations: arrow geometry

Right-click-drag arrows are drawn as SVG lines with a triangular arrowhead, computed from the two squares' pixel centers — trimmed slightly at both ends so the line doesn't overlap the piece images, and with the arrowhead built from two points offset perpendicular to the line's angle:

```js
const angle = Math.atan2(dy, dx);
const leftX = backX + 12 * Math.cos(angle + Math.PI / 2);
const rightX = backX + 12 * Math.cos(angle - Math.PI / 2);
```

Knight moves (an L-shape: `(±1,±2)` or `(±2,±1)` in file/rank terms) get special treatment — a single straight line would visually cut across unrelated squares, so the app detects the knight-move shape, computes an intermediate "bend square" along the longer axis of the move, and draws two connected segments through it instead of one straight line — matching how chess.com/lichess draw knight-move arrows.

### Procedural sound effects

Move, capture, and check sounds are synthesized on the fly with the Web Audio API rather than shipped as audio files — no assets to load, no licensing to track down, and the volume slider applies uniformly since every sound is generated through the same gain node:

- **Move/capture** — filtered white noise (a short burst of random samples through a bandpass filter), which reads as a percussive "click" without needing a sample.
- **Check/checkmate** — actual oscillator tones (`playTone`), stacked with a short delay for check-then-mate cadences.

```js
function playClick(freq, duration, gainLevel) {
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  // ...bandpass filter + gain envelope, then play
}
```

### Resilient PGN parsing

Pasted PGN is often slightly malformed — missing headers, stray annotations, inconsistent move numbering. `loadGame()` tries chess.js's own `load_pgn()` first, and only falls back to a hand-rolled tokenizer if that fails outright:

```js
const moveText = stripPgnNoise(input);   // strips headers, {comments}, ;line-comments, $NAGs, (variations)
const tokens = moveText.split(/\s+/)
  .map(t => t.replace(/^\d+\.(\.\.)?/, '').replace(/[!?]+$/, ''))  // strip "12." / "12..." and annotation glyphs
  .filter(t => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));           // drop result tokens

tokens.forEach(token => {
  const m = game.move(token, { sloppy: true });  // sloppy: true tolerates minor notation inconsistencies
  if (m) moves.push(m);
});
```

Invalid individual tokens are simply skipped rather than aborting the whole load, so a game with one malformed move still loads everything around it instead of failing entirely.

## Browser Support

| Browser              | Modern engine (NNUE/WASM) | Legacy fallback |
|-----------------------|----------------------------|-------------------|
| Chrome / Edge (recent) | ✅                          | ✅                  |
| Firefox (recent)       | ✅                          | ✅                   |
| Safari (recent)        | ✅                          | ✅                    |
| Older browsers without WASM SIMD | ⚠️ falls back automatically | ✅                     |

## Troubleshooting

**Engine badge stuck on "Loading Stockfish 16 NNUE..."**
Give it a moment — the NNUE model is a large download. If it never resolves, open the browser console for the actual error; the app will fall back to the legacy engine on its own once the load attempt fails or times out.

**Analysis feels slow**
Lower the **Engine Depth** setting, or reduce **MultiPV** to 1 line. Analysis is inherently slower on the legacy engine (asm.js, single-threaded) — check the engine badge to see which one is active, and see [Engine Performance Settings](#engine-performance-settings) for rough per-move timing.

**"Engine failed to load" / nothing works**
Make sure you're serving the app over `http://` or `https://`, not opening `index.html` directly (`file://`) — see [Getting Started](#getting-started).

## Known Limitations

- Requires a browser with WebAssembly + SIMD support to get the full-strength NNUE engine; otherwise it transparently falls back to a weaker, slower legacy engine.
- The engine files are loaded from a public CDN ([jsDelivr](https://www.jsdelivr.com/) / [cdnjs](https://cdnjs.com/)) at runtime rather than bundled, so first load requires an internet connection.
- The Opening Explorer panel depends on the public [Lichess Explorer API](https://explorer.lichess.ovh) and won't populate if that service is unreachable.
- `Great` move detection uses a fixed centipawn-gap heuristic rather than a full alternative-move search, so it's an approximation of chess.com's own classifier, not an exact match.

## Roadmap

Ideas under consideration, not commitments:

- [ ] Bundle the engine locally as an option, to remove the CDN dependency
- [ ] PGN game database / saved-games list (currently one game at a time, in-memory only)
- [ ] Mobile-friendly touch controls for annotations
- [ ] Configurable classification thresholds in the UI

## Contributing

This is primarily a personal/academic project, but issues and pull requests are welcome — bug reports with a reproducible PGN are especially useful given how much of this app's correctness depends on engine timing and classification logic.

## Credits

© 2026 Hengleap Try (aka **Zer0Sugar**). All rights reserved.

Built with [chess.js](https://github.com/jhlywa/chess.js) and [Stockfish](https://stockfishchess.org/). Piece graphics from [Wikimedia Commons](https://commons.wikimedia.org/).