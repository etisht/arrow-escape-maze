const LevelSelect = (function () {
  const TOTAL_LEVELS = 1000;
  const ROW_HEIGHT = 68;
  let container, sizer, content;
  let columns = 5;
  let progress = null;
  let onSelect = null;

  function init(containerEl, options) {
    container = containerEl;
    onSelect = options.onSelect;
    container.innerHTML = `
      <div class="level-scroll">
        <div class="level-sizer"></div>
        <div class="level-content"></div>
      </div>
    `;
    const scrollEl = container.querySelector('.level-scroll');
    sizer = container.querySelector('.level-sizer');
    content = container.querySelector('.level-content');
    scrollEl.addEventListener('scroll', () => renderVisible(scrollEl), { passive: true });
    window.addEventListener('resize', () => {
      computeColumns();
      renderVisible(scrollEl);
    });
    computeColumns();
    refresh();
    renderVisible(scrollEl);
  }

  function computeColumns() {
    const width = container.clientWidth;
    columns = Math.max(3, Math.min(7, Math.floor(width / 84)));
  }

  function refresh() {
    progress = loadProgress();
    const rows = Math.ceil(TOTAL_LEVELS / columns);
    sizer.style.height = rows * ROW_HEIGHT + 'px';
  }

  function renderVisible(scrollEl) {
    const scrollTop = scrollEl.scrollTop;
    const viewport = scrollEl.clientHeight;
    const rows = Math.ceil(TOTAL_LEVELS / columns);
    const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2);
    const lastRow = Math.min(rows - 1, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + 2);

    content.style.transform = `translateY(${firstRow * ROW_HEIGHT}px)`;
    content.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    content.innerHTML = '';

    for (let row = firstRow; row <= lastRow; row++) {
      for (let c = 0; c < columns; c++) {
        const level = row * columns + c + 1;
        if (level > TOTAL_LEVELS) continue;
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        const unlocked = isLevelUnlocked(level, progress);
        const completed = !!progress.completed[level];
        if (completed) btn.classList.add('completed');
        else if (!unlocked) btn.classList.add('locked');
        btn.textContent = unlocked ? String(level) : '🔒';
        btn.disabled = !unlocked;
        if (unlocked) {
          btn.addEventListener('click', () => onSelect(level));
        }
        content.appendChild(btn);
      }
    }
  }

  function show() {
    computeColumns();
    refresh();
    const scrollEl = container.querySelector('.level-scroll');
    renderVisible(scrollEl);
  }

  return { init, show, TOTAL_LEVELS };
})();
