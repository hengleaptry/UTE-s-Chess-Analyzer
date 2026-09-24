// Utility functions and constants

const PIECE_IMAGES = {
  'wK': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
  'wQ': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
  'wR': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
  'wB': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
  'wN': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
  'wP': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
  'bK': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
  'bQ': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
  'bR': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
  'bB': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
  'bN': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
  'bP': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg'
};

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const CLASSIFICATION_ICONS = {
  book: { color: '#7f8c8d', glyph: '' },
  brilliant: { color: '#1abc9c', glyph: '!!' },
  best: { color: '#2ecc71', glyph: '★' },
  great: { color: '#27ae60', glyph: '!' },
  good: { color: '#a8d85a', glyph: '✓' },
  miss: { color: '#f1c40f', glyph: '?!' },
  bad: { color: '#e67e22', glyph: '?' },
  blunder: { color: '#e74c3c', glyph: '??' },
  checkmate: { color: '#c0392b', glyph: '' },
  winner: { color: '#16a34a', glyph: '♔' }
};

function classificationIconSVG(cls, size) {
  const def = CLASSIFICATION_ICONS[cls] || CLASSIFICATION_ICONS.good;
  const s = size || 22;
  const fontSize = def.glyph.length > 1 ? s * 0.46 : s * 0.58;
  return `<svg class="class-icon" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${s/2}" cy="${s/2}" r="${s/2 - 1}" fill="${def.color}" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
          font-family="Segoe UI Symbol, Arial, sans-serif" font-size="${fontSize}"
          font-weight="bold" fill="#fff">${def.glyph}</text>
  </svg>`;
}

function stripPgnNoise(pgn) {
  let text = pgn;
  text = text.replace(/\[[^\]]*\]/g, '');
  text = text.replace(/\{[^}]*\}/g, '');
  text = text.replace(/;[^\n\r]*/g, '');
  text = text.replace(/\$\d+/g, '');
  let prev;
  do {
    prev = text;
    text = text.replace(/\([^()]*\)/g, '');
  } while (text !== prev);
  return text.trim();
}

function looksLikeFEN(str) {
  const fenRegex = /^([pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+\s+[wb]\s+(-|[KQkq]{1,4})\s+(-|[a-h][36])\s+\d+\s+\d+$/;
  return fenRegex.test(str.trim());
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parsePGNHeaders(pgn) {
  const headers = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;
  while ((match = headerRegex.exec(pgn)) !== null) {
    headers[match[1]] = match[2];
  }
  return headers;
}