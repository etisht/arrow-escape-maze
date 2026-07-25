// יצירת מסכת "בלוב" על גריד מלבני (cols x rows): אליפסת בסיס + רעש פוליארי
// (הרמוניות סינוס) יחסי לרדיוס המקומי, כך שהצורה יכולה להיות מוארכת (גבוהה מרחבה)
function generateBlobShape(cols, rows, rng, irregularity) {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const rx = cols / 2 - 0.6;
  const ry = rows / 2 - 0.6;

  const harmonics = 3 + Math.floor(irregularity * 4);
  const ampFracs = [];
  const phases = [];
  const freqs = [];
  for (let i = 0; i < harmonics; i++) {
    ampFracs.push((0.05 + rng() * 0.1) * irregularity);
    phases.push(rng() * Math.PI * 2);
    freqs.push(2 + Math.floor(rng() * 5));
  }

  function ellipseRadiusAt(theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return 1 / Math.sqrt((c * c) / (rx * rx) + (s * s) / (ry * ry));
  }

  function radiusFactorAt(theta) {
    let factor = 1;
    for (let i = 0; i < harmonics; i++) {
      factor += ampFracs[i] * Math.sin(freqs[i] * theta + phases[i]);
    }
    return Math.max(0.55, factor);
  }

  const mask = [];
  for (let y = 0; y < rows; y++) {
    mask.push(new Array(cols).fill(false));
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const normDist = Math.sqrt(dx * dx + dy * dy);
      const theta = Math.atan2(y - cy, x - cx);
      const boundary = radiusFactorAt(theta);
      if (normDist <= boundary) {
        mask[y][x] = true;
      }
    }
  }

  ensureConnected(mask, cols, rows);
  return mask;
}

// בונה לוח מלא: הבלוב הראשי במרכז, בתוספת עד 4 "אצטרובלים" — רצועות תאים
// קטנות ונפרדות (לא מחוברות לבלוב) בשוליים סביבו, כמו במשחק המקור
function buildShapeWithSatellites(blobCols, blobRows, rng, irregularity, satelliteCount) {
  const marginCols = 3; // עמודות שוליים בכל צד (השורה/עמודה הצמודה לבלוב נשארת ריקה כפער)
  const marginRows = 4;

  const blobMask = generateBlobShape(blobCols, blobRows, rng, irregularity);

  const cols = blobCols + marginCols * 2;
  const rows = blobRows + marginRows * 2;
  const offsetX = marginCols;
  const offsetY = marginRows;

  const mask = [];
  for (let y = 0; y < rows; y++) mask.push(new Array(cols).fill(false));
  for (let y = 0; y < blobRows; y++) {
    for (let x = 0; x < blobCols; x++) {
      if (blobMask[y][x]) mask[y + offsetY][x + offsetX] = true;
    }
  }

  const slots = [
    { name: 'top', x0: offsetX, x1: offsetX + blobCols - 1, y0: 0, y1: offsetY - 2 },
    { name: 'bottom', x0: offsetX, x1: offsetX + blobCols - 1, y0: offsetY + blobRows + 1, y1: rows - 1 },
    { name: 'left', x0: 0, x1: offsetX - 2, y0: offsetY, y1: offsetY + blobRows - 1 },
    { name: 'right', x0: offsetX + blobCols + 1, x1: cols - 1, y0: offsetY, y1: offsetY + blobRows - 1 },
  ].filter((s) => s.x1 >= s.x0 && s.y1 >= s.y0);

  shuffleInPlace(slots, rng);
  const chosen = slots.slice(0, Math.min(satelliteCount, slots.length));
  for (const slot of chosen) {
    addRandomStrip(mask, cols, rows, slot, rng);
  }

  return { mask, cols, rows };
}

// מוסיף הליכה אקראית קצרה (רצועת תאים) בתוך מלבן שוליים נתון
function addRandomStrip(mask, cols, rows, slot, rng) {
  const width = slot.x1 - slot.x0 + 1;
  const height = slot.y1 - slot.y0 + 1;
  const cellCount = width * height;
  if (cellCount <= 0) return;

  const startX = slot.x0 + Math.floor(rng() * width);
  const startY = slot.y0 + Math.floor(rng() * height);
  const visited = new Set([startX + ',' + startY]);
  mask[startY][startX] = true;

  const targetLen = Math.min(cellCount, 4 + Math.floor(rng() * 5));
  let cx = startX, cy = startY;
  while (visited.size < targetLen) {
    const options = [];
    for (const d of DIRECTIONS4) {
      const nx = cx + d.dx, ny = cy + d.dy;
      const key = nx + ',' + ny;
      if (nx >= slot.x0 && nx <= slot.x1 && ny >= slot.y0 && ny <= slot.y1 && !visited.has(key)) {
        options.push({ x: nx, y: ny, key });
      }
    }
    if (options.length === 0) break;
    const next = rngPick(rng, options);
    visited.add(next.key);
    mask[next.y][next.x] = true;
    cx = next.x;
    cy = next.y;
  }
}

// שומר רק את הרכיב הקשיר הגדול ביותר (מונע תאים "יתומים" מחוץ לצורה העיקרית)
function ensureConnected(mask, cols, rows) {
  const visited = [];
  for (let y = 0; y < rows; y++) visited.push(new Array(cols).fill(false));

  let best = null;
  let bestCount = 0;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (mask[y][x] && !visited[y][x]) {
        const comp = [];
        const stack = [[x, y]];
        visited[y][x] = true;
        while (stack.length) {
          const [cx0, cy0] = stack.pop();
          comp.push([cx0, cy0]);
          const neighbors = [[cx0 + 1, cy0], [cx0 - 1, cy0], [cx0, cy0 + 1], [cx0, cy0 - 1]];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && mask[ny][nx] && !visited[ny][nx]) {
              visited[ny][nx] = true;
              stack.push([nx, ny]);
            }
          }
        }
        if (comp.length > bestCount) {
          bestCount = comp.length;
          best = comp;
        }
      }
    }
  }

  const cleared = [];
  for (let y = 0; y < rows; y++) cleared.push(new Array(cols).fill(false));
  if (best) {
    for (const [x, y] of best) cleared[y][x] = true;
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      mask[y][x] = cleared[y][x];
    }
  }
}
