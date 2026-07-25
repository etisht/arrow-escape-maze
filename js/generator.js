// יצירת שלב פתיר מובטח.
// כל שלב מורכב מ"חלקים" (pieces): רצף תאים מחוברים (יכול להיות ישר או מפותל/עם פניות),
// שבסופו חץ יציאה (יכול להיות גם באלכסון). לחיצה על כל תא בחלק בודקת אם קצה החלק
// (הראש) יכול לצאת מהצורה בכיוון החץ שלו מבלי להיתקע בחלק אחר שנשאר על הלוח —
// אם כן, כל החלק (כל התאים שלו) משתחרר יחד.

const DIRECTIONS4 = [
  { name: 'up', dx: 0, dy: -1 },
  { name: 'down', dx: 0, dy: 1 },
  { name: 'left', dx: -1, dy: 0 },
  { name: 'right', dx: 1, dy: 0 },
];

const DIRECTIONS8 = DIRECTIONS4.concat([
  { name: 'up-left', dx: -1, dy: -1 },
  { name: 'up-right', dx: 1, dy: -1 },
  { name: 'down-left', dx: -1, dy: 1 },
  { name: 'down-right', dx: 1, dy: 1 },
]);

// טבלת חיפוש מלאה לפי שם כיוון (משמשת גם ברינדור/משחק)
const DIRECTIONS = DIRECTIONS8;

function cellKey(x, y) {
  return x + ',' + y;
}

// בודק אם הקרן מ-(x,y) בכיוון dir חופשית: מותר לעבור רק דרך תאים
// שאינם ב-blockingSet (או שיצאו מהצורה/מהגריד). blockingSet יכול להיות
// Set רגיל, או כל אובייקט עם has(key) — משמש כדי להחריג בקלות את תאי החלק עצמו.
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

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

// מפצל את תאי הצורה ל"חלקים" — הליכות אקראיות של תאים סמוכים (אורתוגונלית),
// כדי לקבל גם חלקים ישרים/קצרים וגם חלקים מפותלים עם פניות (כמו במשחק המקור)
function generatePieces(cols, rows, shapeMask, rng, maxLen, continueProb) {
  const unassigned = new Set();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (shapeMask[y][x]) unassigned.add(cellKey(x, y));
    }
  }

  const order = Array.from(unassigned);
  shuffleInPlace(order, rng);

  const pieces = [];
  for (const startKey of order) {
    if (!unassigned.has(startKey)) continue;
    const [sx, sy] = startKey.split(',').map(Number);
    const path = [{ x: sx, y: sy }];
    unassigned.delete(startKey);

    while (path.length < maxLen && rng() < continueProb) {
      const last = path[path.length - 1];
      const options = [];
      for (const d of DIRECTIONS4) {
        const nx = last.x + d.dx;
        const ny = last.y + d.dy;
        const k = cellKey(nx, ny);
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && shapeMask[ny][nx] && unassigned.has(k)) {
          options.push({ x: nx, y: ny, key: k });
        }
      }
      if (options.length === 0) break;
      const next = rngPick(rng, options);
      path.push({ x: next.x, y: next.y });
      unassigned.delete(next.key);
    }

    pieces.push({ cells: path });
  }
  return pieces;
}

function difficultyBiasForLevel(level) {
  // עולה חד בשלבים הראשונים כדי שכבר סביב שלב 10 יהיה כמעט תמיד רק המהלך
  // המחויב/המוגבל ביותר זמין (מקסימום תלות-סדר), ואז נשאר קרוב לתקרה
  const t = Math.min(1, Math.sqrt(level / 8));
  return Math.min(0.97, 0.5 + 0.47 * t);
}

// אורך מקסימלי לחלק (1 = חץ בודד כמו בעבר, עד 5 = חלק ארוך ומפותל)
function pieceMaxLenForLevel(level) {
  return Math.min(5, Math.max(1, 1 + Math.floor(level / 8)));
}

// מאיזה שלב מתחילים להופיע גם כיווני יציאה באלכסון, בנוסף לישרים
function allowedDirectionsForLevel(level) {
  return level < 7 ? DIRECTIONS4 : DIRECTIONS8;
}

function generateLevel(level, cols, rows, shapeMask) {
  const rng = createRng(hashSeed('lvl-' + level));
  const maxLen = pieceMaxLenForLevel(level);
  const continueProb = 0.55;
  const allowedDirs = allowedDirectionsForLevel(level);
  const bias = difficultyBiasForLevel(level);

  const pieces = generatePieces(cols, rows, shapeMask, rng, maxLen, continueProb);
  pieces.forEach((p) => {
    p.keySet = new Set(p.cells.map((c) => cellKey(c.x, c.y)));
  });

  const remainingCells = new Set();
  pieces.forEach((p) => p.keySet.forEach((k) => remainingCells.add(k)));
  const remainingPieceIdx = new Set(pieces.map((_, i) => i));

  while (remainingPieceIdx.size > 0) {
    const candidates = [];
    for (const idx of remainingPieceIdx) {
      const piece = pieces[idx];
      const head = piece.cells[piece.cells.length - 1];
      const blockingView = { has: (k) => remainingCells.has(k) && !piece.keySet.has(k) };
      const validDirs = [];
      for (const dir of allowedDirs) {
        if (isRayClear(head.x, head.y, dir, shapeMask, cols, rows, blockingView)) validDirs.push(dir);
      }
      if (validDirs.length > 0) candidates.push({ idx, validDirs });
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
    pieces[chosen.idx].exitDir = dir.name;
    for (const k of pieces[chosen.idx].keySet) remainingCells.delete(k);
    remainingPieceIdx.delete(chosen.idx);
  }

  const cellToPieceIndex = {};
  let totalCells = 0;
  pieces.forEach((p, idx) => {
    p.cells.forEach((c) => {
      cellToPieceIndex[cellKey(c.x, c.y)] = idx;
    });
    totalCells += p.cells.length;
  });

  return { level, cols, rows, shapeMask, pieces, cellToPieceIndex, totalCells };
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
