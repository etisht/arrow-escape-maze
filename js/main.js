(function () {
  const viewLevels = document.getElementById('view-levels');
  const viewGame = document.getElementById('view-game');
  const winOverlay = document.getElementById('win-overlay');
  const levelLabel = document.getElementById('level-label');
  const progressLabel = document.getElementById('progress-label');
  const canvas = document.getElementById('game-canvas');

  let activeLevel = 1;

  function showLevels() {
    viewGame.classList.add('hidden');
    winOverlay.classList.add('hidden');
    viewLevels.classList.remove('hidden');
    LevelSelect.show();
  }

  function showGame(level) {
    activeLevel = level;
    saveLastPlayedLevel(level);
    viewLevels.classList.add('hidden');
    winOverlay.classList.add('hidden');
    viewGame.classList.remove('hidden');
    levelLabel.textContent = 'שלב ' + level;
    Game.loadLevel(level);
    updateProgressLabel();
  }

  function updateProgressLabel() {
    const remaining = Game.remainingCount();
    const total = Game.totalCount();
    progressLabel.textContent = `נותרו ${remaining} מתוך ${total} חצים`;
    if (remaining > 0) {
      requestAnimationFrame(updateProgressLabel);
    }
  }

  function handleWin(level) {
    markLevelCompleted(level);
    progressLabel.textContent = 'כל החצים שוחררו!';
    winOverlay.classList.remove('hidden');
  }

  LevelSelect.init(document.getElementById('level-select-container'), {
    onSelect: (level) => showGame(level),
  });

  Game.init(canvas, {
    onWin: handleWin,
  });

  document.getElementById('btn-back').addEventListener('click', showLevels);
  document.getElementById('btn-to-levels').addEventListener('click', showLevels);
  document.getElementById('btn-restart').addEventListener('click', () => showGame(activeLevel));
  document.getElementById('btn-next-level').addEventListener('click', () => {
    if (activeLevel < LevelSelect.TOTAL_LEVELS) {
      showGame(activeLevel + 1);
    } else {
      showLevels();
    }
  });

  window.addEventListener('resize', () => {
    if (!viewGame.classList.contains('hidden')) Game.resize();
  });

  const startProgress = loadProgress();
  showGame(startProgress.lastPlayedLevel);
})();
