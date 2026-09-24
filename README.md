# ♟ UTE's Chess Analyzer

**A professional, browser-based chess analysis engine powered by Stockfish 16 NNUE.**

Developed by **Hengleap Try (Zer0Sugar)** for the **University for Technology and Entrepreneurship (UTE)**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Stockfish](https://img.shields.io/badge/engine-Stockfish_16_NNUE-green.svg)
![Status](https://img.shields.io/badge/status-Production_ready-brightgreen.svg)

---

## 📖 Overview

UTE's Chess Analyzer brings desktop-grade chess engine analysis directly to the browser. By leveraging WebAssembly to run Stockfish 16 NNUE locally within the user's browser, it provides high-accuracy evaluations, perspective-safe centipawn mathematics, and Chess.com-calibrated move classifications without requiring a backend server. 

Whether you are analyzing grandmaster games, reviewing your own matches, or exploring opening theory via the Lichess API, this tool provides a seamless, professional-grade experience.

## ✨ Key Features

### 🧠 Advanced Engine Analysis
* **Stockfish 16 NNUE:** Runs locally via WebAssembly for zero-latency, high-depth analysis.
* **Perspective-Safe Math:** Accurately calculates centipawn (CP) loss by dynamically flipping evaluation perspectives between White and Black.
* **Dynamic Time Allocation:** Intelligently allocates search time based on requested depth to prevent shallow, noisy evaluations.

###  Professional UI/UX
* **Chess.com-Style Classifications:** Automatically labels moves as *Book, Best, Brilliant, Great, Good, Miss, Bad,* or *Blunder*.
* **True Sacrifice Detection:** Analyzes full-board material states before and after a move to accurately detect positional sacrifices and gambits.
* **Evaluation Graph:** A dynamic, canvas-rendered graph visualizing the game's momentum over time.
* **Drag-and-Drop:** Intuitive piece movement with legal move highlighting.

### 📚 Integrations & Tools
* **Lichess Opening Explorer:** Fetches real-time master-level win/draw/loss statistics for any position.
* **Custom Annotations:** Right-click to draw arrows or highlight squares for study and presentation.
* **Free Play & Explore:** Play from any position with live engine feedback, or branch off loaded PGNs.
* **Export Suite:** Download analyzed games as annotated PGNs, raw JSON data, or the evaluation graph as a PNG.

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3 (Custom Glassmorphism UI), Vanilla JavaScript (ES6+)
* **Chess Logic:** [Chess.js](https://github.com/jhlywa/chess.js)
* **Engine:** [Stockfish 16 NNUE](https://stockfishchess.org/) (Compiled to WebAssembly/JS)
* **APIs:** [Lichess Opening Explorer API](https://lichess.org/api#tag/Opening-Explorer)

## 📸 Screenshots

*(Note: Replace these placeholders with actual screenshots of your app)*

| Board & Eval Graph | Move Classification | Opening Explorer |
| :---: | :---: | :---: |
| ![Board](https://via.placeholder.com/300x200?text=Board+View) | ![Moves](https://via.placeholder.com/300x200?text=Move+List) | ![Explorer](https://via.placeholder.com/300x200?text=Explorer) |

## 🚀 Getting Started

### Prerequisites
Because this project uses **Web Workers** and **WebAssembly** to run the Stockfish engine, modern browsers will block the engine if opened directly via the `file://` protocol due to CORS security restrictions. **You must serve the project via a local HTTP server.**

### Option 1: VS Code Live Server (Recommended)
1. Open the project folder in Visual Studio Code.
2. Install the **Live Server** extension by Ritwick Dey.
3. Right-click `index.html` and select **"Open with Live Server"**.
4. The app will launch at `http://127.0.0.1:5500`.

### Option 2: Python Local Server
1. Open your terminal in the project root directory.
2. Run the following command:
   ```bash
   python3 -m http.server 8000