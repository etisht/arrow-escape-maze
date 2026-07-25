// יצירת מסכת "בלוב" על גריד ריבועי: מעגל בסיס + רעש פוליארי (הרמוניות סינוס)
function generateBlobShape(size, rng, irregularity) {
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const baseRadius = size / 2 - 0.6;

  const harmonics = 3 + Math.floor(irregularity * 4);
  const amps = [];
  const phases = [];
  const freqs = [];
  for (let i = 0; i < harmonics; i++) {
    amps.push((0.06 + rng() * 0.12) * irregularity * baseRadius);
    phases.push(rng() * Math.PI * 2);
    freqs.push(2 + Math.floor(rng() * 5));
  }

  function radiusAt(theta) {
    let r = baseRadius;
    for (let i = 0; i < harmonics; i++) {
      r += amps[i] * Math.sin(freqs[i] * theta + phases[i]);
    }
    return Math.max(baseRadius * 0.55, r);
  }

  const mask = [];
  for (let y = 0; y < size; y++) {
    mask.push(new Array(size).fill(false));
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const theta = Math.atan2(dy, dx);
      if (dist <= radiusAt(theta)) {
        mask[y][x] = true;
      }
    }
  }

  ensureConnected(mask, size);
  return mask;
}

// שומר רק את הרכיב הקשיר הגדול ביותר (מונע תאים "יתומים" מחוץ לצורה העיקרית)
function ensureConnected(mask, size) {
  const visited = [];
  for (let y = 0; y < size; y++) visited.push(new Array(size).fill(false));

  let best = null;
  let bestCount = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[y][x] && !visited[y][x]) {
        const comp = [];
        const stack = [[x, y]];
        visited[y][x] = true;
        while (stack.length) {
          const [cx0, cy0] = stack.pop();
          comp.push([cx0, cy0]);
          const neighbors = [[cx0 + 1, cy0], [cx0 - 1, cy0], [cx0, cy0 + 1], [cx0, cy0 - 1]];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < size && ny >= 0 && ny < size && mask[ny][nx] && !visited[ny][nx]) {
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
  for (let y = 0; y < size; y++) cleared.push(new Array(size).fill(false));
  if (best) {
    for (const [x, y] of best) cleared[y][x] = true;
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      mask[y][x] = cleared[y][x];
    }
  }
}
