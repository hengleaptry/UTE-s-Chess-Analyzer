// Board annotations - arrows and highlights

let rightDragStart = null;
let rightDragActive = false;
let userArrows = new Map();
let userHighlights = new Set();

function setupAnnotations() {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
  
  boardEl.oncontextmenu = (e) => {
    e.preventDefault();
    return false;
  };
}

function handleRightMouseDown(square) {
  rightDragStart = square;
  rightDragActive = true;
}

function handleRightMouseUp(square) {
  if (!rightDragStart) return;
  
  const start = rightDragStart;
  
  if (start === square) {
    if (userHighlights.has(start)) {
      userHighlights.delete(start);
    } else {
      userHighlights.add(start);
    }
  } else {
    const key = start + '_' + square;
    const reverseKey = square + '_' + start;
    
    if (userArrows.has(key)) {
      userArrows.delete(key);
    } else if (userArrows.has(reverseKey)) {
      userArrows.delete(reverseKey);
    } else {
      userArrows.set(key, { from: start, to: square });
    }
  }
  
  rightDragStart = null;
  rightDragActive = false;
  renderUserAnnotations();
}

function clearUserAnnotations() {
  userArrows.clear();
  userHighlights.clear();
  renderUserAnnotations();
}

function renderUserAnnotations() {
  document.querySelectorAll('.square.user-highlight').forEach(sq => {
    sq.classList.remove('user-highlight');
  });
  
  userHighlights.forEach(sqName => {
    const el = document.querySelector(`[data-square="${sqName}"]`);
    if (el) el.classList.add('user-highlight');
  });
  
  const svg = document.getElementById('userArrows');
  if (!svg) return;
  
  svg.innerHTML = '';
  userArrows.forEach(({ from, to }) => {
    drawUserArrow(svg, from, to, '#f2a900');
  });
}

function squareCenter(square) {
  const el = document.querySelector(`[data-square="${square}"]`);
  if (!el) return null;
  return {
    x: el.offsetLeft + 37.5,
    y: el.offsetTop + 37.5
  };
}

function squareFileRank(sq) {
  return {
    file: sq.charCodeAt(0) - 97,
    rank: parseInt(sq[1], 10) - 1
  };
}

function fileRankToSquare(file, rank) {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return String.fromCharCode(97 + file) + (rank + 1);
}

function drawUserArrow(svg, from, to, color) {
  const f = squareFileRank(from);
  const t = squareFileRank(to);
  const dx = t.file - f.file;
  const dy = t.rank - f.rank;
  const isKnightShape = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || 
                        (Math.abs(dx) === 2 && Math.abs(dy) === 1);
  
  if (!isKnightShape) {
    drawStraightArrow(svg, from, to, color);
    return;
  }
  
  const bendSquare = Math.abs(dx) === 2
    ? fileRankToSquare(f.file + dx, f.rank)
    : fileRankToSquare(f.file, f.rank + dy);
  
  if (!bendSquare) {
    drawStraightArrow(svg, from, to, color);
    return;
  }
  
  const p1 = squareCenter(from);
  const pBend = squareCenter(bendSquare);
  
  if (!p1 || !pBend) return;
  
  const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line1.setAttribute('x1', p1.x);
  line1.setAttribute('y1', p1.y);
  line1.setAttribute('x2', pBend.x);
  line1.setAttribute('y2', pBend.y);
  line1.setAttribute('stroke', color);
  line1.setAttribute('stroke-width', '10');
  line1.setAttribute('stroke-linecap', 'round');
  line1.setAttribute('opacity', '0.85');
  svg.appendChild(line1);
  
  drawStraightArrow(svg, bendSquare, to, color);
}

function drawStraightArrow(svg, from, to, color) {
  const p1 = squareCenter(from);
  const p2 = squareCenter(to);
  
  if (!p1 || !p2) return;
  
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  if (len < 1) return;
  
  const ux = dx / len;
  const uy = dy / len;
  
  const x1 = p1.x + ux * 12;
  const y1 = p1.y + uy * 12;
  const x2 = p2.x - ux * 24;
  const y2 = p2.y - uy * 24;
  
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '10');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('opacity', '0.85');
  svg.appendChild(line);
  
  const angle = Math.atan2(dy, dx);
  const tipX = p2.x - ux * 8;
  const tipY = p2.y - uy * 8;
  const backX = tipX - 20 * Math.cos(angle);
  const backY = tipY - 20 * Math.sin(angle);
  const leftX = backX + 12 * Math.cos(angle + Math.PI / 2);
  const leftY = backY + 12 * Math.sin(angle + Math.PI / 2);
  const rightX = backX + 12 * Math.cos(angle - Math.PI / 2);
  const rightY = backY + 12 * Math.sin(angle - Math.PI / 2);
  
  const head = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  head.setAttribute('points', `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`);
  head.setAttribute('fill', color);
  head.setAttribute('opacity', '0.9');
  svg.appendChild(head);
}