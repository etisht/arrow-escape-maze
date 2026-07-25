const Game = (function () {
  let canvas, ctx;
  let levelData = null;
  let alivePieceIdx = new Set(); // אינדקסים של חלקים שעדיין נשארים בלוח
  let remainingCells = new Set(); // איחוד תאי כל החלקים החיים (לחסימת קרניים ולתצוגת התקדמות)
  let cellSize = 0;
  let offsetX = 0;
  let offsetY = 0;
  let fadingOut = new Map(); // pieceIdx -> {dir, start} — הוסר לוגית, עדיין באנימציית החלקה החוצה
  let shaking = new Map(); // pieceIdx -> {start} — נחסם, עדיין בלוח, מרעיד
  let rafId = null;
  let onWin = null;
  let currentLevel = 1;
  let won = false;

  const ARROW_COLOR = '#1b2a4a';
  const BLOCKED_COLOR = '#e0442f';
  const SLIDE_MS = 260;
  const SHAKE_MS = 220;

  function init(canvasEl, options) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onWin = options.onWin;
    canvas.addEventListener('pointerdown', handlePointerDown);
  }

  function loadLevel(level) {
    currentLevel = level;
    levelData = buildLevel(level);
    alivePieceIdx = new Set(levelData.pieces.map((_, i) => i));
    remainingCells = new Set(Object.keys(levelData.cellToPieceIndex));
    fadingOut.clear();
    shaking.clear();
    won = false;
    resize();
    startLoop();
  }

  function resize() {
    if (!levelData) return;
    const wrapper = canvas.parentElement;
    // מתאים רוחב למסך ומאפשר לגובה לגלוש לגלילה אנכית (כמו במשחק המקורי) —
    // כך גודל התא נשאר קריא גם ברשתות גדולות, במקום להצטמצם כדי להיכנס לגובה המסך
    const cssWidth = wrapper.clientWidth;
    const dpr = window.devicePixelRatio || 1;

    const pad = cssWidth * 0.03;
    const usable = cssWidth - pad * 2;
    cellSize = usable / levelData.cols;
    offsetX = pad;
    offsetY = pad;

    const cssHeight = levelData.rows * cellSize + pad * 2;

    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function keyFromPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const col = Math.floor((px - offsetX) / cellSize);
    const row = Math.floor((py - offsetY) / cellSize);
    return cellKey(col, row);
  }

  function handlePointerDown(e) {
    if (!levelData || won) return;
    const key = keyFromPoint(e.clientX, e.clientY);
    const idx = levelData.cellToPieceIndex[key];
    if (idx === undefined) return;
    if (!alivePieceIdx.has(idx)) return; // כבר הוסר (או באנימציית יציאה)
    if (shaking.has(idx)) return; // כבר מרעיד, אל תכפיל

    const piece = levelData.pieces[idx];
    const head = piece.cells[piece.cells.length - 1];
    const dir = DIRECTIONS.find((d) => d.name === piece.exitDir);
    // מחריגים את תאי החלק עצמו מקבוצת החסימה - הם עומדים להשתחרר יחד איתו,
    // כך שהבדיקה תמיד תואמת בדיוק למה שהובטח בזמן היצירה
    const blockingView = { has: (k) => remainingCells.has(k) && !piece.keySet.has(k) };
    const clear = isRayClear(head.x, head.y, dir, levelData.shapeMask, levelData.cols, levelData.rows, blockingView);

    if (clear) {
      alivePieceIdx.delete(idx);
      for (const k of piece.keySet) remainingCells.delete(k);
      fadingOut.set(idx, { dir, start: performance.now() });
      if (remainingCells.size === 0 && !won) {
        won = true;
        if (onWin) onWin(currentLevel);
      }
    } else {
      shaking.set(idx, { start: performance.now() });
    }
  }

  function startLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    const loop = (t) => {
      draw(t);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function draw(now) {
    if (!levelData) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const idx of alivePieceIdx) {
      const piece = levelData.pieces[idx];
      let dx = 0, color = ARROW_COLOR;
      const shake = shaking.get(idx);
      if (shake) {
        const p = (now - shake.start) / SHAKE_MS;
        if (p >= 1) {
          shaking.delete(idx);
        } else {
          dx = Math.sin(p * Math.PI * 6) * cellSize * 0.12;
          color = BLOCKED_COLOR;
        }
      }
      drawPiece(piece, dx, 0, 1, color);
    }

    const finishedFades = [];
    for (const [idx, anim] of fadingOut) {
      const p = Math.min(1, (now - anim.start) / SLIDE_MS);
      const eased = p * p;
      const dx = anim.dir.dx * cellSize * 1.8 * eased;
      const dy = anim.dir.dy * cellSize * 1.8 * eased;
      const alpha = 1 - p;
      drawPiece(levelData.pieces[idx], dx, dy, alpha, '#3d6cf0');
      if (p >= 1) finishedFades.push(idx);
    }
    for (const idx of finishedFades) fadingOut.delete(idx);
  }

  function drawPiece(piece, dx, dy, alpha, color) {
    for (let i = 0; i < piece.cells.length - 1; i++) {
      drawConnector(piece.cells[i], piece.cells[i + 1], dx, dy, alpha, color);
    }
    const head = piece.cells[piece.cells.length - 1];
    const dir = DIRECTIONS.find((d) => d.name === piece.exitDir);
    drawArrowHead(head.x, head.y, dir, dx, dy, alpha, color);
  }

  function drawConnector(a, b, dx, dy, alpha, color) {
    const ax = offsetX + (a.x + 0.5) * cellSize + dx;
    const ay = offsetY + (a.y + 0.5) * cellSize + dy;
    const bx = offsetX + (b.x + 0.5) * cellSize + dx;
    const by = offsetY + (b.y + 0.5) * cellSize + dy;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.1, cellSize * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  }

  function drawArrowHead(gx, gy, dir, dx, dy, alpha, color) {
    const cx = offsetX + (gx + 0.5) * cellSize + dx;
    const cy = offsetY + (gy + 0.5) * cellSize + dy;
    const len = cellSize * 0.34;
    // רצפות מינימום כדי שכיוון החץ יישאר קריא גם ברשתות צפופות מאוד
    const headSize = Math.max(2.4, cellSize * 0.24);
    const ang = Math.atan2(dir.dy, dir.dx);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.1, cellSize * 0.1);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.lineTo(len - headSize * 0.4, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.lineTo(len - headSize, -headSize * 0.75);
    ctx.lineTo(len - headSize, headSize * 0.75);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function remainingCount() {
    return remainingCells.size;
  }

  function totalCount() {
    return levelData ? levelData.totalCells : 0;
  }

  function destroy() {
    stopLoop();
    levelData = null;
  }

  return { init, loadLevel, resize, remainingCount, totalCount, destroy };
})();
