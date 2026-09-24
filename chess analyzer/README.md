# Pro Chess Analyzer

A highly accurate, browser-based chess analysis tool built with Stockfish 16 NNUE. Features Chess.com-calibrated move classification, an evaluation graph, free-play mode, and custom board annotations.

## Features
- **High-Accuracy Analysis**: Perspective-safe centipawn math and dynamic time allocation ensure the engine reaches target depths reliably.
- **Chess.com Classification**: Accurately labels moves as Book, Best, Brilliant, Great, Good, Miss, Bad, or Blunder.
- **True Sacrifice Detection**: Compares full board material before and after a move to detect positional sacrifices.
- **Evaluation Graph**: Visualizes the game's momentum over time.
- **Free Play & Explore**: Play from any position or branch off a loaded game.
- **Annotations**: Right-click and drag to draw arrows; right-click a square to highlight it.
- **Export**: Download your analysis as PGN (with comments), JSON, or the Eval Graph as a PNG.

## Setup & Running

Because this project uses Web Workers and WebAssembly (for Stockfish), **you cannot open `index.html` directly via the `file://` protocol**. Browsers block Workers/WASM from local files for security reasons.

You must serve it via a local HTTP server.

### Option 1: VS Code Live Server (Recommended)
1. Open the `chess-analyzer` folder in VS Code.
2. Install the "Live Server" extension by Ritwick Dey.
3. Right-click `index.html` and select "Open with Live Server".

### Option 2: Python Local Server
1. Open your terminal in the `chess-analyzer` folder.
2. Run: `python3 -m http.server 8000`
3. Open `http://localhost:8000` in your browser.

### Option 3: Node.js
1. Run: `npx serve .`
2. Open the provided localhost URL.

## File Structure