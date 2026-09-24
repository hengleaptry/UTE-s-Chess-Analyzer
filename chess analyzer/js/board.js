// Board rendering, interaction, and free play logic

let game = null;
let moves = [];
let moveAnalysis = [];
let currentMoveIndex = -1;
let flipped = false;
let selectedSquare = null;
let legalTargets = [];
let isExploring = false;
let isFreePlay = false;
let freePlayBaseFen = null;
let freePlayBeforeResult = null;
let exploreToken = 0;

function createBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const displayRank = flipped ? 7 - rank : rank;
      const displayFile = flipped ? 7 - file : file;
      
      const sq = document.createElement('div');
      sq.className = 'square ' + ((displayRank + displayFile) % 2 === 0 ? 'light' : 'dark');
      sq.style.left = (file * 75) + 'px';
      sq.style.top = (rank * 75) + 'px';
      sq.dataset.square = String.fromCharCode(97 + displayFile) + (8 - displayRank);
      
      sq.addEventListener('click', () => handleSquareClick(sq.dataset.square));
      
      // Drag and Drop Listeners for Squares
      sq.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      sq.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData('text/plain');
        const to = sq.dataset.square;
        if (from && to && from !== to) {
          const legal = game.moves({ square: from, verbose: true });
          if (legal.some(m => m.to === to)) {
            const piece = game.get(from);
            const isPromotion = piece && piece.type === 'p' &&
              ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));
            clearSelection();
            if (isPromotion) {
              showPromotionPicker(from, to, piece.color);
            } else {
              completeMove(from, to, 'q');
            }
          } else {
            clearSelection();
          }
        }
      });

      sq.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
          e.preventDefault();
          handleRightMouseDown(sq.dataset.square);
        }
      });
      sq.addEventListener('mouseup', (e) => {
        if (e.button === 2 && rightDragActive) {
          handleRightMouseUp(sq.dataset.square);
          rightDragActive = false;
          rightDragStart = null;
        }
      });
      
      if (file === 0) {
        const coord = document.createElement('span');
        coord.className = 'coordinates coord-rank';
        coord.textContent = 8 - displayRank;
        sq.appendChild(coord);
      }
      if (rank === 7) {
        const coord = document.createElement('span');
        coord.className = 'coordinates coord-file';
        coord.textContent = String.fromCharCode(97 + displayFile);
        sq.appendChild(coord);
      }
      
      boardEl.appendChild(sq);
    }
  }
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'boardArrows');
  svg.setAttribute('class', 'board-arrows');
  svg.setAttribute('viewBox', '0 0 600 600');
  boardEl.appendChild(svg);
  
  const userSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  userSvg.setAttribute('id', 'userArrows');
  userSvg.setAttribute('class', 'board-arrows user-arrows-layer');
  userSvg.setAttribute('viewBox', '0 0 600 600');
  boardEl.appendChild(userSvg);
  
  setupAnnotations();
  setupKeyboardShortcuts();
}

function renderBoard() {
  if (!game) return;
  
  const board = game.board();
  document.querySelectorAll('.square').forEach(sq => {
    const squareName = sq.dataset.square;
    const file = squareName.charCodeAt(0) - 97;
    const rank = 8 - parseInt(squareName[1]);
    const piece = board[rank][file];
    
    const existingPiece = sq.querySelector('.piece-img');
    if (existingPiece) existingPiece.remove();
    
    if (piece) {
      const img = document.createElement('img');
      img.className = 'piece-img';
      img.src = PIECE_IMAGES[piece.color + piece.type.toUpperCase()];
      
      // Make pieces draggable
      img.setAttribute('draggable', 'true');
      img.dataset.square = squareName;
      img.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', squareName);
        e.dataTransfer.effectAllowed = 'move';
        const legal = game.moves({ square: squareName, verbose: true });
        if (legal.length > 0) {
          selectedSquare = squareName;
          legalTargets = legal.map(m => m.to);
          renderSelectionHighlights();
        }
      });
      
      sq.appendChild(img);
    }
    
    sq.classList.remove('last-move', 'check', 'mate-square', 'winner-square', 
                       'selected', 'legal-move', 'legal-capture');
  });
  
  if (currentMoveIndex >= 0 && moves[currentMoveIndex]) {
    const fromSq = document.querySelector(`[data-square="${moves[currentMoveIndex].from}"]`);
    const toSq = document.querySelector(`[data-square="${moves[currentMoveIndex].to}"]`);
    if (fromSq) fromSq.classList.add('last-move');
    if (toSq) toSq.classList.add('last-move');
  }
  
  if (game.in_check()) {
    const kingColor = game.turn();
    game.board().forEach((row, r) => {
      row.forEach((piece, f) => {
        if (piece && piece.type === 'k' && piece.color === kingColor) {
          const sq = document.querySelector(`[data-square="${String.fromCharCode(97 + f)}${8 - r}"]`);
          if (sq) sq.classList.add('check');
        }
      });
    });
  }
  
  renderSelectionHighlights();
  updateMaterialBalance();
}

function handleSquareClick(squareName) {
  if (!game) return;
  if (game.game_over()) {
    setStatus('Game over. Click "New board" to start fresh.', 'error');
    return;
  }
  
  if (selectedSquare && legalTargets.includes(squareName)) {
    const from = selectedSquare;
    const piece = game.get(from);
    const isPromotion = piece && piece.type === 'p' &&
      ((piece.color === 'w' && squareName[1] === '8') || (piece.color === 'b' && squareName[1] === '1'));
    clearSelection();
    if (isPromotion) {
      showPromotionPicker(from, squareName, piece.color);
    } else {
      completeMove(from, squareName, 'q');
    }
    return;
  }
  
  clearSelection();
  const piece = game.get(squareName);
  if (piece && piece.color === game.turn()) {
    const legal = game.moves({ square: squareName, verbose: true });
    if (legal.length > 0) {
      selectedSquare = squareName;
      legalTargets = legal.map(m => m.to);
      renderSelectionHighlights();
    }
  }
}

function completeMove(from, to, promotion) {
  const fenBefore = game.fen();
  const mv = game.move({ from, to, promotion: promotion || 'q' });
  if (!mv) return;
  
  renderBoard();
  clearBoardAnnotations();
  playSoundForMove(mv.san, !!mv.captured);
  announceGameEnd();
  
  if (isFreePlay) {
    recordFreePlayMove(mv, fenBefore);
  } else if (isExploring) {
    maybeAnalyzeExploredPosition();
  }
  
  updateFreePlayBanner();
  updateOpeningExplorer(game.fen());
}

function showPromotionPicker(from, to, color) {
  hidePromotionPicker();
  const boardEl = document.getElementById('board');
  const toEl = document.querySelector(`[data-square="${to}"]`);
  if (!boardEl || !toEl) { completeMove(from, to, 'q'); return; }
  
  const left = toEl.offsetLeft;
  const top = toEl.offsetTop;
  const extendDown = top < 300;
  const pickerTop = extendDown ? top : top - 3 * 75;
  
  const scrim = document.createElement('div');
  scrim.id = 'promotionScrim';
  scrim.className = 'promotion-scrim';
  scrim.onclick = () => { hidePromotionPicker(); clearSelection(); };
  boardEl.appendChild(scrim);
  
  const picker = document.createElement('div');
  picker.id = 'promotionPicker';
  picker.className = 'promotion-picker';
  picker.style.left = left + 'px';
  picker.style.top = pickerTop + 'px';
  
  const pieceOrder = extendDown ? ['q', 'r', 'b', 'n'] : ['n', 'b', 'r', 'q'];
  pieceOrder.forEach((p, idx) => {
    const choice = document.createElement('div');
    choice.className = 'promo-choice';
    choice.style.top = (idx * 75) + 'px';
    const key = color + p.toUpperCase();
    choice.innerHTML = `<img src="${PIECE_IMAGES[key]}" alt="${p}">`;
    choice.onclick = (e) => {
      e.stopPropagation();
      hidePromotionPicker();
      completeMove(from, to, p);
    };
    picker.appendChild(choice);
  });
  boardEl.appendChild(picker);
}

function hidePromotionPicker() {
  const picker = document.getElementById('promotionPicker');
  if (picker) picker.remove();
  const scrim = document.getElementById('promotionScrim');
  if (scrim) scrim.remove();
}

function clearSelection() {
  selectedSquare = null;
  legalTargets = [];
  document.querySelectorAll('.square').forEach(sq => {
    sq.classList.remove('selected', 'legal-move', 'legal-capture');
  });
}

function renderSelectionHighlights() {
  document.querySelectorAll('.square').forEach(sq => {
    sq.classList.remove('selected', 'legal-move', 'legal-capture');
  });
  if (!selectedSquare) return;
  const fromEl = document.querySelector(`[data-square="${selectedSquare}"]`);
  if (fromEl) fromEl.classList.add('selected');
  legalTargets.forEach(sqName => {
    const el = document.querySelector(`[data-square="${sqName}"]`);
    if (!el) return;
    el.classList.add(game.get(sqName) ? 'legal-capture' : 'legal-move');
  });
}

function clearBoardAnnotations() {
  document.querySelectorAll('.move-badge-icon').forEach(el => el.remove());
  document.querySelectorAll('.square').forEach(sq => sq.classList.remove('mate-square', 'winner-square'));
  const svg = document.getElementById('boardArrows');
  if (svg) svg.innerHTML = '';
}

function renderMoveBadges() {
  document.querySelectorAll('.move-badge-icon').forEach(el => el.remove());
  document.querySelectorAll('.square').forEach(sq => sq.classList.remove('mate-square', 'winner-square'));
  if (currentMoveIndex < 0 || !moveAnalysis[currentMoveIndex]) return;
  
  const analysis = moveAnalysis[currentMoveIndex];
  const move = analysis.move;
  const isCheckmate = move.san.endsWith('#');
  const toSq = document.querySelector(`[data-square="${move.to}"]`);
  
  if (toSq) {
    const cls = isCheckmate ? 'checkmate' : (analysis.classification || 'good');
    const icon = document.createElement('div');
    icon.className = 'move-badge-icon';
    icon.title = cls.charAt(0).toUpperCase() + cls.slice(1);
    icon.innerHTML = classificationIconSVG(cls, 30);
    toSq.appendChild(icon);
  }
  
  if (isCheckmate && game.in_checkmate()) {
    const matedColor = game.turn();
    game.board().forEach((row, r) => {
      row.forEach((piece, f) => {
        if (!piece || piece.type !== 'k') return;
        const sqName = String.fromCharCode(97 + f) + (8 - r);
        const el = document.querySelector(`[data-square="${sqName}"]`);
        if (!el) return;
        if (piece.color === matedColor) {
          el.classList.add('mate-square');
        } else {
          el.classList.add('winner-square');
          const winBadge = document.createElement('div');
          winBadge.className = 'move-badge-icon';
          winBadge.innerHTML = classificationIconSVG('winner', 30);
          el.appendChild(winBadge);
        }
      });
    });
  }
}

function startFreePlay(silent, baseFen) {
  game = new Chess();
  if (baseFen) {
    if (!game.load(baseFen)) { setStatus('Invalid FEN', 'error'); return; }
  }
  
  freePlayBaseFen = game.fen();
  freePlayBeforeResult = null;
  moves = [];
  moveAnalysis = [];
  currentMoveIndex = -1;
  isFreePlay = true;
  isExploring = false;
  exploreToken++;
  
  clearSelection();
  clearBoardAnnotations();
  clearUserAnnotations();
  renderBoard();
  renderMoveList();
  updateEvalBar(0, true);
  updateFreePlayBanner();
  updateScrubber();
  
  document.getElementById('openingPanel').style.display = 'none';
  document.getElementById('statsPanel').style.display = 'none';
  document.getElementById('gameInfoPanel').style.display = 'none';
  
  if (!silent) setStatus('Free play — move any piece to start analyzing', 'success');
  
  maybeAnalyzeExploredPosition();
  updateOpeningExplorer(game.fen());
}

function undoFreeMove() {
  if (!game) return;
  const undone = game.undo();
  if (!undone) { setStatus('Nothing to undo', 'error'); return; }
  
  if (isFreePlay && moves.length > 0) {
    moves.pop();
    moveAnalysis.pop();
    currentMoveIndex = moves.length - 1;
    freePlayBeforeResult = null;
  }
  
  exploreToken++;
  clearSelection();
  clearBoardAnnotations();
  renderBoard();
  renderMoveList();
  renderMoveBadges();
  updateFreePlayBanner();
  updateScrubber();
  calculateStatistics();
  maybeAnalyzeExploredPosition();
  updateOpeningExplorer(game.fen());
}

function announceGameEnd() {
  if (!game || !game.game_over()) return;
  if (game.in_checkmate()) {
    const winner = game.turn() === 'w' ? 'Black' : 'White';
    setStatus(`Checkmate - ${winner} wins`, 'success');
  } else if (game.in_stalemate()) {
    setStatus('Stalemate - draw', 'success');
  } else if (game.in_threefold_repetition()) {
    setStatus('Draw by threefold repetition', 'success');
  } else if (game.insufficient_material()) {
    setStatus('Draw - insufficient material', 'success');
  } else if (game.in_draw()) {
    setStatus('Draw (50-move rule)', 'success');
  }
}

function updateFreePlayBanner() {
  const banner = document.getElementById('exploreBanner');
  const text = document.getElementById('exploreBannerText');
  const returnBtn = document.getElementById('returnToGameBtn');
  if (!banner) return;
  
  if (isExploring) {
    banner.style.display = 'flex';
    if (text) text.textContent = '🔀 Exploring your own line — not part of the loaded game';
    if (returnBtn) returnBtn.style.display = '';
  } else if (isFreePlay) {
    const ply = game ? game.history().length : 0;
    banner.style.display = 'flex';
    if (text) {
      text.textContent = ply === 0 ? '♟ Free play — move any piece to start analyzing' : `♟ Free play — ${ply} move${ply === 1 ? '' : 's'} played`;
    }
    if (returnBtn) returnBtn.style.display = 'none';
  } else {
    banner.style.display = 'none';
  }
}

function resetToGame() {
  isExploring = false;
  isFreePlay = false;
  exploreToken++;
  updateFreePlayBanner();
  goToMove(currentMoveIndex);
}

function flipBoard() {
  flipped = !flipped;
  createBoard();
  renderBoard();
  renderMoveBadges();
  updateOpeningExplorer(game.fen());
}

async function maybeAnalyzeExploredPosition() {
  if (!engineInitialized || isAnalyzing || !game) return;
  const myToken = ++exploreToken;
  const fen = game.fen();
  if (game.game_over()) {
    if (game.in_checkmate()) {
      const whiteWins = game.turn() === 'b';
      updateEvalBar(whiteWins ? 10000 : -10000, true);
    } else {
      updateEvalBar(0, true);
    }
    return;
  }
  
  const depth = Math.min(parseInt(document.getElementById('depthInput').value) || 16, 16);
  const moveTimeMs = 2500;
  setStatus('Engine thinking...', 'loading');
  
  try {
    const multiPvCount = parseInt(document.getElementById('multipvInput').value) || 1;
    const result = await analyzePosition(fen, depth, moveTimeMs, multiPvCount);
    if (myToken !== exploreToken) return;
    const stm = fen.split(' ')[1];
    updateEvalBar(result.score, stm === 'w');
    refreshEngineLinesForCurrentPosition();
    setStatus('Engine eval updated', 'success');
  } catch (e) {
    if (myToken === exploreToken) setStatus('Engine unavailable: ' + e.message, 'error');
  }
}

async function recordFreePlayMove(mv, fenBefore) {
  if (currentMoveIndex < moves.length - 1) {
    moves = moves.slice(0, currentMoveIndex + 1);
    moveAnalysis = moveAnalysis.slice(0, currentMoveIndex + 1);
  }
  
  const ply = moves.length;
  moves.push(mv);
  currentMoveIndex = moves.length - 1;
  
  moveAnalysis.push(null);
  renderMoveList();
  renderMoveBadges();
  drawEvalGraph();
  updateScrubber();
  
  if (!engineInitialized || isAnalyzing) return;
  
  const myToken = ++exploreToken;
  const depth = Math.min(parseInt(document.getElementById('depthInput').value) || 16, 16);
  const moveTimeMs = engineType === 'legacy' ? 6000 : 3000;
  const fenAfter = game.fen();
  setStatus('Engine thinking...', 'loading');
  
  try {
    let beforeResult = freePlayBeforeResult;
    if (!beforeResult || beforeResult.fen !== fenBefore) {
      const r = await analyzePosition(fenBefore, depth, moveTimeMs, 1);
      if (myToken !== exploreToken) return;
      beforeResult = Object.assign({}, r, { fen: fenBefore });
    }
    
    let afterResult;
    if (game.game_over()) {
      afterResult = { score: game.in_checkmate() ? -10000 : 0, bestMove: null, pv: [], lines: [], fen: fenAfter };
    } else {
      const r = await analyzePosition(fenAfter, depth, moveTimeMs, 1);
      if (myToken !== exploreToken) return;
      afterResult = Object.assign({}, r, { fen: fenAfter });
    }
    
    const moverEvalBefore = beforeResult.score;
    const moverEvalAfter = -afterResult.score;
    const cpLoss = Math.max(0, moverEvalBefore - moverEvalAfter);
    const isSacrifice = detectSacrifice(fenBefore, mv);
    const classification = classifyMove(mv.san, beforeResult.bestMove, cpLoss, isSacrifice, ply, fenBefore);
    
    moveAnalysis[ply] = {
      move: mv, fenBefore, fenAfter, bestMove: beforeResult.bestMove,
      score: moverEvalAfter, cpLoss, classification, pv: beforeResult.pv, lines: afterResult.lines
    };
    
    freePlayBeforeResult = afterResult;
    
    renderMoveList();
    renderMoveBadges();
    drawEvalGraph();
    updateScrubber();
    
    const stm = fenAfter.split(' ')[1];
    updateEvalBar(afterResult.score, stm === 'w');
    calculateStatistics();
    refreshEngineLinesForCurrentPosition();
    setStatus(mv.san + ' - ' + classification.toUpperCase(), 'success');
  } catch (e) {
    if (myToken === exploreToken) setStatus('Engine analysis failed: ' + e.message, 'error');
  }
}