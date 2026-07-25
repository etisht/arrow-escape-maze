const Game = (function () {
  let canvas, ctx;
  let levelData = null;
  let alive = new Set(); // תאים שעדיין נחשבים "בלוח" מבחינה לוגית (חוסמים מסלולים)
  let cellByKey = new Map(); // key -> {x,y,dir}
  let cellSize = 0;
  let offsetX = 0;
  let offsetY = 0;
  let fadingOut = new Map(); // key -> {dir, start} — הוסרו לוגית, עדיין באנימציית החלקה החוצה (ויזואלי בלבד)
  let shaking = new Map(); // key -> {start} — נחסמו, עדיין בלוח, מרעידים
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
    alive = new Set(levelData.cells.map((c) => c.key));
    cellByKey = new Map(levelData.cells.map((c) => [c.key, c]));
    fadingOut.clear();
    shaking.clear();
    won = false;
    resize();
    startLoop();
  }

  function resize() {
    if (!levelData) return;
    const wrapper = canvas.parentElement;
    const cssSize = Math.min(wrapper.clientWidth, wrapper.clientHeight);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssSize + 'px';
    canvas.style.height = cssSize + 'px';
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = cssSize * 0.03;
    const usable = cssSize - pad * 2;
    cellSize = usable / levelData.size;
    offsetX = pad;
    offsetY = pad;
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
    if (!alive.has(key)) return; // כבר הוסר (או באנימציית יציאה)
    if (shaking.has(key)) return; // כבר מרעיד, אל תכפיל

    const cell = cellByKey.get(key);
    const dir = DIRECTIONS.find((d) => d.name === cell.dir);
    // alive משמש כאן גם כקבוצת החסימה - תאים שכבר הוסרו לוגית (fadingOut) לא כלולים בו,
    // כך שהקלקה הבאה תמיד מחושבת נכון גם אם עדיין רצה אנימציה על תא קודם
    const clear = isRayClear(cell.x, cell.y, dir, levelData.shapeMask, levelData.size, alive);

    if (clear) {
      alive.delete(key);
      fadingOut.set(key, { dir, start: performance.now(), x: cell.x, y: cell.y, dirName: cell.dir });
      if (alive.size === 0 && !won) {
        won = true;
        if (onWin) onWin(currentLevel);
      }
    } else {
      shaking.set(key, { start: performance.now() });
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

    for (const key of alive) {
      const cell = cellByKey.get(key);
      let dx = 0, color = ARROW_COLOR;
      const shake = shaking.get(key);
      if (shake) {
        const p = (now - shake.start) / SHAKE_MS;
        if (p >= 1) {
          shaking.delete(key);
        } else {
          dx = Math.sin(p * Math.PI * 6) * cellSize * 0.12;
          color = BLOCKED_COLOR;
        }
      }
      drawArrow(cell.x, cell.y, cell.dir, dx, 0, 1, color);
    }

    const finishedFades = [];
    for (const [key, anim] of fadingOut) {
      const p = Math.min(1, (now - anim.start) / SLIDE_MS);
      const eased = p * p;
      const dx = anim.dir.dx * cellSize * 1.8 * eased;
      const dy = anim.dir.dy * cellSize * 1.8 * eased;
      const alpha = 1 - p;
      drawArrow(anim.x, anim.y, anim.dirName, dx, dy, alpha, '#3d6cf0');
      if (p >= 1) finishedFades.push(key);
    }
    for (const key of finishedFades) fadingOut.delete(key);
  }

  function drawArrow(gx, gy, dirName, dx, dy, alpha, color) {
    const cx = offsetX + (gx + 0.5) * cellSize + dx;
    const cy = offsetY + (gy + 0.5) * cellSize + dy;
    const len = cellSize * 0.34;
    const headSize = cellSize * 0.16;

    let ang = 0;
    if (dirName === 'up') ang = -Math.PI / 2;
    else if (dirName === 'down') ang = Math.PI / 2;
    else if (dirName === 'left') ang = Math.PI;
    else ang = 0;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, cellSize * 0.1);
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
    return alive.size;
  }

  function totalCount() {
    return levelData ? levelData.cells.length : 0;
  }

  function destroy() {
    stopLoop();
    levelData = null;
  }

  return { init, loadLevel, resize, remainingCount, totalCount, destroy };
})();
