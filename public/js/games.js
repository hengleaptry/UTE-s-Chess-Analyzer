// games.js — persisting and restoring analyzed games via the backend.
//
// Loading a saved game deliberately does NOT re-run Stockfish: the
// classification/cpLoss/eval for every move was already computed once at
// save time, so re-running it would just burn time for an identical result.
// applyStoredAnalysis() reconstructs the same moveAnalysis[] shape
// analyzeGame() (analysis.js) builds, from the smaller stored payload.

// Called by auth.js whenever login state changes.
function onAuthStateChanged() {
  const panel = document.getElementById('savedGamesList');
  if (!panel) return;
  if (currentUser) {
    loadMyGames();
  } else {
    panel.innerHTML = '<div style="opacity:0.6; text-align:center; padding:10px;">Log in to save and view your games</div>';
  }
}

async function loadMyGames() {
  const panel = document.getElementById('savedGamesList');
  panel.innerHTML = '<div style="opacity:0.6; text-align:center; padding:10px;">Loading…</div>';

  try {
    const res = await fetch('/api/games');
    if (!res.ok) throw new Error('Failed to load games');
    const { games } = await res.json();
    renderSavedGamesList(games);
  } catch (e) {
    panel.innerHTML = '<div style="opacity:0.6; text-align:center; padding:10px;">Could not load your games.</div>';
  }
}

function renderSavedGamesList(games) {
  const panel = document.getElementById('savedGamesList');
  if (!games || games.length === 0) {
    panel.innerHTML = '<div style="opacity:0.6; text-align:center; padding:10px;">No saved games yet — analyze a game and hit "Save Game".</div>';
    return;
  }

  panel.innerHTML = games.map(g => {
    const players = [g.white_player, g.black_player].filter(Boolean).join(' vs ') || 'Untitled players';
    const acc = (g.white_accuracy != null && g.black_accuracy != null)
      ? `${g.white_accuracy.toFixed(1)}% / ${g.black_accuracy.toFixed(1)}%`
      : '';
    const date = g.created_at ? g.created_at.split(' ')[0] : '';
    return `
      <div class="saved-game-item">
        <div class="saved-game-info" onclick="loadSavedGame(${g.id})" title="Load this game">
          <div class="saved-game-title">${escapeHtml(g.title)}</div>
          <div class="saved-game-meta">${escapeHtml(players)} ${g.result ? '· ' + escapeHtml(g.result) : ''}</div>
          <div class="saved-game-meta">${acc ? acc + ' · ' : ''}${date}</div>
        </div>
        <button class="btn btn-small btn-danger" onclick="deleteSavedGame(${g.id}, event)" title="Delete">🗑</button>
      </div>
    `;
  }).join('');
}

async function saveCurrentGame() {
  if (!currentUser) {
    setStatus('Log in to save games', 'error');
    showAuthModal('login');
    return;
  }
  if (!moves || moves.length === 0) {
    setStatus('Nothing to save — load a game first', 'error');
    return;
  }

  const whitePlayer = document.getElementById('whitePlayer').textContent.trim();
  const blackPlayer = document.getElementById('blackPlayer').textContent.trim();
  const result = document.getElementById('gameResult').textContent.trim();
  const whiteAccText = document.getElementById('whiteAccuracy').textContent.replace('%', '').trim();
  const blackAccText = document.getElementById('blackAccuracy').textContent.replace('%', '').trim();

  const defaultTitle = (whitePlayer !== '-' && blackPlayer !== '-') ? `${whitePlayer} vs ${blackPlayer}` : 'Untitled game';
  const title = window.prompt('Save game as:', defaultTitle);
  if (title === null) return; // user cancelled

  const payload = {
    title,
    pgn: game.pgn(),
    whitePlayer: whitePlayer !== '-' ? whitePlayer : null,
    blackPlayer: blackPlayer !== '-' ? blackPlayer : null,
    result: result !== '-' ? result : null,
    whiteAccuracy: isNaN(parseFloat(whiteAccText)) ? null : parseFloat(whiteAccText),
    blackAccuracy: isNaN(parseFloat(blackAccText)) ? null : parseFloat(blackAccText),
    analysis: getCurrentAnalysisPayload(),
  };

  try {
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || 'Could not save game', 'error');
      return;
    }
    setStatus('Game saved', 'success');
    loadMyGames();
  } catch (e) {
    setStatus('Network error while saving', 'error');
  }
}

// Mirrors the shape ui.js's exportJSON() already uses (san/classification/cpLoss/eval),
// so both features share one on-the-wire format for a move's analysis.
function getCurrentAnalysisPayload() {
  if (!moveAnalysis || moveAnalysis.length === 0) return null;
  return moveAnalysis.map(a => a ? {
    san: a.move.san,
    classification: a.classification,
    cpLoss: a.cpLoss,
    eval: a.score,
  } : null);
}

async function loadSavedGame(id) {
  setStatus('Loading saved game…', 'loading');
  try {
    const res = await fetch(`/api/games/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || 'Could not load game', 'error');
      return;
    }

    document.getElementById('pgnInput').value = data.game.pgn;
    const ok = loadGame(); // parses PGN, resets board/moves/headers (main.js)
    if (!ok) return;

    if (data.game.analysis) {
      applyStoredAnalysis(data.game.analysis);
      setStatus(`Loaded "${data.game.title}"`, 'success');
    } else {
      setStatus(`Loaded "${data.game.title}" — click Analyze to evaluate it`, 'success');
    }
  } catch (e) {
    setStatus('Network error while loading game', 'error');
  }
}

// Rebuilds moveAnalysis[] from a stored {san, classification, cpLoss, eval}
// array — same fields analyzeGame() (analysis.js) computes, minus bestMove/pv/
// lines, which aren't needed to redisplay a game (only to keep analyzing live).
function applyStoredAnalysis(storedAnalysis) {
  const tempGame = new Chess();
  moveAnalysis = moves.map((move, i) => {
    const fenBefore = tempGame.fen();
    tempGame.move(move);
    const fenAfter = tempGame.fen();
    const entry = storedAnalysis[i];
    if (!entry) return null;
    return {
      move,
      fenBefore,
      fenAfter,
      bestMove: null,
      score: entry.eval,
      cpLoss: entry.cpLoss,
      classification: entry.classification,
      pv: [],
      lines: [],
    };
  });

  renderMoveList();
  drawEvalGraph();
  calculateStatistics();
  goToMove(moves.length - 1);
}

async function deleteSavedGame(id, event) {
  if (event) event.stopPropagation(); // don't also trigger the "load" click on the row
  if (!window.confirm('Delete this saved game? This can\'t be undone.')) return;

  try {
    const res = await fetch(`/api/games/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error || 'Could not delete game', 'error');
      return;
    }
    setStatus('Game deleted', 'success');
    loadMyGames();
  } catch (e) {
    setStatus('Network error while deleting', 'error');
  }
}
