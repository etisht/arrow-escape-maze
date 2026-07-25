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
function isRayClear(x, y, dir, shapeMask, cols, rows, blockingSet) {
  let nx = x + dir.dx;
  let ny = y + dir.dy;
  while (nx >= 0 && nx < cols && ny >= 0 && ny < rows && shapeMask[ny][nx]) {
    if (blockingSet.has(cellKey(nx, ny))) return false;
    nx += dir.dx;
    ny += dir.dy;
  }
  return true;
}

function difficultyBiasForLevel(level) {
  // עולה חד בשלבים הראשונים כדי שכבר סביב שלב 10 יהיה כמעט תמיד רק המהלך
  // המחויב/המוגבל ביותר זמין (מקסימום תלות-סדר), ואז נשאר קרוב לתקרה
  const t = Math.min(1, Math.sqrt(level / 8));
  return Math.min(0.97, 0.5 + 0.47 * t);
}

function generateLevel(level, cols, rows, shapeMask) {
  const rng = createRng(hashSeed('lvl-' + level));

  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (shapeMask[y][x]) cells.push({ x, y, key: cellKey(x, y) });
    }
  }

  const remaining = new Set(cells.map((c) => c.key));
  const directionOf = {};
  const bias = difficultyBiasForLevel(level);

  while (remaining.size > 0) {
    const candidates = [];
    for (const key of remaining) {
      const [xs, ys] = key.split(',');
      const x = Number(xs);
      const y = Number(ys);
      const validDirs = [];
      for (const dir of DIRECTIONS) {
        if (isRayClear(x, y, dir, shapeMask, cols, rows, remaining)) validDirs.push(dir);
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
  }

  return {
    level,
    cols,
    rows,
    shapeMask,
    cells: cells.map((c) => ({ x: c.x, y: c.y, key: c.key, dir: directionOf[c.key] })),
  };
}

function colsForLevel(level) {
  // רוחב הלוח נשאר מוגבל כדי שגודל התא יישאר קריא וניתן למגע במובייל
  return Math.min(26, Math.max(13, Math.round(13 + 5 * Math.sqrt(level))));
}

function rowsForLevel(level, cols) {
  // גובה הלוח ממשיך לגדול הרבה מעבר לרוחב, כמו במשחק המקור (לוח מוארך שגולשים בו),
  // וכך הקושי/האורך ממשיכים לעלות גם אחרי שהרוחב הגיע לתקרה שלו
  const factor = 1 + 2.2 * Math.min(1, Math.sqrt(level / 40));
  return Math.min(100, Math.max(cols, Math.round(cols * factor)));
}

function irregularityForLevel(level) {
  const t = Math.min(1, Math.sqrt(level / 20));
  return 0.45 + 0.4 * t;
}

function buildLevel(level) {
  const cols = colsForLevel(level);
  const rows = rowsForLevel(level, cols);
  const rng = createRng(hashSeed('shape-' + level));
  const shapeMask = generateBlobShape(cols, rows, rng, irregularityForLevel(level));
  return generateLevel(level, cols, rows, shapeMask);
}
