const STORAGE_KEY = 'arrow-escape-progress-v1';

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { highestUnlocked: 1, completed: {}, lastPlayedLevel: 1 };
    const parsed = JSON.parse(raw);
    if (!parsed.highestUnlocked) parsed.highestUnlocked = 1;
    if (!parsed.completed) parsed.completed = {};
    if (!parsed.lastPlayedLevel) parsed.lastPlayedLevel = 1;
    return parsed;
  } catch (e) {
    return { highestUnlocked: 1, completed: {}, lastPlayedLevel: 1 };
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    // localStorage לא זמין - מתעלמים בשקט, המשחק ימשיך לעבוד בלי שמירה
  }
}

function markLevelCompleted(level) {
  const progress = loadProgress();
  progress.completed[level] = true;
  if (level + 1 > progress.highestUnlocked) {
    progress.highestUnlocked = level + 1;
  }
  saveProgress(progress);
  return progress;
}

function isLevelUnlocked(level, progress) {
  return level <= progress.highestUnlocked;
}

function saveLastPlayedLevel(level) {
  const progress = loadProgress();
  progress.lastPlayedLevel = level;
  saveProgress(progress);
}
