// Initialization, Game Loading, and Navigation

let autoPlayInterval = null;
let soundEnabled = true;
let isDarkTheme = true;

window.onload = function() {
  console.log('Initializing Pro Chess Analyzer...');
  createBoard();
  initStockfish();
  
  startFreePlay(true);
  renderLegend();
  setStatus('Free play — move any piece to start analyzing', 'success');
  
  // Scrubber event listener
  const scrubber = document.getElementById('moveScrubber');
  if (scrubber) {
    scrubber.addEventListener('input', (e) => {
      goToMove(parseInt(e.target.value));
    });
  }
};

function renderLegend() {
  const legend = document.getElementById('classificationLegend');
  const classes = ['book', 'brilliant', 'best', 'great', 'good', 'miss', 'bad', 'blunder'];
  legend.innerHTML = classes.map(c => `
    <div class="legend-item">
      ${classificationIconSVG(c, 16)}
      <span>${c.charAt(0).toUpperCase() + c.slice(1)}</span>
    </div>
  `).join('');
}

function loadGame() {
  const input = document.getElementById('pgnInput').value.trim();
  if (!input) { 
    setStatus('Please enter a PGN', 'error'); 
    return false; 
  }
  
  isFreePlay = false;
  isExploring = false;
  
  try {
    game = new Chess();
    
    const result = game.load_pgn(input, { sloppy: true });
    if (result === null || result === false) {
      game = new Chess();
      const moveText = stripPgnNoise(input);
      const tokens = moveText.split(/\s+/)
        .map(t => t.replace(/^\d+\.(\.\.)?/, '').replace(/[!?]+$/, ''))
        .filter(t => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
      
      moves = [];
      tokens.forEach(token => { 
        const m = game.move(token, { sloppy: true }); 
        if (m) moves.push(m); 
      });
      
      if (moves.length === 0) { 
        setStatus('No valid moves found', 'error'); 
        return false; 
      }
    } else {
      moves = game.history({ verbose: true });
    }
    
    const headers = parsePGNHeaders(input);
    document.getElementById('whitePlayer').textContent = headers['White'] || '-';
    document.getElementById('blackPlayer').textContent = headers['Black'] || '-';
    document.getElementById('gameResult').textContent = headers['Result'] || '-';
    document.getElementById('gameDate').textContent = headers['Date'] || '-';
    document.getElementById('gameEvent').textContent = headers['Event'] || '-';
    document.getElementById('gameSite').textContent = headers['Site'] || '-';
    document.getElementById('gameInfoPanel').style.display = 'block';
    
    currentMoveIndex = -1;
    moveAnalysis = [];
    game.reset();
    renderBoard();
    renderMoveList();
    drawEvalGraph();
    updateEvalBar(0, true);
    updateScrubber();
    updateOpeningExplorer(game.fen());
    
    document.getElementById('statsPanel').style.display = 'none';
    document.getElementById('exploreBanner').style.display = 'none';
    setStatus(`Loaded ${moves.length} moves`, 'success');
    return true;
  } catch (e) {
    setStatus('Error loading game: ' + e.message, 'error');
    return false;
  }
}

async function loadAndAnalyze() {
  if (loadGame()) {
    await analyzeGame();
  }
}

function loadExample() {
  document.getElementById('pgnInput').value = `[Event "Immortal Game"]
[Site "London"]
[Date "1851.06.21"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0`;
  loadAndAnalyze();
}

function loadFEN() {
  const input = document.getElementById('pgnInput').value.trim();
  if (!looksLikeFEN(input)) {
    setStatus('Invalid FEN string', 'error');
    return;
  }
  startFreePlay(false, input);
}

function clearBoard() {
  document.getElementById('pgnInput').value = '';
  startFreePlay(false);
  setStatus('Board cleared — free play mode', 'success');
}

function goToMove(index) {
  if (!game || moves.length === 0) return;
  currentMoveIndex = Math.max(-1, Math.min(moves.length - 1, index));
  
  isExploring = false;
  updateFreePlayBanner();
  
  if (isFreePlay && freePlayBaseFen) {
    game.load(freePlayBaseFen);
  } else {
    game.reset();
  }
  
  for (let i = 0; i <= currentMoveIndex; i++) {
    game.move(moves[i]);
  }
  
  renderBoard();
  renderMoveList();
  renderMoveBadges();
  updateScrubber();
  updateOpeningExplorer(game.fen());
  
  if (currentMoveIndex >= 0 && moveAnalysis[currentMoveIndex]) {
    const analysis = moveAnalysis[currentMoveIndex];
    updateEvalBar(analysis.score, currentMoveIndex % 2 === 0);
    refreshEngineLinesForCurrentPosition();
  } else {
    updateEvalBar(0, true);
  }
}

function nextMove() { 
  if (currentMoveIndex < moves.length - 1) {
    goToMove(currentMoveIndex + 1); 
  }
}

function prevMove() { 
  if (currentMoveIndex > -1) {
    goToMove(currentMoveIndex - 1); 
  }
}

function toggleAutoPlay() {
  const btn = document.getElementById('autoBtn');
  if (autoPlayInterval) {
    clearInterval(autoPlayInterval); 
    autoPlayInterval = null;
    btn.textContent = '▶ Auto'; 
    btn.classList.remove('btn-success');
  } else {
    autoPlayInterval = setInterval(() => {
      if (currentMoveIndex >= moves.length - 1) {
        toggleAutoPlay();
      } else {
        nextMove();
      }
    }, 1500);
    btn.textContent = ' Pause'; 
    btn.classList.add('btn-success');
  }
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') prevMove();
    if (e.key === 'ArrowRight') nextMove();
    if (e.key === ' ') { 
      e.preventDefault(); 
      toggleAutoPlay(); 
    }
    if (e.key === 'f' || e.key === 'F') flipBoard();
    if (e.key === 'a' || e.key === 'A') analyzeGame();
  });
}