// Core analysis logic, classification, and statistics

let isAnalyzing = false;

async function analyzeGame() {
  if (!game || moves.length === 0) {
    setStatus('Please load a game first', 'error');
    return;
  }
  if (isAnalyzing) return;
  if (!engineInitialized) {
    setStatus('Engine not ready. Please wait or reload.', 'error');
    return;
  }
  
  isAnalyzing = true;
  moveAnalysis = [];
  renderMoveList();
  
  const depth = parseInt(document.getElementById('depthInput').value) || 16;
  
  let moveTimeMs = 2000;
const isLegacy = engineType === 'legacy';

if (depth === 12) moveTimeMs = isLegacy ? 4000 : 2000;
else if (depth === 16) moveTimeMs = isLegacy ? 8000 : 4000;
else if (depth === 20) moveTimeMs = isLegacy ? 15000 : 8000;
else if (depth === 25) moveTimeMs = isLegacy ? 25000 : 15000;
  
  document.getElementById('loadingOverlay').classList.add('active');
  const tempGame = new Chess();
  const analysisMultiPv = Math.max(2, parseInt(document.getElementById('multipvInput').value) || 1);
  
  try {
    let beforeResult = await analyzePosition(tempGame.fen(), depth, moveTimeMs, analysisMultiPv);
    
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const fenBefore = tempGame.fen();
      
      tempGame.move(move);
      const afterResult = await analyzePosition(tempGame.fen(), depth, moveTimeMs, analysisMultiPv);
      
      const moverEvalBefore = beforeResult.score;
      const moverEvalAfter = -afterResult.score;
      const cpLoss = Math.max(0, moverEvalBefore - moverEvalAfter);
      
      const isSacrifice = detectSacrifice(fenBefore, move);
      const classification = classifyMove(move.san, beforeResult.bestMove, cpLoss, isSacrifice, i, fenBefore, beforeResult.lines);
      
      moveAnalysis.push({
        move: move,
        fenBefore: fenBefore,
        fenAfter: tempGame.fen(),
        bestMove: beforeResult.bestMove,
        score: moverEvalAfter,
        cpLoss: cpLoss,
        classification: classification,
        pv: beforeResult.pv,
        lines: afterResult.lines
      });
      
      const progress = ((i + 1) / moves.length) * 100;
      document.getElementById('progressFill').style.width = progress + '%';
      document.getElementById('progressText').textContent = `${i + 1}/${moves.length} moves`;
      
      renderMoveList();
      drawEvalGraph();
      beforeResult = afterResult;
    }
    
    calculateStatistics();
    renderMoveBadges();
    drawEvalGraph();
    setStatus(`Analysis complete! ${moves.length} moves analyzed.`, 'success');
    
  } catch (e) {
    console.error('Analysis error:', e);
    setStatus('Analysis stopped: ' + e.message, 'error');
  } finally {
    document.getElementById('loadingOverlay').classList.remove('active');
    isAnalyzing = false;
    refreshEngineLinesForCurrentPosition();
  }
}

function detectSacrifice(fenBefore, move) {
  try {
    const g = new Chess(fenBefore);
    const getMat = (gameInstance) => {
      let w = 0, b = 0;
      gameInstance.board().forEach(row => row.forEach(p => {
        if (p) {
          const v = PIECE_VALUES[p.type];
          if (p.color === 'w') w += v; else b += v;
        }
      }));
      return { w, b };
    };
    
    const before = getMat(g);
    g.move(move);
    const after = getMat(g);
    
    const moverBefore = move.color === 'w' ? before.w : before.b;
    const moverAfter = move.color === 'w' ? after.w : after.b;
    
    return (moverBefore - moverAfter) >= 100;
  } catch (e) {
    return false;
  }
}

function classifyMove(san, bestMove, cpLoss, isSacrifice, ply, fenBefore, lines) {
  // If using legacy engine, be more forgiving (it's less accurate)
  const isLegacy = engineType === 'legacy';
  const thresholdMultiplier = isLegacy ? 2.5 : 1;
  
  // Book moves: opening theory (first 12 plies with minimal loss)
  if (ply < 12 && cpLoss <= 30 * thresholdMultiplier) return 'book';
  
  // Check if move matches engine's best move
  if (isMoveEquivalent(san, bestMove, fenBefore)) {
    return isSacrifice ? 'brilliant' : 'best';
  }
  
  if (cpLoss <= 20 * thresholdMultiplier) {
    const line1 = lines && lines.find(l => l.multipv === 1);
    const line2 = lines && lines.find(l => l.multipv === 2);
    const alternativeGap = (line1 && line2) ? (line1.score - line2.score) : 0;
    return alternativeGap >= 100 * thresholdMultiplier ? 'great' : 'good';
  }
  if (cpLoss <= 50 * thresholdMultiplier) return 'good';
  if (cpLoss <= 100 * thresholdMultiplier) return 'miss';
  if (cpLoss <= 250 * thresholdMultiplier) return 'bad';
  return 'blunder';
}

function isMoveEquivalent(san, uci, fenBefore) {
  if (!san || !uci || uci.length < 4 || !fenBefore) return false;
  try {
    const g = new Chess(fenBefore);
    const mv = g.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : 'q'
    });
    if (!mv) return false;
    const strip = s => s.replace(/[+#!?]/g, '');
    return strip(mv.san) === strip(san);
  } catch (e) {
    return false;
  }
}

function calculateStatistics() {
  if (moveAnalysis.length === 0) return;
  
  let whiteTotalLoss = 0, blackTotalLoss = 0, whiteMoves = 0, blackMoves = 0;
  let blunders = 0, brilliants = 0, misses = 0, bestMoves = 0;
  
  moveAnalysis.forEach((analysis, i) => {
    if (!analysis) return;
    const isWhite = i % 2 === 0;
    if (isWhite) { whiteTotalLoss += analysis.cpLoss; whiteMoves++; }
    else { blackTotalLoss += analysis.cpLoss; blackMoves++; }
    
    if (analysis.classification === 'blunder') blunders++;
    if (analysis.classification === 'brilliant') brilliants++;
    if (analysis.classification === 'miss' || analysis.classification === 'bad') misses++;
    if (analysis.classification === 'best') bestMoves++;
  });
  
  const maxLossPerMove = 500;
  const whiteAcc = whiteMoves === 0 ? 100 : Math.max(0, 100 - (whiteTotalLoss / (whiteMoves * maxLossPerMove)) * 100);
  const blackAcc = blackMoves === 0 ? 100 : Math.max(0, 100 - (blackTotalLoss / (blackMoves * maxLossPerMove)) * 100);
  
  document.getElementById('whiteAccuracy').textContent = whiteAcc.toFixed(1) + '%';
  document.getElementById('blackAccuracy').textContent = blackAcc.toFixed(1) + '%';
  document.getElementById('whiteAccBar').style.width = whiteAcc + '%';
  document.getElementById('blackAccBar').style.width = blackAcc + '%';
  
  document.getElementById('blunderCount').textContent = blunders;
  document.getElementById('brilliantCount').textContent = brilliants;
  document.getElementById('missCount').textContent = misses;
  document.getElementById('bestMoveCount').textContent = bestMoves;
  document.getElementById('statsPanel').style.display = 'block';
}