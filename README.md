# ♟️ UTE's Chess Analyzer

[![Engine](https://img.shields.io/badge/engine-Stockfish%2016%20NNUE-1abc9c)](https://stockfishchess.org/)
[![WebAssembly](https://img.shields.io/badge/powered%20by-WebAssembly-654ff0)](https://webassembly.org/)
[![Backend](https://img.shields.io/badge/backend-Node.js%20%2F%20Express-3c873a)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/database-SQLite-003b57)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red)]()

A full-stack chess analysis platform powered by **Stockfish 16 NNUE**, with Chess.com-style move classification, a live evaluation graph, free-play/explore mode, hand-drawn board annotations, and **user accounts with a saved-games library** backed by a small Node/Express API.

The chess engine itself still runs entirely client-side (in your browser, via WebAssembly) — the backend exists for accounts and persistence, not for analysis. Nothing about how positions get evaluated changed; what's new is being able to log in, save an analyzed game, and reopen it later without re-running the engine.

Developed for the University for Technology and Entrepreneurship (UTE).

```bash
git clone <your-repo-url>
cd chess-analyzer
npm install
cp .env.example .env    # then edit JWT_SECRET — see Getting Started
npm start
# open http://localhost:3000
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
- [Backend & API](#backend--api)
- [Authentication & Security](#authentication--security)
- [Testing](#testing)
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
- **Accounts & saved games** — register/log in, save an analyzed game to your account, and reopen it later — the full classification/eval data is restored instantly, without re-running the engine. See [Backend & API](#backend--api).
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
| Frontend      | Vanilla HTML / CSS / JavaScript — no frameworks, no build step             |
| Backend       | [Node.js](https://nodejs.org/) + [Express 5](https://expressjs.com/)       |
| Database      | [SQLite](https://www.sqlite.org/) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Auth          | [bcryptjs](https://github.com/dcodeIO/bcrypt.js) password hashing + [JWT](https://github.com/auth0/node-jsonwebtoken) in an httpOnly cookie |
| Security middleware | [helmet](https://helmetjs.github.io/) (CSP) + [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) |
| Testing       | Node's built-in [`node:test`](https://nodejs.org/api/test.html) runner + `assert` — no separate test framework |

## Getting Started

### Requirements
- [Node.js](https://nodejs.org/) 18 or later

### Setup

```bash
npm install
cp .env.example .env
```

Open `.env` and set `JWT_SECRET` to a real random value — accounts won't work securely with the placeholder. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Run

```bash
npm start
```

Open `http://localhost:3000`. The server serves the frontend *and* the API from the same origin — there's nothing else to run.

For local development with auto-restart on file changes:

```bash
npm run dev
```

### Run tests

```bash
npm test
```

See [Testing](#testing) for what's actually covered.

### Running without the backend

The frontend degrades gracefully with no server at all: serving just the `public/` folder (e.g. via `python3 -m http.server` from inside it, or VS Code Live Server) still gives you the full engine/analysis experience — the login and "My Games" calls simply fail quietly and the app falls back to guest mode. You only need the Node backend for accounts and saved games.

Either way, **don't open `index.html` directly via `file://`** — Stockfish needs Web Workers and WebAssembly, which browsers block from local files. Serve it over HTTP.

## Deployment

This is a stateful Node app now (SQLite file + session cookies), not a static site, so GitHub Pages no longer applies for the full experience. Any host that runs a persistent Node process works:

- **[Railway](https://railway.app/) / [Render](https://render.com/)** — connect the repo, set the build command to `npm install` and the start command to `npm start`, add `JWT_SECRET` as an environment variable. Both offer a free tier sufficient for a small/personal deployment.
- **[Fly.io](https://fly.io/)** — `fly launch`, then `fly secrets set JWT_SECRET=...`.
- **A plain VPS** — clone the repo, `npm install --production`, set up `.env`, run behind a process manager like [pm2](https://pm2.keymetrics.dev/) or a `systemd` service, and reverse-proxy it with nginx/Caddy for TLS.

In every case, remember to:
1. Set `JWT_SECRET` to a real secret (never commit `.env`).
2. Set `NODE_ENV=production` — this makes the session cookie `Secure` (HTTPS-only).
3. Persist the `data/` directory across deploys/restarts, or saved games and accounts disappear. Most PaaS free tiers use an ephemeral filesystem — check whether your host offers a persistent volume/disk if you need accounts to survive redeploys.

If you specifically want a backend-free static deployment (e.g. for a quick demo, accepting that accounts/saved games won't work), you can still deploy just the `public/` folder to GitHub Pages or Netlify as before.

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

**Brilliant** is `best` (matches the engine's top move) *plus* a real material sacrifice — checked by seeing whether the piece the mover just placed is immediately recapturable by the opponent for less than it's worth:

```js
function detectSacrifice(fenBefore, move) {
  // ...after applying the move, find the opponent's cheapest way to
  // recapture on the square the mover just landed on
  return (movedPieceValue - cheapestRecapture) >= 100; // gave up at least a minor piece's worth, on purpose
}
```

This wasn't the original implementation. The first version compared the mover's own total material immediately *before* vs. *after their own move* — which is structurally impossible to ever show a decrease, since a single legal chess move can't reduce the mover's own material (captures only remove the opponent's piece, promotions only ever add value, castling doesn't change piece count). That meant `Brilliant` was unreachable dead code for the entire life of this feature, and it was only caught by trying to write a real test case for it and being unable to construct one that should pass — see [Testing](#testing) for the full story.

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

### Accuracy calculation

The White/Black accuracy percentages shown in the stats panel are **not** "100% minus the fraction of bad moves" — they're a continuous measure of average centipawn loss, computed in `calculateStatistics()`:

```js
const maxLossPerMove = 500; // 5 pawns treated as a "zero credit" move
const whiteAcc = 100 - (whiteTotalLoss / (whiteMoves * maxLossPerMove)) * 100;
```

In plain terms: average every move's `cpLoss` for that side, scale it against a 500cp ceiling, subtract from 100. This means **a game with zero `Miss`/`Bad`/`Blunder` moves still won't show 100% accuracy**, and that's expected rather than a bug — every move carries some small `cpLoss` unless it's an exact tie with the engine's own top choice at that depth (transpositions, equally-reasonable alternatives, and ordinary search noise between two separately-analyzed positions all contribute a few centipawns), and those small amounts accumulate over a full game.

Worked example, from a real analyzed game where every move classified as `Book`, `Good`, or `Best` (no mistakes at all):

```
White cpLoss per move: 5, 0, 9, 8, 4, 8, 17, 0, 9, 42, 13   → avg 10.45cp → 97.9% accuracy
Black cpLoss per move: 7, 5, 0, 8, 4, 4, 0, 0, 5, 5          → avg 3.80cp  → 99.2% accuracy
```

This mirrors real chess.com/Lichess behavior — a genuinely mistake-free human game routinely lands in the high-80s to high-90s, not literally 100%, because matching the engine's exact top line on every single move essentially never happens.

For comparison, chess.com's own accuracy metric isn't linear in centipawns — it's based on the *win-probability* delta between moves (via a logistic curve converting centipawns to an estimated win percentage), which is far more forgiving of small swings in already-decided positions and far less forgiving of the same centipawn swing in a dead-even position. Applying that curve to the same worked example above gives **White 96.1%, Black 98.4%** — in this particular game, actually slightly *lower* than the simpler linear formula, not higher, since a lot of the small losses happened in roughly balanced positions where the win-probability curve is steepest. Both are legitimate ways to define "accuracy"; this project uses the simpler linear version for now (see [Roadmap](#roadmap)).

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
├── package.json
├── .env.example
├── data/                  # SQLite database file lives here at runtime (git-ignored)
├── src/                   # Backend
│   ├── app.js             # Express app factory — no side effects, importable by tests
│   ├── server.js          # Thin entrypoint: loads .env, calls createApp().listen()
│   ├── db.js               # SQLite connection & schema (DB_PATH configurable for tests)
│   ├── middleware/
│   │   └── auth.js          # JWT cookie signing/verification, requireAuth guard
│   └── routes/
│       ├── auth.js           # POST /register, /login, /logout, GET /me
│       └── games.js           # CRUD for saved games (all routes require auth)
├── public/                # Frontend (served statically by Express)
│   ├── index.html          # App shell / layout
│   ├── css/
│   │   └── styles.css       # All styling
│   └── js/
│       ├── utils.js          # Constants, icons, PGN/FEN helpers
│       ├── engine.js         # Stockfish worker loading & UCI communication
│       ├── annotations.js    # Right-click arrows & square highlights
│       ├── board.js          # Board rendering, drag/drop, free-play logic
│       ├── analysis.js       # Move classification, computeGameStats(), game statistics
│       ├── ui.js              # Eval graph, audio, export, opening explorer
│       ├── main.js             # Init, PGN loading, move navigation
│       ├── auth.js             # Login/register modal, session state
│       └── games.js             # Save/list/delete + buildMoveAnalysisFromStored()
└── tests/
    ├── unit/                # utils.js, analysis.js, games.js — pure logic, via vm sandbox
    ├── integration/         # auth + games routes, against a real in-memory-DB server
    └── helpers/             # testServer.js, testClient.js, loadFrontendScript.js
```

## Architecture

```
                     ┌─────────────────────────── Browser ───────────────────────────┐
                     │                                                                 │
 PGN / FEN input ──▶ │  chess.js  ──  board.js  ──engine.js──UCI──▶ Stockfish Worker   │
                     │      │              │                              │            │
                     │      ▼              ▼                              ▼            │
                     │  analysis.js  ◀──────────────────── evals, best move, PV lines  │
                     │      │                                                          │
                     │      ▼                                                          │
                     │  ui.js  (eval bar/graph, move list, export)                     │
                     │      │                                                          │
                     │  auth.js / games.js                                             │
                     └──────┼──────────────────────────────────────────────────────────┘
                            │  fetch() — cookie-based session
                            ▼
                     ┌─────────────── Express (src/server.js) ───────────────┐
                     │  helmet (CSP)  →  rate limiter  →  routes/auth.js     │
                     │                                 →  routes/games.js    │
                     └───────────────────────┬────────────────────────────────┘
                                              ▼
                                     better-sqlite3 (data/chess-analyzer.db)
```

Engine analysis never leaves the browser — the backend only ever sees a finished PGN and the classification results already computed client-side. `main.js` wires the frontend together on load; `annotations.js` is an independent overlay for arrows/highlights that touches neither engine nor backend state.

## Backend & API

All API routes are mounted under `/api`. Every `games` route requires a valid session. Both route groups are rate-limited per IP (15-minute window): `auth` at 30 requests (brute-force / signup-spam protection), `games` at 200 requests (generous enough for normal use, but not unlimited — see [Testing](#testing) for how this is exercised).

The Express app itself is built in `src/app.js` as a plain factory function (`createApp()`) with no side effects — `src/server.js` is a thin wrapper that loads `.env` and calls `.listen()`. This split exists specifically so tests can import and mount the real app against an ephemeral port without needing to bind the configured `PORT` or touch the real database file.

| Method | Route | Auth required | Description |
|--------|-------|:---:|-------------|
| `POST` | `/api/auth/register` | – | Create an account. Body: `{ username, password }`. Sets the session cookie. |
| `POST` | `/api/auth/login` | – | Log in. Body: `{ username, password }`. Sets the session cookie. |
| `POST` | `/api/auth/logout` | – | Clears the session cookie. |
| `GET`  | `/api/auth/me` | ✅ | Returns the current user, or `401` if not logged in. |
| `GET`  | `/api/games` | ✅ | List the current user's saved games (metadata only — no PGN/analysis payload, to keep the list fast). |
| `GET`  | `/api/games/:id` | ✅ | Fetch one saved game in full, including PGN and stored move-by-move analysis. `404` if it doesn't belong to you. |
| `POST` | `/api/games` | ✅ | Save an analyzed game. Body: `{ title, pgn, whitePlayer, blackPlayer, result, whiteAccuracy, blackAccuracy, analysis }`. |
| `DELETE` | `/api/games/:id` | ✅ | Delete a saved game. `404` if it doesn't belong to you. |

Database schema (`src/db.js`) is two tables: `users` (id, username, bcrypt password hash) and `games` (id, `user_id` foreign key with `ON DELETE CASCADE`, title, pgn, player names, result, accuracies, and `analysis_json` — the serialized move classification array). Deleting a user deletes their saved games automatically via the foreign key. `DB_PATH` is configurable via environment variable specifically so tests can point it at `:memory:` instead of the real data file.


## Authentication & Security

A few choices here are worth calling out explicitly rather than leaving implicit:

- **Passwords** are hashed with bcrypt at cost factor 12 (`bcryptjs`) — never stored or logged in plain text, and never returned in any API response.
- **Sessions** are a JWT stored in an `httpOnly`, `sameSite=lax` cookie (`secure` in production), not in `localStorage`. `httpOnly` means client-side JavaScript — including any injected via a hypothetical XSS bug elsewhere in the app — cannot read or exfiltrate the token; only the browser sends it, automatically, on same-site requests.
- **Login is timing-attack-resistant against username enumeration**: when the username doesn't exist, the route still runs a bcrypt comparison against a dummy hash before responding, so a nonexistent-username request and a wrong-password request take approximately the same time. Skipping straight to a 401 for unknown usernames would let an attacker distinguish "wrong password" from "no such account" by response time.
- **Every `games` route re-checks ownership** (`WHERE id = ? AND user_id = ?`) rather than trusting the ID alone — there's no route that returns or mutates a row just because you can guess its numeric ID.
- **All SQL is parameterized** via `better-sqlite3`'s prepared statements (`?` placeholders) — no string-concatenated queries anywhere, so there's no SQL injection surface from user-supplied `username`/`title`/etc.
- **Input size limits** are enforced server-side (PGN capped at 200KB, analysis payload at 2MB, JSON body at 3MB) so a malicious or buggy client can't fill the database with oversized rows.
- **Content-Security-Policy** (via `helmet`) is scoped tightly to exactly what this app needs to load: scripts only from `self` and `cdnjs.cloudflare.com`, worker creation from `blob:` (required for the engine — see [How the Engine Loads](#how-the-engine-loads)), and outbound requests only to `self`, the two engine CDNs, and the Lichess Explorer API. Everything else is refused by the browser even if something on the page tried to load it.

## Testing

```bash
npm test
```

Runs the whole suite via Node's built-in test runner (`node:test` — no Jest/Mocha/etc., keeping the zero-extra-tooling philosophy that already applies to the frontend). Currently 51 tests across four files, all passing:

| File | Covers |
|------|--------|
| `tests/unit/utils.test.js` | PGN cleanup/parsing helpers (`stripPgnNoise`, `looksLikeFEN`, `parsePGNHeaders`) |
| `tests/unit/analysis.test.js` | `classifyMove` (every classification tier and boundary, including the legacy-engine multiplier), `detectSacrifice`, `computeGameStats` (including the exact worked example from [Accuracy calculation](#accuracy-calculation)) |
| `tests/unit/games.test.js` | `buildMoveAnalysisFromStored` — the save/reload FEN-chain reconstruction |
| `tests/integration/auth.test.js` + `tests/integration/games.test.js` | The real Express app, boots on an ephemeral port against an isolated in-memory SQLite database — registration, login, session handling, and the full games CRUD including cross-user ownership isolation |

**How the frontend tests work**, since the frontend is plain `<script>` files sharing one global scope rather than modules (`tests/helpers/loadFrontendScript.js`): the actual source files are loaded into a Node `vm` sandbox that stubs just enough of the browser environment (`Chess`, a settable `engineType`) for their pure logic to run — the real file content executes, nothing about the logic is reimplemented or mocked. This is the same technique used earlier in this project's development to verify the Stockfish worker-loading fix against the real library source before shipping it.

A couple of functions were **extracted into pure, DOM-free pieces specifically to make them unit-testable**: `calculateStatistics()` (DOM-writing) now delegates to `computeGameStats()` (pure math) in `analysis.js`, and `applyStoredAnalysis()` similarly delegates to `buildMoveAnalysisFromStored()` in `games.js`. Both refactors are behavior-preserving — the DOM-facing functions still do exactly what they did before, they just hand the actual computation to a function a test can call directly.

**This suite already found a real, pre-existing bug**, which is worth being upfront about rather than only listing what passes: `detectSacrifice()` (part of `Brilliant` move classification) compared the mover's own total material immediately before vs. immediately after their own move. Trying to write a genuine "this should return true" test case for it turned out to be impossible — a single legal chess move can never reduce the mover's own material (captures only remove the opponent's piece, promotions only ever increase value, castling doesn't change piece count). That comparison was structurally incapable of ever being true, which means **`Brilliant` had been unreachable, dead-code classification for the entire life of this feature** — no game, ever, could have earned that badge. It's fixed now (checks whether the piece just moved is immediately recapturable by the opponent for less than it's worth) and covered by four dedicated test cases, including the fix verified against a real constructed sacrifice position before being trusted.

Known gap: there's no coverage yet for the DOM-facing rendering functions themselves (`calculateStatistics`, `applyStoredAnalysis`, anything in `board.js`/`ui.js`) — that would need a real DOM (e.g. `jsdom`), which this suite deliberately doesn't pull in yet to keep the dependency list minimal. The pure logic those functions delegate to is fully covered; the rendering glue around it isn't.

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

**Server won't start / crashes immediately on `npm start`**
Almost always a missing or placeholder `JWT_SECRET` — the server refuses to boot without one (see `src/middleware/auth.js`). Confirm `.env` exists and `JWT_SECRET` isn't still the placeholder value from `.env.example`.

**Register/Login button does nothing, or "My Games" never loads**
Open the browser console/network tab — if `/api/auth/...` requests are failing outright (not just returning 401), the backend probably isn't running, or you're serving `public/` standalone without the Node server (see [Running without the backend](#running-without-the-backend)). This is expected in that mode — accounts simply aren't available.

**Saved games disappeared after redeploying**
Your host's filesystem is likely ephemeral and the `data/` directory wasn't persisted across the deploy — see the persistence note in [Deployment](#deployment).

## Known Limitations

- Requires a browser with WebAssembly + SIMD support to get the full-strength NNUE engine; otherwise it transparently falls back to a weaker, slower legacy engine.
- The engine files are loaded from a public CDN ([jsDelivr](https://www.jsdelivr.com/) / [cdnjs](https://cdnjs.com/)) at runtime rather than bundled, so first load requires an internet connection.
- The Opening Explorer panel depends on the public [Lichess Explorer API](https://explorer.lichess.ovh) and won't populate if that service is unreachable.
- `Great` move detection uses a fixed centipawn-gap heuristic rather than a full alternative-move search, so it's an approximation of chess.com's own classifier, not an exact match.
- **SQLite is a single file on local disk** — fine for a personal or small-class deployment, but it doesn't horizontally scale across multiple server instances, and most free-tier PaaS filesystems are ephemeral (see [Deployment](#deployment)).
- There's no password-reset flow — a forgotten password currently means a new account. No email is collected or sent anywhere in this app at all.
- Saved-game analysis is a point-in-time snapshot: if you improve the classification logic later (as we did with the `Great` heuristic), previously saved games keep their old classifications until re-analyzed and re-saved.

## Roadmap

Ideas under consideration, not commitments:

- [ ] Bundle the engine locally as an option, to remove the CDN dependency
- [ ] Password reset (would require adding email, currently out of scope)
- [ ] Public, shareable read-only links for a saved game
- [ ] Mobile-friendly touch controls for annotations
- [ ] Configurable classification thresholds in the UI
- [ ] Re-analyze-and-update in place for a saved game, instead of only save-as-new
- [ ] Switch accuracy to a win-probability-based curve (chess.com-style) instead of linear centipawn scaling — see [Accuracy calculation](#accuracy-calculation) for the tradeoff

## Contributing

This is primarily a personal/academic project, but issues and pull requests are welcome — bug reports with a reproducible PGN are especially useful given how much of this app's correctness depends on engine timing and classification logic.

## Credits

© 2026 Hengleap Try (aka **Zer0Sugar**). All rights reserved.

Built with [chess.js](https://github.com/jhlywa/chess.js) and [Stockfish](https://stockfishchess.org/). Piece graphics from [Wikimedia Commons](https://commons.wikimedia.org/).
