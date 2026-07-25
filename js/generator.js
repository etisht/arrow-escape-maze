// יצירת שלב פתיר מובטח: לכל תא בצורה משבצים כיוון חץ קבוע,
// כך שקיים סדר הסרה חוקי (סדר הבנייה עצמו).

const DIRECTIONS = [
  { name: 'up', dx: 0, dy: -1 },
  { name: 'down', dx: 0, dy: 1 },
  { name: 'left', dx: -1, dy: 0 },
  { name: 'right', dx: 1, dy: 0 },
];

function cellKey(x, y) {
  return x + ',' + y;
}

// בודק אם הקרן מ-(x,y) בכיוון dir חופשית: מותר לעבור רק דרך תאים
// שאינם ב-blockingSet (או שיצאו מהצורה/מהגריד)
function isRayClear(x, y, dir, shapeMask, size, blockingSet) {
  let nx = x + dir.dx;
  let ny = y + dir.dy;
  while (nx >= 0 && nx < size && ny >= 0 && ny < size && shapeMask[ny][nx]) {
    if (blockingSet.has(cellKey(nx, ny))) return false;
    nx += dir.dx;
    ny += dir.dy;
  }
  return true;
}

function difficultyBiasForLevel(level, gridSize) {
  // מתחיל נמוך יחסית (רמה בינונית) ועולה בהדרגה ככל שהתקרה של גודל הלוח מתקרבת/עוברת
  const t = Math.min(1, level / 1000);
  return 0.15 + 0.75 * t;
}

function generateLevel(level, size, shapeMask) {
  const rng = createRng(hashSeed('lvl-' + level));

  const cells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (shapeMask[y][x]) cells.push({ x, y, key: cellKey(x, y) });
    }
  }

  const remaining = new Set(cells.map((c) => c.key));
  const directionOf = {};
  const removalOrder = [];
  const bias = difficultyBiasForLevel(level, size);

  while (remaining.size > 0) {
    const candidates = [];
    for (const key of remaining) {
      const [xs, ys] = key.split(',');
      const x = Number(xs);
      const y = Number(ys);
      const validDirs = [];
      for (const dir of DIRECTIONS) {
        if (isRayClear(x, y, dir, shapeMask, size, remaining)) validDirs.push(dir);
      }
      if (validDirs.length > 0) candidates.push({ key, x, y, validDirs });
    }

    if (candidates.length === 0) {
      throw new Error('יצירת שלב נכשלה (מצב לא צפוי) — level ' + level);
    }

    candidates.sort((a, b) => a.validDirs.length - b.validDirs.length);
    const minDirs = candidates[0].validDirs.length;
    const constrainedCount = candidates.filter((c) => c.validDirs.length === minDirs).length;
    const poolSize = Math.max(constrainedCount, Math.round(candidates.length * (1 - bias)));
    const pool = candidates.slice(0, Math.min(candidates.length, poolSize));

    const chosen = rngPick(rng, pool);
    const dir = rngPick(rng, chosen.validDirs);
    directionOf[chosen.key] = dir.name;
    remaining.delete(chosen.key);
    removalOrder.push(chosen.key);
  }

  return {
    level,
    size,
    shapeMask,
    cells: cells.map((c) => ({ x: c.x, y: c.y, key: c.key, dir: directionOf[c.key] })),
  };
}

function gridSizeForLevel(level) {
  return Math.min(23, Math.max(7, Math.round(7 + Math.sqrt(level))));
}

function irregularityForLevel(level) {
  const t = Math.min(1, level / 1000);
  return 0.35 + 0.5 * t;
}

function buildLevel(level) {
  const size = gridSizeForLevel(level);
  const rng = createRng(hashSeed('shape-' + level));
  const shapeMask = generateBlobShape(size, rng, irregularityForLevel(level));
  return generateLevel(level, size, shapeMask);
}
