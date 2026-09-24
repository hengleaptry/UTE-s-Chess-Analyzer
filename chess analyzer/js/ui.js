// UI rendering, Eval Graph, Audio, Export, and Opening Explorer

function renderMoveList() {
  const list = document.getElementById('moveList');
  list.innerHTML = '';
  if (!moves || moves.length === 0) {
    list.innerHTML = '<div style="opacity:0.6; text-align:center; padding:20px;">No moves loaded</div>';
    return;
  }
  
  for (let i = 0; i < moves.length; i++) {
    const row = document.createElement('div');
    row.className = 'move-row' + (i === currentMoveIndex ? ' active' : '');
    row.onclick = () => goToMove(i);
    
    const moveNum = document.createElement('span');
    moveNum.className = 'move-number';
    moveNum.textContent = Math.floor(i / 2) + 1 + (i % 2 === 0 ? '.' : '...');
    
    const san = document.createElement('span');
    san.className = 'move-san';
    san.textContent = moves[i].san;
    
    const cls = document.createElement('span');
    cls.className = 'move-class';
    if (moveAnalysis[i]) {
      const c = moveAnalysis[i].classification;
      cls.classList.add('class-' + c);
      cls.innerHTML = classificationIconSVG(c, 16) + c.toUpperCase();
    } else {
      cls.textContent = '...';
    }
    
    const cp = document.createElement('span');
    cp.className = 'move-cp';
    if (moveAnalysis[i]) {
      const isWhite = i % 2 === 0;
      const whiteCp = isWhite ? moveAnalysis[i].score : -moveAnalysis[i].score;
      if (Math.abs(whiteCp) >= 10000) {
        const mateIn = Math.max(1, Math.ceil((10000 - Math.abs(whiteCp)) / 10));
        cp.textContent = (whiteCp > 0 ? 'M' : '-M') + mateIn;
      } else {
        cp.textContent = (whiteCp > 0 ? '+' : '') + (whiteCp / 100).toFixed(2);
      }
      if (moveAnalysis[i].cpLoss > 180) cp.style.color = '#e74c3c';
      else if (moveAnalysis[i].cpLoss > 80) cp.style.color = '#e67e22';
    } else {
      cp.textContent = '-';
    }
    
    row.append(moveNum, san, cls, cp);
    list.appendChild(row);
  }
  
  const active = list.querySelector('.move-row.active');
  if (active) {
    const container = list;
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.top < containerRect.top || activeRect.bottom > containerRect.bottom) {
      container.scrollTop += (activeRect.top - containerRect.top) - (container.clientHeight / 2) + (active.clientHeight / 2);
    }
  }
}

function updateEvalBar(cp, isWhiteTurn) {
  const whiteBar = document.getElementById('evalWhite');
  const blackBar = document.getElementById('evalBlack');
  const scoreEl = document.getElementById('evalScore');
  
  let displayCP = isWhiteTurn ? cp : -cp;
  let percent, displayText;
  
  if (cp === null || isNaN(cp)) { percent = 50; displayText = '0.0'; }
  else if (Math.abs(cp) >= 10000) {
    const mateIn = Math.ceil((10000 - Math.abs(cp)) / 100);
    percent = cp > 0 ? 95 : 5;
    displayText = 'M' + mateIn;
  } else {
    const scaled = displayCP / 500;
    percent = 50 + (50 * Math.tanh(scaled));
    displayText = (displayCP / 100).toFixed(1);
    if (displayCP > 0) displayText = '+' + displayText;
  }
  
  percent = Math.max(2, Math.min(98, percent));
  whiteBar.style.height = percent + '%';
  blackBar.style.height = (100 - percent) + '%';
  scoreEl.textContent = displayText;
  scoreEl.className = 'eval-score ' + (displayCP >= 0 ? 'white' : 'black');
  scoreEl.style.bottom = (percent - 5) + '%';
}

function updateMaterialBalance() {
  if (!game) return;
  let w = 0, b = 0;
  game.board().forEach(row => row.forEach(p => {
    if (p) { if (p.color === 'w') w += PIECE_VALUES[p.type]; else b += PIECE_VALUES[p.type]; }
  }));
  const diff = w - b;
  const el = document.getElementById('materialBalance');
  if (diff === 0) el.innerHTML = '<span>⚖️</span><span>Equal material</span>';
  else if (diff > 0) el.innerHTML = `<span>⚪</span><span>White +${(diff/100).toFixed(1)}</span>`;
  else el.innerHTML = `<span>⚫</span><span>Black +${(Math.abs(diff)/100).toFixed(1)}</span>`;
}

function refreshEngineLinesForCurrentPosition() {
  if (!engineInitialized || isAnalyzing || !game) return;
  
  const fen = (isFreePlay || isExploring) ? game.fen() : 
              (currentMoveIndex >= 0 && moveAnalysis[currentMoveIndex]) ? 
              moveAnalysis[currentMoveIndex].fenBefore : game.fen();
  
  const lines = (isFreePlay || isExploring) ? [] : 
                (currentMoveIndex >= 0 && moveAnalysis[currentMoveIndex]) ? 
                moveAnalysis[currentMoveIndex].lines : [];
  
  const stm = fen.split(' ')[1];
  
  const linesEl = document.getElementById('engineLines');
  
  if (!lines || lines.length === 0) {
    if (isFreePlay || isExploring) {
      linesEl.innerHTML = '<div style="opacity:0.6; text-align:center;">Live analysis active — make a move to see lines</div>';
    } else {
      linesEl.innerHTML = '<div style="opacity:0.6; text-align:center;">No lines available</div>';
    }
    return;
  }
  
  let html = '';
  lines.forEach(line => {
    const whiteCp = stm === 'b' ? -line.score : line.score;
    let evalText = '';
    if (Math.abs(whiteCp) >= 10000) {
      const mateIn = Math.max(1, Math.ceil((10000 - Math.abs(whiteCp)) / 10));
      evalText = (whiteCp > 0 ? 'M' : '-M') + mateIn;
    } else {
      evalText = (whiteCp > 0 ? '+' : '') + (whiteCp / 100).toFixed(2);
    }
    
    let sanLine = '';
    try {
      const g = new Chess(fen);
      const sanParts = [];
      for (let i = 0; i < Math.min(6, line.pv.length); i++) {
        const uci = line.pv[i];
        if (!uci || uci.length < 4) break;
        const mv = g.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci.length > 4 ? uci[4] : 'q' });
        if (!mv) break;
        sanParts.push(mv.san);
      }
      sanLine = sanParts.join(' ');
    } catch(e) { 
      sanLine = line.pv.slice(0,6).join(' '); 
    }
    
    html += `<div class="pv-line"><span class="pv-depth">#${line.multipv}</span><span class="pv-eval">${evalText}</span>${sanLine}</div>`;
  });
  linesEl.innerHTML = html;
}

function drawEvalGraph() {
  const container = document.getElementById('evalGraphContainer');
  const canvas = document.getElementById('evalGraph');
  if (!canvas || moveAnalysis.length === 0) {
    if (container) container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const midY = height / 2;
  
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, width, height);
  
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();
  
  const stepX = width / Math.max(1, moveAnalysis.length);
  
  ctx.beginPath();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  
  moveAnalysis.forEach((analysis, i) => {
    if (!analysis) return;
    const isWhite = i % 2 === 0;
    const whiteCp = isWhite ? analysis.score : -analysis.score;
    
    let y;
    if (Math.abs(whiteCp) >= 10000) {
      y = whiteCp > 0 ? 10 : height - 10;
    } else {
      const scaled = whiteCp / 1000;
      y = midY - (midY * 0.9 * Math.tanh(scaled));
    }
    
    const x = (i + 1) * stepX;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  
  if (currentMoveIndex >= 0) {
    const x = (currentMoveIndex + 1) * stepX;
    ctx.strokeStyle = '#ffab40';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

// Audio System
let audioCtx = null, soundVolume = 0.7;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playClick(freq, duration, gainLevel) {
  const ctx = getAudioCtx(); if (!ctx) return;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = ctx.createBufferSource(); noise.buffer = buffer;
  const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = 1.1;
  const gain = ctx.createGain(); gain.gain.setValueAtTime(Math.max(0.0001, gainLevel * soundVolume), ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination); noise.start();
}

function playTone(freq, delay, duration, type, gainLevel) {
  const ctx = getAudioCtx(); if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = freq;
  const gain = ctx.createGain(); gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainLevel * soundVolume), t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain); gain.connect(ctx.destination); osc.start(t0); osc.stop(t0 + duration + 0.03);
}

function playMoveSound() { if (soundEnabled) playClick(950, 0.07, 0.35); }
function playCaptureSound() { if (soundEnabled) { playClick(500, 0.05, 0.4); setTimeout(() => playClick(320, 0.09, 0.3), 35); } }
function playCheckSound() { if (soundEnabled) { playTone(660, 0, 0.09, 'triangle', 0.32); playTone(880, 0.09, 0.13, 'triangle', 0.34); } }

function playSoundForMove(san, wasCapture) {
  if (!soundEnabled || !san) return;
  if (san.endsWith('#')) playTone(440, 0, 0.4, 'sawtooth', 0.36);
  else if (san.endsWith('+')) playCheckSound();
  else if (wasCapture) playCaptureSound();
  else playMoveSound();
}

// Export Features
function showExportModal() { document.getElementById('exportModal').classList.add('active'); }
function hideExportModal() { document.getElementById('exportModal').classList.remove('active'); }

function exportPGN() {
  if (!game) { alert('No game to export'); return; }
  let pgn = '[Event "Analyzed Game"]\n';
  pgn += '[Date "' + new Date().toISOString().split('T')[0] + '"]\n\n';
  pgn += game.pgn() + '\n\n';
  
  moveAnalysis.forEach((a, i) => {
    if (a) pgn += `{ ${a.classification.toUpperCase()} | CP Loss: ${a.cpLoss} | Eval: ${(a.score/100).toFixed(2)} }\n`;
  });
  
  downloadFile(pgn, 'analyzed_game.pgn', 'text/plain');
  hideExportModal();
}

function exportJSON() {
  if (!moveAnalysis || moveAnalysis.length === 0) { alert('No analysis to export'); return; }
  const data = {
    moves: moveAnalysis.map(a => ({
      san: a.move.san,
      classification: a.classification,
      cpLoss: a.cpLoss,
      eval: a.score
    })),
    stats: {
      whiteAccuracy: document.getElementById('whiteAccuracy').textContent,
      blackAccuracy: document.getElementById('blackAccuracy').textContent
    }
  };
  downloadFile(JSON.stringify(data, null, 2), 'analysis.json', 'application/json');
  hideExportModal();
}

function copyFEN() {
  if (!game) { alert('No game loaded'); return; }
  navigator.clipboard.writeText(game.fen()).then(() => {
    setStatus('FEN copied to clipboard', 'success');
    hideExportModal();
  });
}

function downloadEvalGraph() {
  const canvas = document.getElementById('evalGraph');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = 'eval_graph.png';
  link.href = canvas.toDataURL();
  link.click();
  hideExportModal();
}

// Scrubber and Explorer
function updateScrubber() {
  const scrubber = document.getElementById('moveScrubber');
  if (scrubber) {
    scrubber.max = Math.max(-1, moves.length - 1);
    scrubber.value = currentMoveIndex;
  }
}

async function updateOpeningExplorer(fen) {
  const panel = document.getElementById('openingExplorerPanel');
  const content = document.getElementById('explorerContent');
  if (!panel || !content) return;
  
  try {
    const encodedFen = encodeURIComponent(fen);
    const response = await fetch(`https://explorer.lichess.ovh/master?fen=${encodedFen}&moves=5`);
    const data = await response.json();
    
    let html = `<div style="font-size:12px; margin-bottom:8px; opacity:0.8; display:flex; justify-content:space-between;">
      <span>⚪ ${data.white}</span><span> ${data.draws}</span><span> ${data.black}</span>
    </div>`;
    
    if (data.moves && data.moves.length > 0) {
      html += '<div style="display:flex; flex-direction:column; gap:6px;">';
      data.moves.slice(0, 5).forEach(move => {
        const total = move.white + move.draws + move.black;
        const wPct = total ? (move.white / total * 100).toFixed(0) : 0;
        const dPct = total ? (move.draws / total * 100).toFixed(0) : 0;
        const bPct = total ? (move.black / total * 100).toFixed(0) : 0;
        
        html += `
          <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px; cursor:pointer; transition:background 0.2s;" 
               onmouseover="this.style.background='rgba(255,255,255,0.1)'" 
               onmouseout="this.style.background='rgba(255,255,255,0.05)'"
               onclick="playExplorerMove('${move.uci}')">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="font-weight:bold; color:#ffab40;">${move.san}</span>
              <span style="opacity:0.7; font-size:11px;">${move.games} games</span>
            </div>
            <div style="display:flex; height:6px; border-radius:3px; overflow:hidden;">
              <div style="width:${wPct}%; background:#fff;"></div>
              <div style="width:${dPct}%; background:#888;"></div>
              <div style="width:${bPct}%; background:#000;"></div>
            </div>
          </div>
        `;
      });
      html += '</div>';
    } else {
      html += '<div style="opacity:0.6; text-align:center; padding:10px;">No master games found</div>';
    }
    
    content.innerHTML = html;
    panel.style.display = 'block';
  } catch (e) {
    console.error('Explorer fetch failed:', e);
    panel.style.display = 'none';
  }
}

window.playExplorerMove = function(uci) {
  if (!game) return;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : 'q';
  
  if (isFreePlay || isExploring) {
    completeMove(from, to, promotion);
  }
};

function setStatus(text, type) {
  const indicator = document.getElementById('statusIndicator');
  document.getElementById('statusText').textContent = text;
  indicator.className = 'status-indicator ' + (type === 'loading' ? 'loading' : type === 'error' ? 'error' : '');
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  document.querySelector('.sound-toggle').textContent = soundEnabled ? '🔊 Sound On' : '🔇 Sound Off';
  if (soundEnabled) getAudioCtx();
}

function setVolume(val) {
  soundVolume = parseInt(val) / 100;
  const labels = ['Muted', 'Low', 'Medium', 'High', 'Very High'];
  const idx = val == 0 ? 0 : val <= 40 ? 1 : val <= 80 ? 2 : val <= 115 ? 3 : 4;
  document.getElementById('volumeLabel').textContent = labels[idx];
  if (soundEnabled) getAudioCtx();
}

function toggleTheme() {
  isDarkTheme = !isDarkTheme;
  document.querySelector('.theme-toggle').textContent = isDarkTheme ? '🌙 Dark' : '☀️ Light';
  document.body.style.background = isDarkTheme 
    ? 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' 
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
}