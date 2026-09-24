// Chess engine initialization and communication

let stockfish = null;
let engineQueue = Promise.resolve();
let engineInitialized = false;
let engineType = 'none'; // 'modern', 'legacy', or 'none'

const MODERN_ENGINE_JS = 'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js';
const MODERN_ENGINE_WASM = 'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.wasm';
const LEGACY_ENGINE_JS = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js';

function createWorkerViaImportScripts(jsUrl) {
  const code = `importScripts(${JSON.stringify(jsUrl)});`;
  const blob = new Blob([code], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

function createModernStockfishWorker(jsUrl, wasmUrl) {
  const code = `
    self.window = self;
    self.document = { currentScript: {} };
    importScripts(${JSON.stringify(jsUrl)});

    var StockfishFactory = self.document.currentScript._exports;
    if (typeof StockfishFactory !== 'function') {
      throw new Error('stockfish factory export not found (library shape changed)');
    }

    var engine = null;
    var pending = [];

    self.onmessage = function(ev) {
      if (engine) engine.onCustomMessage(ev.data);
      else pending.push(ev.data);
    };

    StockfishFactory({
      locateFile: function(path) {
        return path.indexOf('.wasm') > -1 ? ${JSON.stringify(wasmUrl)} : path;
      }
    }).then(function(sf) {
      engine = sf;
      engine.addMessageListener(function(line) { postMessage(line); });
      pending.forEach(function(cmd) { engine.onCustomMessage(cmd); });
      pending = null;
    }).catch(function(err) {
      postMessage('error: ' + (err && err.message ? err.message : String(err)));
    });
  `;
  const blob = new Blob([code], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

function verifyEngineHandshake(worker, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      clearTimeout(timeoutId);
    };
    
    const onMessage = (e) => {
      if (settled) return;
      if (typeof e.data === 'string' && e.data.startsWith('error:')) {
        settled = true;
        cleanup();
        reject(new Error(e.data));
        return;
      }
      if (typeof e.data === 'string' && (e.data.includes('uciok') || e.data.includes('id name'))) {
        settled = true;
        cleanup();
        resolve();
      }
    };
    
    const onError = (e) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(e.message || 'worker error'));
    };
    
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Engine handshake timeout'));
    }, timeoutMs);
    
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage('uci');
  });
}

async function initStockfish() {
  setEngineBadge('loading', 'Loading Stockfish 16 NNUE...');
  
  // Try modern engine first
  try {
    console.log('Attempting to load modern Stockfish 16 NNUE...');
    const worker = createModernStockfishWorker(MODERN_ENGINE_JS, MODERN_ENGINE_WASM);
    await verifyEngineHandshake(worker, 40000); // 40 second timeout - ~40MB wasm needs room
    stockfish = worker;
    engineType = 'modern';
    setEngineBadge('modern', '✓ Stockfish 16 NNUE Ready');
    engineInitialized = true;
    console.log('✓ Modern engine loaded successfully');
  } catch (e) {
    console.warn('Modern engine failed:', e.message);
    
    // Try legacy engine
    try {
      console.log('Falling back to legacy Stockfish 10...');
      const legacyWorker = createWorkerViaImportScripts(LEGACY_ENGINE_JS);
      await verifyEngineHandshake(legacyWorker, 20000);
      stockfish = legacyWorker;
      engineType = 'legacy';
      setEngineBadge('legacy', '⚠ Stockfish 10 (Legacy - Less Accurate)');
      engineInitialized = true;
      console.log('⚠ Legacy engine loaded (reduced accuracy)');
    } catch (e2) {
      console.error('All engines failed:', e2);
      setEngineBadge('failed', ' Engine failed to load');
      setStatus('Chess engine failed to load. Please use a local server (not file://).', 'error');
      engineInitialized = false;
      engineType = 'none';
      return;
    }
  }
  
  stockfish.postMessage('uci');
  stockfish.postMessage('setoption name Hash value 128');
  stockfish.postMessage('isready');
  applyEngineOptions();
}

function setEngineBadge(kind, text) {
  const el = document.getElementById('engineBadge');
  if (el) {
    el.className = 'engine-badge ' + kind;
    el.textContent = text;
  }
}

function analyzePosition(fen, targetDepth, moveTimeMs, multiPvOverride) {
  const run = engineQueue.then(() => analyzePositionRaw(fen, targetDepth, moveTimeMs, multiPvOverride));
  engineQueue = run.then(() => {}, () => {});
  return run;
}

function analyzePositionRaw(fen, targetDepth, moveTimeMs, multiPvOverride) {
  return new Promise((resolve, reject) => {
    if (!stockfish) {
      reject(new Error('Engine unavailable'));
      return;
    }
    
    if (multiPvOverride) {
      stockfish.postMessage('setoption name MultiPV value ' + multiPvOverride);
    }
    
    const lines = {};
    let settled = false;
    const actualMoveTime = moveTimeMs;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      stockfish.removeEventListener('message', handler);
      const sorted = Object.values(lines).sort((a, b) => a.multipv - b.multipv);
      if (sorted.length > 0) {
        resolve({
          bestMove: sorted[0].pv[0],
          score: sorted[0].score,
          pv: sorted[0].pv,
          lines: sorted
        });
      } else {
        reject(new Error('Engine timeout'));
      }
    }, actualMoveTime + 5000);
    
    const handler = function(e) {
      const msg = e.data;
      if (typeof msg !== 'string') return;
      
      if (msg.startsWith('bestmove')) {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        stockfish.removeEventListener('message', handler);
        
        const parts = msg.split(' ');
        const sorted = Object.values(lines).sort((a, b) => a.multipv - b.multipv);
        const top = sorted.find(l => l.multipv === 1) || sorted[0];
        
        resolve({
          bestMove: (top && top.pv && top.pv[0]) || parts[1],
          score: top ? top.score : 0,
          pv: top ? top.pv : [],
          lines: sorted
        });
      } else if (msg.includes('info') && msg.includes('depth')) {
        const depthMatch = msg.match(/depth (\d+)/);
        const multipvMatch = msg.match(/multipv (\d+)/);
        const scoreMatch = msg.match(/score (cp|mate) (-?\d+)/);
        const pvMatch = msg.match(/ pv (.+)$/);
        
        const multipv = multipvMatch ? parseInt(multipvMatch[1]) : 1;
        const currentDepth = depthMatch ? parseInt(depthMatch[1]) : 0;
        
        if (scoreMatch) {
          let lineScore = 0;
          if (scoreMatch[1] === 'cp') {
            lineScore = parseInt(scoreMatch[2]);
          } else {
            const mateIn = parseInt(scoreMatch[2]);
            lineScore = mateIn > 0 ? 10000 - mateIn * 10 : -10000 - mateIn * 10;
          }
          
          const linePv = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];
          
          if (!lines[multipv] || currentDepth >= (lines[multipv].depth || 0)) {
            lines[multipv] = {
              multipv,
              score: lineScore,
              pv: linePv,
              depth: currentDepth
            };
          }
        }
      }
    };
    
    stockfish.addEventListener('message', handler);
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go movetime ${actualMoveTime} depth ${targetDepth}`);
  });
}

function applyEngineOptions() {
  if (!stockfish) return;
  const multiPv = document.getElementById('multipvInput').value || 1;
  stockfish.postMessage('setoption name MultiPV value ' + multiPv);
}