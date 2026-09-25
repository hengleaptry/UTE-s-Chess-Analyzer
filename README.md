# ♟️ UTE's Chess Analyzer

[![Engine](https://img.shields.io/badge/engine-Stockfish%2016%20NNUE-1abc9c)](https://stockfishchess.org/)
[![WebAssembly](https://img.shields.io/badge/powered%20by-WebAssembly-654ff0)](https://webassembly.org/)
[![No Build Step](https://img.shields.io/badge/build%20step-none-2ecc71)]()
[![Stack](https://img.shields.io/badge/stack-HTML%20%2F%20CSS%20%2F%20JS-f1c40f)]()

A browser-based chess analysis tool powered by **Stockfish 16 NNUE**, with Chess.com-style move classification, a live evaluation graph, free-play/explore mode, and hand-drawn board annotations — all running client-side, no backend required.

Developed for the University for Technology and Entrepreneurship (UTE).

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Controls](#controls)
- [Move Classification](#move-classification)
- [Project Structure](#project-structure)
- [How the Engine Loads](#how-the-engine-loads)
- [Browser Support](#browser-support)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)
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

## How the Engine Loads

Stockfish is pulled at runtime from a CDN rather than bundled, so getting it running inside a cross-origin Web Worker takes a couple of deliberate steps:

1. **Modern engine (Stockfish 16 NNUE, WASM):** loaded into a `Blob`-backed worker via `importScripts()`, since Workers can't be constructed directly from a cross-origin script URL. The library's own auto-init logic assumes it's hosted alongside its `.wasm` file and can't be redirected through the usual `Module.locateFile` hook when it detects it's running in a Worker — so the loader shims a minimal `window`/`document.currentScript` before importing it, which makes the library hand back its raw factory function instead of auto-running with the wrong path. The loader then calls that factory itself with an explicit `locateFile` override pointing at the correct CDN URL for the `.wasm` file.
2. **Legacy engine (Stockfish 10, asm.js):** loaded the same way but needs none of the above — no `.wasm` sibling file, so it just runs.
3. If the modern engine fails to hand back a working UCI connection within a timeout (slow network, no WASM/SIMD support, etc.), the app **automatically falls back** to the legacy engine and shows a "Legacy" badge rather than failing silently.

See `js/engine.js` for the full implementation.

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
Lower the **Engine Depth** setting, or reduce **MultiPV** to 1 line. Analysis is inherently slower on the legacy engine (asm.js, single-threaded) — check the engine badge to see which one is active.

**"Engine failed to load" / nothing works**
Make sure you're serving the app over `http://` or `https://`, not opening `index.html` directly (`file://`) — see [Getting Started](#getting-started).

## Known Limitations

- Requires a browser with WebAssembly + SIMD support to get the full-strength NNUE engine; otherwise it transparently falls back to a weaker, slower legacy engine.
- The engine files are loaded from a public CDN ([jsDelivr](https://www.jsdelivr.com/) / [cdnjs](https://cdnjs.com/)) at runtime rather than bundled, so first load requires an internet connection.
- The Opening Explorer panel depends on the public [Lichess Explorer API](https://explorer.lichess.ovh) and won't populate if that service is unreachable.

## Contributing

This is primarily a personal/academic project, but issues and pull requests are welcome — bug reports with a reproducible PGN are especially useful given how much of this app's correctness depends on engine timing and classification logic.

## Credits

© 2026 Hengleap Try (aka **Zer0Sugar**). All rights reserved.

Built with [chess.js](https://github.com/jhlywa/chess.js) and [Stockfish](https://stockfishchess.org/). Piece graphics from [Wikimedia Commons](https://commons.wikimedia.org/).