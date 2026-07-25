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
