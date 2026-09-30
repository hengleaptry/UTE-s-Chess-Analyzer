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
  
  // "Great" only means something if we know whether the position was sharp
  // (one clearly-best move) or flexible (several roughly-equal moves) - that
  // needs at least the engine's top 2 lines, not just 1. Respect the user's
  // MultiPV setting but never drop below 2 for this reason.
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
        lines: beforeResult.lines
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

// NOTE: an earlier version of this function compared the mover's own total
// material immediately before vs. immediately after their own move. That
// comparison can never be true — a single legal chess move can't reduce the
// mover's own material (captures only remove the opponent's piece,
// promotions only ever increase value, castling doesn't change piece
// count) — so `isSacrifice` always evaluated false and `Brilliant` was
// unreachable. Real sacrifice detection has to look one ply further: is the
// piece that just moved sitting somewhere the opponent can immediately take
// it back for less than it's worth?
function detectSacrifice(fenBefore, move) {
  try {
    const g = new Chess(fenBefore);
    const mv = g.move(move);
    if (!mv) return false;

    const destSquare = mv.to;
    const movedPieceValue = PIECE_VALUES[mv.piece];

    // It's now the opponent's turn (g.move() flipped it) — find their
    // cheapest way to recapture on the square the mover just landed on.
    const recaptures = g
      .moves({ verbose: true })
      .filter((m) => m.to === destSquare && m.captured);

    if (recaptures.length === 0) return false; // nothing can take it back — not a sacrifice

    const cheapestRecapture = Math.min(...recaptures.map((m) => PIECE_VALUES[m.piece]));

    // A sacrifice: what the mover put there is worth meaningfully more
    // than what the opponent has to give up to take it (matches the
    // existing >=100cp / "at least a minor piece" bar used elsewhere).
    return (movedPieceValue - cheapestRecapture) >= 100;
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
  
  // "Great" is for a move that wasn't the engine's literal #1 pick but was
  // essentially tied with it, IN A POSITION WHERE THAT MATTERED - i.e. the
  // next-best alternative was clearly worse, so finding a near-optimal move
  // at all was meaningful. Without checking that gap, any ordinary move in
  // a flexible position (several roughly-equal options) with 0 cp loss
  // would get flagged "great" too, which is misleading - a quiet developing
  // move isn't "great" just because several moves were equally fine.
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

// Pure computation, no DOM — takes a moveAnalysis[] array and returns the
// same numbers calculateStatistics() renders. Split out specifically so this
// math (accuracy formula, counts) is unit-testable on its own; see
// tests/unit/analysis.test.js.
function computeGameStats(moveAnalysis) {
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
    // Book moves are opening theory, not the engine's top choice — keep
    // them out of "Best Moves" so this stat doesn't contradict a move
    // that's badged BOOK in the move list.
    if (analysis.classification === 'best') bestMoves++;
  });

  const maxLossPerMove = 500;
  const whiteAccuracy = whiteMoves === 0 ? 100 : Math.max(0, 100 - (whiteTotalLoss / (whiteMoves * maxLossPerMove)) * 100);
  const blackAccuracy = blackMoves === 0 ? 100 : Math.max(0, 100 - (blackTotalLoss / (blackMoves * maxLossPerMove)) * 100);

  return { whiteAccuracy, blackAccuracy, blunders, brilliants, misses, bestMoves };
}

function calculateStatistics() {
  if (moveAnalysis.length === 0) return;

  const stats = computeGameStats(moveAnalysis);

  document.getElementById('whiteAccuracy').textContent = stats.whiteAccuracy.toFixed(1) + '%';
  document.getElementById('blackAccuracy').textContent = stats.blackAccuracy.toFixed(1) + '%';
  document.getElementById('whiteAccBar').style.width = stats.whiteAccuracy + '%';
  document.getElementById('blackAccBar').style.width = stats.blackAccuracy + '%';

  document.getElementById('blunderCount').textContent = stats.blunders;
  document.getElementById('brilliantCount').textContent = stats.brilliants;
  document.getElementById('missCount').textContent = stats.misses;
  document.getElementById('bestMoveCount').textContent = stats.bestMoves;
  document.getElementById('statsPanel').style.display = 'block';
}