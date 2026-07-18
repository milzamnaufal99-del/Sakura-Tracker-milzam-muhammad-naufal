// ── STORAGE LAYER ──

const StorageService = {
  // ── Key helpers ──────────────────────────────────────────────

  _habitKey(dateKey) {
    return `st_habits_${dateKey}`;
  },

  // ── Internal safe read/write ──────────────────────────────────

  _read(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('StorageError', { detail: { error } }));
    }
  },

  // ── Habits ───────────────────────────────────────────────────

  /**
   * Get the HabitDayRecord for a given date key.
   * @param {string} dateKey  "YYYY-MM-DD"
   * @returns {HabitDayRecord|null}
   */
  getHabits(dateKey) {
    return this._read(this._habitKey(dateKey));
  },

  /**
   * Persist a HabitDayRecord for the given date key.
   * @param {string} dateKey  "YYYY-MM-DD"
   * @param {object} record   HabitDayRecord
   */
  setHabits(dateKey, record) {
    this._write(this._habitKey(dateKey), record);
  },

  /**
   * Return all stored HabitDayRecords keyed by date string.
   * @returns {{ [dateKey: string]: object }}
   */
  getAllHabitDays() {
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('st_habits_')) {
        const dateKey = key.slice('st_habits_'.length);
        const record = this._read(key);
        if (record !== null) {
          result[dateKey] = record;
        }
      }
    }
    return result;
  },

  // ── Japanese ─────────────────────────────────────────────────

  /**
   * Get the stored JapaneseRecord.
   * @returns {object|null}  JapaneseRecord | null
   */
  getJapanese() {
    return this._read('st_japanese');
  },

  /**
   * Persist the JapaneseRecord.
   * @param {object} record  JapaneseRecord
   */
  setJapanese(record) {
    this._write('st_japanese', record);
  },

  // ── Running ──────────────────────────────────────────────────

  /**
   * Get all stored running sessions.
   * @returns {object[]}  RunningSession[]
   */
  getRunning() {
    const data = this._read('st_running');
    if (!Array.isArray(data)) return [];
    return data;
  },

  /**
   * Append a single RunningSession to the persisted array.
   * @param {object} session  RunningSession
   */
  addRunningSession(session) {
    const sessions = this.getRunning();
    sessions.push(session);
    this._write('st_running', sessions);
  },

  // ── Investment ───────────────────────────────────────────────

  /**
   * Get the stored InvestmentRecord.
   * @returns {object|null}  InvestmentRecord | null
   */
  getInvestment() {
    return this._read('st_investment');
  },

  /**
   * Persist the InvestmentRecord.
   * @param {object} record  InvestmentRecord
   */
  setInvestment(record) {
    this._write('st_investment', record);
  },

  // ── Utility ──────────────────────────────────────────────────

  /**
   * Remove every key with the "st_" prefix from localStorage.
   * Leaves any non-Sakura keys untouched.
   */
  clear() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('st_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  },

  /**
   * Called on DOMContentLoaded. Can be used for data migration or
   * validation of stored records. Currently a no-op.
   */
  init() {
    // No-op — extend here for future schema migrations.
  },
};

// ── UTILITY FUNCTIONS ──

/**
 * Convert a Date object to a "YYYY-MM-DD" string using UTC date components.
 * @param {Date} date
 * @returns {string}  "YYYY-MM-DD"
 */
function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Return the integer completion percentage for a single day's habit record.
 * Result is Math.floor((checkedCount / 10) * 100), always in [0, 100].
 * @param {object|null} record  HabitDayRecord — null/undefined treated as 0 checked
 * @returns {number}  Integer in [0, 100]
 */
function habitPercent(record) {
  if (!record || !record.habits) return 0;
  const checked = Object.values(record.habits).filter(Boolean).length;
  return Math.floor((checked / 10) * 100);
}

/**
 * Return the integer progress percentage of value relative to total,
 * clamped to [0, 100]. Returns 0 when total <= 0 to avoid division by zero.
 * @param {number} value
 * @param {number} total
 * @returns {number}  Integer in [0, 100]
 */
function progressPercent(value, total) {
  if (!total || total <= 0) return 0;
  return Math.min(Math.floor((value / total) * 100), 100);
}

/**
 * Alias of progressPercent — same semantics, named for call-site clarity.
 * Returns Math.min(Math.floor((numerator / denominator) * 100), 100),
 * or 0 when denominator <= 0.
 * @param {number} numerator
 * @param {number} denominator
 * @returns {number}  Integer in [0, 100]
 */
function safePercent(numerator, denominator) {
  return progressPercent(numerator, denominator);
}

/**
 * Return a "YYYY-MM-DD" string that is `n` calendar days before `dateKey`.
 * Uses UTC date arithmetic to avoid DST edge cases.
 * @param {string} dateKey  "YYYY-MM-DD"
 * @param {number} n        Integer >= 0
 * @returns {string}  "YYYY-MM-DD"
 */
function subtractDays(dateKey, n) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the current Streak: the number of consecutive fully-completed past
 * calendar days walking backward from yesterday. Today's record is never counted.
 * A "fully-completed" day is one where every habit value in the record is `true`.
 * Stops on the first missing day or the first incomplete day.
 * @param {{ [dateKey: string]: object }} allDays  All stored HabitDayRecord objects keyed by "YYYY-MM-DD"
 * @param {string} todayKey  "YYYY-MM-DD" — excluded from streak
 * @returns {number}  Non-negative integer
 */
function computeStreak(allDays, todayKey) {
  let streak = 0;
  let cursor = subtractDays(todayKey, 1); // start from yesterday
  while (true) {
    const record = allDays[cursor];
    if (!record) break;
    const completed = Object.values(record.habits).every(Boolean);
    if (!completed) break;
    streak++;
    cursor = subtractDays(cursor, 1);
  }
  return streak;
}

/**
 * Compute the total number of individual Habit completions across all stored days.
 * Counts every `true` boolean value in every record's `habits` object.
 * @param {{ [dateKey: string]: object }|null|undefined} allDays  All stored HabitDayRecord objects keyed by "YYYY-MM-DD"
 * @returns {number}  Non-negative integer
 */
function computeTotalCompletions(allDays) {
  if (!allDays) return 0;
  let total = 0;
  for (const record of Object.values(allDays)) {
    if (record && record.habits) {
      total += Object.values(record.habits).filter(Boolean).length;
    }
  }
  return total;
}

/**
 * Fixed totals for each Japanese writing system (read-only constants).
 * These values are never persisted — only the mastered count is stored.
 * Requirements: 6.2, 6.4
 */
const TOTALS = Object.freeze({
  hiragana: 46,
  katakana: 46,
  kanji: 2136,
});

/**
 * Clamp a raw mastered-character input to the valid range [0, TOTALS[script]].
 * Floors fractional values before clamping.
 * @param {string} script    One of "hiragana", "katakana", "kanji"
 * @param {number} rawInput  Any numeric value (may be negative, fractional, or above total)
 * @returns {number}  Integer in [0, TOTALS[script]]
 */
function clampMastered(script, rawInput) {
  const max = TOTALS[script];
  return Math.max(0, Math.min(max, Math.floor(rawInput)));
}

// ── DASHBOARD ──

/**
 * Format a Date object as "Day, DD Month YYYY" (e.g. "Monday, 01 January 2025").
 * Uses the local calendar date, not UTC, so the displayed day matches the user's clock.
 * @param {Date} date
 * @returns {string}  Formatted date string per Req 2.1
 */
function formatDate(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dayName = days[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const yyyy = date.getFullYear();
  return `${dayName}, ${dd} ${month} ${yyyy}`;
}

const DashboardModule = {
  /**
   * Render all four dashboard summary values by reading from LocalStorage.
   * Covers Req 2.1–2.7: date, streak, total completions, today's progress.
   * Falls back to zeros on empty or corrupted storage without throwing.
   */
  render() {
    const todayKey = toDateKey(new Date());
    let allDays = {};
    try {
      allDays = StorageService.getAllHabitDays() || {};
    } catch (e) {
      allDays = {};
    }

    // Compute the four values (all utility functions handle null/empty gracefully)
    const streak = computeStreak(allDays, todayKey);
    const total = computeTotalCompletions(allDays);
    const pct = habitPercent(allDays[todayKey]);
    const todayRecord = allDays[todayKey];
    const checkedCount = (todayRecord && todayRecord.habits)
      ? Object.values(todayRecord.habits).filter(Boolean).length
      : 0;
    const dateStr = formatDate(new Date());

    // Write to DOM
    const dateEl = document.getElementById('dashboard-date');
    if (dateEl) dateEl.textContent = dateStr;

    const streakEl = document.getElementById('dashboard-streak');
    if (streakEl) streakEl.textContent = streak;

    const totalEl = document.getElementById('dashboard-total');
    if (totalEl) totalEl.textContent = total;

    const pctEl = document.getElementById('dashboard-progress-pct');
    if (pctEl) pctEl.textContent = pct;

    const fractionEl = document.getElementById('dashboard-fraction');
    if (fractionEl) fractionEl.textContent = `${checkedCount} / 10`;

    const pctLabelEl = document.getElementById('dashboard-progress-pct-label');
    if (pctLabelEl) pctLabelEl.textContent = `${pct}%`;

    // Progress bar — scoped to the #dashboard section to avoid colliding with
    // the checklist's own progress bar
    const dashboardSection = document.getElementById('dashboard');
    if (dashboardSection) {
      const fillEl = dashboardSection.querySelector('.progress-bar__fill');
      if (fillEl) fillEl.style.width = `${pct}%`;

      const barEl = dashboardSection.querySelector('.progress-bar');
      if (barEl) barEl.setAttribute('aria-valuenow', pct);
    }
  },

  /**
   * Re-read today's HabitDayRecord and update only the progress percentage
   * and progress bar fill width. Called by ChecklistModule after each toggle.
   * Covers Req 4.1, 4.2.
   */
  updateProgress() {
    const todayKey = toDateKey(new Date());
    let todayRecord = null;
    try {
      todayRecord = StorageService.getHabits(todayKey);
    } catch (e) {
      todayRecord = null;
    }

    const pct = habitPercent(todayRecord);
    const checkedCount = (todayRecord && todayRecord.habits)
      ? Object.values(todayRecord.habits).filter(Boolean).length
      : 0;

    const pctEl = document.getElementById('dashboard-progress-pct');
    if (pctEl) pctEl.textContent = pct;

    const fractionEl = document.getElementById('dashboard-fraction');
    if (fractionEl) fractionEl.textContent = `${checkedCount} / 10`;

    const pctLabelEl = document.getElementById('dashboard-progress-pct-label');
    if (pctLabelEl) pctLabelEl.textContent = `${pct}%`;

    const dashboardSection = document.getElementById('dashboard');
    if (dashboardSection) {
      const fillEl = dashboardSection.querySelector('.progress-bar__fill');
      if (fillEl) fillEl.style.width = `${pct}%`;

      const barEl = dashboardSection.querySelector('.progress-bar');
      if (barEl) barEl.setAttribute('aria-valuenow', pct);
    }
  },
};

// ── DAILY CHECKLIST ──

/**
 * Canonical display names for the ten fixed daily Habits.
 * Order is fixed per Req 3.1 and must not be changed.
 */
const HABITS = Object.freeze([
  'Running',
  'Gym',
  'Push Up',
  'Sit Up',
  'Pull Up',
  'Japanese Study',
  'Shadowing',
  'Programming',
  'Reading',
  'Meditation',
]);

/**
 * LocalStorage / record keys corresponding to each Habit in HABITS.
 * Index i in HABIT_KEYS matches index i in HABITS.
 */
const HABIT_KEYS = Object.freeze([
  'running',
  'gym',
  'pushUp',
  'sitUp',
  'pullUp',
  'japaneseStudy',
  'shadowing',
  'programming',
  'reading',
  'meditation',
]);

const ChecklistModule = {
  /**
   * Render the ten habit <li> items into <ul id="habit-list">, restore checked
   * state from StorageService for today's date, and initialise the progress bar.
   *
   * Requirements: 3.1, 3.4, 3.5, 4.1, 4.4
   */
  render() {
    const todayKey = toDateKey(new Date());

    // Retrieve today's record (may be null if no data yet — covers Req 3.4 & 3.5)
    const record = StorageService.getHabits(todayKey);

    const listEl = document.getElementById('habit-list');
    if (!listEl) return;

    // Clear any previously rendered items
    listEl.innerHTML = '';

    // Build one <li> per habit in canonical order (Req 3.1)
    HABITS.forEach((habitName, idx) => {
      const key = HABIT_KEYS[idx];

      // Restore checked state; default to false when record is null or key absent (Req 3.4)
      const isChecked = record && record.habits ? Boolean(record.habits[key]) : false;

      const li = document.createElement('li');
      li.className = 'habit-item';

      const inputId = `habit-${key}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = inputId;
      checkbox.className = 'habit-item__checkbox';
      checkbox.checked = isChecked;
      checkbox.dataset.habitKey = key;

      const label = document.createElement('label');
      label.htmlFor = inputId;
      label.className = 'habit-item__label';
      label.textContent = habitName;

      li.appendChild(checkbox);
      li.appendChild(label);
      listEl.appendChild(li);

      // ── Checkbox change handler (Req 3.2, 3.3, 3.6, 4.2, 4.3) ──
      checkbox.addEventListener('change', () => {
        const currentKey = toDateKey(new Date());

        // 1. Read today's record or create an empty one (all habits default false)
        let dayRecord = StorageService.getHabits(currentKey);
        if (!dayRecord || !dayRecord.habits) {
          dayRecord = {
            date: currentKey,
            habits: {
              running: false,
              gym: false,
              pushUp: false,
              sitUp: false,
              pullUp: false,
              japaneseStudy: false,
              shadowing: false,
              programming: false,
              reading: false,
              meditation: false,
            },
          };
        }

        // 2. Toggle the boolean for this habit (checkbox.checked already reflects the new state)
        dayRecord.habits[key] = checkbox.checked;

        // 3. Write back; StorageError dispatched on window if quota exceeded
        let storageErrorOccurred = false;
        const onStorageError = () => { storageErrorOccurred = true; };
        window.addEventListener('StorageError', onStorageError, { once: true });
        StorageService.setHabits(currentKey, dayRecord);
        window.removeEventListener('StorageError', onStorageError);

        // 4. Update dashboard progress bar (< 300 ms — synchronous DOM update)
        DashboardModule.updateProgress();

        // 5. Update checklist progress bar synchronously (Req 4.2, 4.3)
        const newCheckedCount = Object.values(dayRecord.habits).filter(Boolean).length;
        ChecklistModule._updateProgressBar(newCheckedCount);

        // 6. If write failed, show error indicator without reverting UI (Req 3.6)
        if (storageErrorOccurred) {
          let errorEl = document.getElementById('checklist-storage-error');
          if (!errorEl) {
            errorEl = document.createElement('p');
            errorEl.id = 'checklist-storage-error';
            errorEl.className = 'checklist-error';
            errorEl.setAttribute('role', 'alert');
            errorEl.setAttribute('aria-live', 'polite');
            errorEl.textContent = 'Could not save changes — storage quota exceeded.';
            const checklistSection = document.getElementById('checklist');
            if (checklistSection) checklistSection.appendChild(errorEl);
          }
          errorEl.style.display = '';
        }
      });
    });

    // Calculate how many habits are currently checked from the restored record
    const checkedCount = record && record.habits
      ? Object.values(record.habits).filter(Boolean).length
      : 0;

    // Render initial progress bar state (Req 4.1, 4.4)
    this._updateProgressBar(checkedCount);
  },

  /**
   * Update the checklist's progress bar fill width and fraction label.
   * @param {number} checkedCount  Number of checked habits (0–10)
   */
  _updateProgressBar(checkedCount) {
    const pct = Math.floor((checkedCount / 10) * 100);

    // Fill bar: the HTML uses a container div + inner div pattern
    const fillEl = document.getElementById('checklist-progress-bar');
    if (fillEl) fillEl.style.width = `${pct}%`;

    // Fraction label: e.g. "3 / 10" (Req 4.3, 4.4)
    const labelEl = document.getElementById('checklist-progress-label');
    if (labelEl) labelEl.textContent = `${checkedCount} / 10`;

    // Percentage label: e.g. "30%"
    const pctEl = document.getElementById('checklist-progress-percent');
    if (pctEl) pctEl.textContent = `${pct}%`;
  },
};

// ── STATISTICS ──

/**
 * Build chart-ready data for the last 7 calendar days ending on `today`.
 * Day 0 = 6 days ago, Day 6 = today.
 * @param {{ [dateKey: string]: object }} allDays  All stored HabitDayRecord objects keyed by "YYYY-MM-DD"
 * @param {Date} [today]  Reference date (defaults to `new Date()`)
 * @returns {{ labels: string[], data: number[] }}
 *   labels — "YYYY-MM-DD" strings for each of the 7 days (ascending)
 *   data   — `habitPercent` value (0–100) for each day, 0 if no record stored
 * Requirements: 5.1, 5.5
 */
function buildWeeklyData(allDays, today) {
  const ref = today instanceof Date ? today : new Date();
  const todayKey = toDateKey(ref);
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const dateKey = subtractDays(todayKey, i);
    labels.push(dateKey);
    data.push(habitPercent(allDays[dateKey] || null));
  }
  return { labels, data };
}

/**
 * Build chart-ready data for every calendar day of the current month.
 * @param {{ [dateKey: string]: object }} allDays  All stored HabitDayRecord objects keyed by "YYYY-MM-DD"
 * @returns {{ labels: string[], data: number[] }}
 *   labels — "YYYY-MM-DD" strings for each day of the current month (ascending)
 *   data   — `habitPercent` value (0–100) for each day, 0 if no record stored
 * Requirements: 5.2, 5.5
 */
function buildMonthlyData(allDays) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const labels = [];
  const data = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10);
    labels.push(dateKey);
    data.push(habitPercent(allDays[dateKey] || null));
  }
  return { labels, data };
}

/**
 * Build chart-ready data for habit consistency across all stored days.
 * Returns exactly 10 entries — one per habit in canonical order (matching HABITS / HABIT_KEYS).
 * Each value = Math.floor((daysHabitWasChecked / totalDays) * 100), or 0 if no days stored.
 * @param {{ [dateKey: string]: object }} allDays  All stored HabitDayRecord objects keyed by "YYYY-MM-DD"
 * @returns {{ labels: string[], data: number[] }}
 *   labels — the 10 habit display names in canonical order
 *   data   — consistency percentage (0–100) for each habit
 * Requirements: 5.3, 5.5
 */
function buildHabitData(allDays) {
  const totalDays = Object.keys(allDays).length;
  const labels = HABITS.slice(); // canonical display names
  const data = HABIT_KEYS.map(key => {
    if (totalDays === 0) return 0;
    let daysChecked = 0;
    for (const record of Object.values(allDays)) {
      if (record && record.habits && record.habits[key] === true) {
        daysChecked++;
      }
    }
    return Math.floor((daysChecked / totalDays) * 100);
  });
  return { labels, data };
}

/**
 * Manages Chart.js instances, keyed by canvas ID.
 * Destroys the existing instance before recreating to prevent
 * "Canvas already in use" errors on re-visits (Req 5.4, 5.6).
 */
const ChartRenderer = {
  /** @type {{ [canvasId: string]: Chart }} */
  charts: {},

  /**
   * Create (or replace) a Chart.js chart on the given canvas.
   * Guards against Chart.js not being loaded and shows a fallback message.
   * @param {string} canvasId  ID of the <canvas> element
   * @param {object} config    Chart.js configuration object
   * @returns {Chart|null}  The new Chart instance, or null if Chart.js unavailable
   */
  create(canvasId, config) {
    // Guard: Chart.js must be loaded (CDN may fail) — Req error-handling
    if (typeof Chart === 'undefined') {
      const canvas = document.getElementById(canvasId);
      if (canvas) {
        const container = canvas.parentElement || canvas;
        // Avoid duplicate fallback messages
        if (!container.querySelector('.charts-unavailable')) {
          const msg = document.createElement('p');
          msg.className = 'charts-unavailable';
          msg.textContent = 'Charts unavailable';
          container.insertBefore(msg, canvas);
        }
      }
      return null;
    }

    // Destroy the existing instance to prevent "Canvas already in use"
    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
      delete this.charts[canvasId];
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const chart = new Chart(canvas, config);
    this.charts[canvasId] = chart;
    return chart;
  },
};

/**
 * Reads all stored habit days and renders the three statistics charts:
 *   - Weekly bar chart (last 7 calendar days, completion %)
 *   - Monthly bar chart (all days of current month, completion %)
 *   - Habit consistency bar chart (10 habits, avg completion %)
 *
 * Called each time the Statistics section is opened (Req 5.4, 5.6).
 * Passes through ChartRenderer which handles destroy-before-recreate and
 * the "Charts unavailable" fallback when Chart.js is not loaded.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.6
 */
const StatisticsModule = {
  renderCharts() {
    const allDays = StorageService.getAllHabitDays();

    // ── Weekly chart (Req 5.1) ──
    const weekly = buildWeeklyData(allDays);
    ChartRenderer.create('weekly-chart', {
      type: 'bar',
      data: {
        labels: weekly.labels,
        datasets: [{
          label: 'Completion %',
          data: weekly.data,
          backgroundColor: 'rgba(255, 182, 193, 0.7)',
          borderColor: 'rgba(255, 105, 135, 1)',
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: value => `${value}%` },
          },
        },
      },
    });

    // ── Monthly chart (Req 5.2) ──
    const monthly = buildMonthlyData(allDays);
    ChartRenderer.create('monthly-chart', {
      type: 'bar',
      data: {
        labels: monthly.labels,
        datasets: [{
          label: 'Completion %',
          data: monthly.data,
          backgroundColor: 'rgba(255, 182, 193, 0.7)',
          borderColor: 'rgba(255, 105, 135, 1)',
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: value => `${value}%` },
          },
        },
      },
    });

    // ── Habit consistency chart (Req 5.3) ──
    const habit = buildHabitData(allDays);
    ChartRenderer.create('habit-chart', {
      type: 'bar',
      data: {
        labels: habit.labels,
        datasets: [{
          label: 'Consistency %',
          data: habit.data,
          backgroundColor: 'rgba(216, 160, 185, 0.7)',
          borderColor: 'rgba(180, 80, 130, 1)',
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: value => `${value}%` },
          },
        },
      },
    });
  },
};

// ── JAPANESE PROGRESS ──

const JapaneseModule = {
  /**
   * Read the stored JapaneseRecord (falling back to all-zeros on null or corrupt data),
   * clamp each mastered value to its valid range, and update the three progress cards
   * (hiragana, katakana, kanji) in the DOM.
   *
   * For each script:
   *   - Sets input#${script}-input .value   to the clamped mastered count
   *   - Sets .progress-bar__fill width      to `${pct}%`
   *   - Sets .progress-bar aria-valuenow    to pct
   *   - Sets .japanese-card__pct text       to `${pct}%`
   *
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.7
   */
  render() {
    // 1. Read from storage; fall back to { hiragana: 0, katakana: 0, kanji: 0 } on null/corrupt
    const stored = StorageService.getJapanese();
    const DEFAULT = { hiragana: 0, katakana: 0, kanji: 0 };
    const record = (stored && typeof stored === 'object') ? stored : DEFAULT;

    // 2. Update each script's card
    ['hiragana', 'katakana', 'kanji'].forEach(script => {
      // Guard against corrupt / non-numeric values before passing to clampMastered
      const raw = (typeof record[script] === 'number' && isFinite(record[script]))
        ? record[script]
        : 0;

      const clamped = clampMastered(script, raw);
      const pct = safePercent(clamped, TOTALS[script]);

      const card = document.getElementById(`${script}-card`);
      if (!card) return;

      // a/b. Set input value
      const inputEl = card.querySelector(`#${script}-input`);
      if (inputEl) inputEl.value = clamped;

      // c/d. Set progress bar fill width
      const fillEl = card.querySelector('.progress-bar__fill');
      if (fillEl) fillEl.style.width = `${pct}%`;

      // e. Set progress bar aria-valuenow
      const barEl = card.querySelector('.progress-bar');
      if (barEl) barEl.setAttribute('aria-valuenow', pct);

      // f. Set percentage label text
      const pctEl = card.querySelector('.japanese-card__pct');
      if (pctEl) pctEl.textContent = `${pct}%`;
    });
  },

  /**
   * Wire `input` event listeners on all three mastered-count fields
   * (#hiragana-input, #katakana-input, #kanji-input).
   *
   * On each input event:
   *   1. Clamp the raw value via clampMastered(script, rawValue).
   *   2. Set input.value = clamped (so the browser reflects the clamped value).
   *   3. Compute pct = safePercent(clamped, TOTALS[script]).
   *   4. Update the card's .progress-bar__fill width to `${pct}%`.
   *   5. Update the card's .progress-bar aria-valuenow to pct.
   *   6. Update the card's .japanese-card__pct text to `${pct}%`.
   *   7. Read current values for all three scripts and persist via
   *      StorageService.setJapanese({ hiragana, katakana, kanji }).
   *
   * All operations are synchronous — well within 100 ms (Req 6.5).
   *
   * Requirements: 6.2, 6.4, 6.5, 6.6
   */
  initHandlers() {
    ['hiragana', 'katakana', 'kanji'].forEach(script => {
      const inputEl = document.getElementById(`${script}-input`);
      if (!inputEl) return;

      inputEl.addEventListener('input', () => {
        const card = document.getElementById(`${script}-card`);
        if (!card) return;

        // 1 & 2. Clamp the raw value and reflect it in the input field
        const raw = parseFloat(inputEl.value);
        const clamped = clampMastered(script, isFinite(raw) ? raw : 0);
        inputEl.value = clamped;

        // 3. Compute percentage
        const pct = safePercent(clamped, TOTALS[script]);

        // 4. Update progress bar fill width
        const fillEl = card.querySelector('.progress-bar__fill');
        if (fillEl) fillEl.style.width = `${pct}%`;

        // 5. Update progress bar aria attribute
        const barEl = card.querySelector('.progress-bar');
        if (barEl) barEl.setAttribute('aria-valuenow', pct);

        // 6. Update percentage label
        const pctEl = card.querySelector('.japanese-card__pct');
        if (pctEl) pctEl.textContent = `${pct}%`;

        // 7. Persist all three values atomically so the record stays consistent
        const hiraganaInput = document.getElementById('hiragana-input');
        const katakanaInput = document.getElementById('katakana-input');
        const kanjiInput = document.getElementById('kanji-input');

        const hiraganaRaw = hiraganaInput ? parseFloat(hiraganaInput.value) : 0;
        const katakanaRaw = katakanaInput ? parseFloat(katakanaInput.value) : 0;
        const kanjiRaw = kanjiInput ? parseFloat(kanjiInput.value) : 0;

        StorageService.setJapanese({
          hiragana: clampMastered('hiragana', isFinite(hiraganaRaw) ? hiraganaRaw : 0),
          katakana: clampMastered('katakana', isFinite(katakanaRaw) ? katakanaRaw : 0),
          kanji: clampMastered('kanji', isFinite(kanjiRaw) ? kanjiRaw : 0),
        });
      });
    });
  },
};

// ── RUNNING PROGRESS ──

/**
 * Validate that a value represents a finite number strictly greater than 0.
 * Returns false for empty string, null, undefined, non-numeric strings, NaN,
 * Infinity, -Infinity, 0, and negative numbers.
 * Returns true only for finite numbers where n > 0.
 *
 * Used by RunningModule (distance, time validation) and InvestmentModule
 * (monthlyTarget, goal validation).
 *
 * @param {*} value  Any value to validate
 * @returns {boolean}
 * Requirements: 7.5, 8.1
 */
function validatePositiveNumber(value) {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

/**
 * Create a new RunningSession object from the provided inputs.
 * Computes pace as time / distance (minutes per unit distance).
 * Does NOT mutate the input — always returns a fresh object.
 * @param {{ distance: number, time: number, date: string }} param0
 *   distance — positive number (km, miles, etc.)
 *   time     — positive number (minutes)
 *   date     — "YYYY-MM-DD" ISO date string
 * @returns {{ date: string, distance: number, time: number, pace: number }}
 * Requirements: 7.2
 */
function buildRunningSession({ distance, time, date }) {
  return {
    date,
    distance,
    time,
    pace: time / distance,
  };
}

/**
 * Convert an array of RunningSession objects into chart-ready data sorted
 * ascending by date. Does NOT mutate the input array.
 * @param {Array<{ date: string, distance: number, time: number, pace: number }>} sessions
 * @returns {{ labels: string[], data: number[] }}
 *   labels — sorted ISO date strings (ascending)
 *   data   — corresponding pace values in the same order
 * Requirements: 7.3
 */
function buildRunningChartData(sessions) {
  const sorted = sessions.slice().sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );
  return {
    labels: sorted.map(s => s.date),
    data: sorted.map(s => s.pace),
  };
}

const RunningModule = {
  /**
   * Restore running sessions from StorageService and render the appropriate
   * state into the Running Progress section.
   *
   * - If no sessions exist in LocalStorage, hides the chart canvas and shows
   *   the empty-state placeholder element (#running-empty).
   * - If sessions exist, hides the placeholder and delegates to renderChart()
   *   to render the pace line chart.
   *
   * Requirements: 7.6
   */
  render() {
    const sessions = StorageService.getRunning();

    const emptyEl = document.getElementById('running-empty');
    const chartContainer = document.querySelector('#running .chart-container');

    if (sessions.length === 0) {
      // Show placeholder, hide chart container
      if (emptyEl) emptyEl.style.display = '';
      if (chartContainer) chartContainer.style.display = 'none';
    } else {
      // Hide placeholder, show chart container and render chart
      if (emptyEl) emptyEl.style.display = 'none';
      if (chartContainer) chartContainer.style.display = '';
      this.renderChart(sessions);
    }
  },

  /**
   * Render the pace-improvement line chart using all stored running sessions.
   * Sorts sessions ascending by date and plots pace (min/km) on the y-axis.
   * When called without arguments, reads sessions from StorageService.
   *
   * Requirements: 7.3, 7.4
   * @param {Array<{ date: string, distance: number, time: number, pace: number }>} [sessions]
   */
  renderChart(sessions) {
    const data = sessions !== undefined ? sessions : StorageService.getRunning();
    const chartData = buildRunningChartData(data);
    ChartRenderer.create('running-chart', {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [{
          label: 'Pace (min/km)',
          data: chartData.data,
          borderColor: 'rgba(255, 105, 135, 1)',
          backgroundColor: 'rgba(255, 182, 193, 0.2)',
          pointBackgroundColor: 'rgba(255, 105, 135, 1)',
          tension: 0.3,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
          title: { display: false },
        },
        scales: {
          x: {
            title: { display: true, text: 'Date' },
          },
          y: {
            beginAtZero: false,
            title: { display: true, text: 'Pace (min/km)' },
            ticks: { callback: value => `${value} min/km` },
          },
        },
      },
    });
  },

  /**
   * Wire the #running-form submit handler.
   *
   * On each submit:
   *   1. Clear any existing field-error content from previous submit attempts.
   *   2. Validate distance and time via validatePositiveNumber().
   *      - If either is invalid, inject a <span class="field-error"> message
   *        adjacent to the offending input and abort (do NOT save).
   *   3. On success:
   *      a. Build a RunningSession via buildRunningSession({ distance, time, date }).
   *      b. Persist via StorageService.addRunningSession(session).
   *      c. Show chart container, hide empty-state placeholder.
   *      d. Call RunningModule.renderChart() — all within 500 ms (synchronous).
   *      e. Reset distance and time fields; reset date to today.
   *
   * Requirements: 7.1, 7.2, 7.4, 7.5
   */
  initForm() {
    const form = document.getElementById('running-form');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const distanceInput = document.getElementById('running-distance');
      const timeInput = document.getElementById('running-time');
      const dateInput = document.getElementById('running-date');

      // 1. Clear any existing inline field-error spans from previous submits (Req 7.5)
      const existingErrors = form.querySelectorAll('span.field-error[data-dynamic]');
      existingErrors.forEach(el => el.remove());

      // Also clear the static error spans already in the HTML
      const staticDistanceError = document.getElementById('running-distance-error');
      const staticTimeError = document.getElementById('running-time-error');
      if (staticDistanceError) staticDistanceError.textContent = '';
      if (staticTimeError) staticTimeError.textContent = '';

      // 2. Validate fields
      const distanceVal = distanceInput ? distanceInput.value : '';
      const timeVal = timeInput ? timeInput.value : '';
      let hasError = false;

      if (!validatePositiveNumber(distanceVal)) {
        // Show inline error adjacent to the distance field (Req 7.5)
        if (staticDistanceError) {
          staticDistanceError.textContent = 'Distance must be a positive number.';
        } else if (distanceInput) {
          const errSpan = document.createElement('span');
          errSpan.className = 'field-error';
          errSpan.dataset.dynamic = 'true';
          errSpan.setAttribute('role', 'alert');
          errSpan.setAttribute('aria-live', 'polite');
          errSpan.textContent = 'Distance must be a positive number.';
          distanceInput.insertAdjacentElement('afterend', errSpan);
        }
        hasError = true;
      }

      if (!validatePositiveNumber(timeVal)) {
        // Show inline error adjacent to the time field (Req 7.5)
        if (staticTimeError) {
          staticTimeError.textContent = 'Time must be a positive number.';
        } else if (timeInput) {
          const errSpan = document.createElement('span');
          errSpan.className = 'field-error';
          errSpan.dataset.dynamic = 'true';
          errSpan.setAttribute('role', 'alert');
          errSpan.setAttribute('aria-live', 'polite');
          errSpan.textContent = 'Time must be a positive number.';
          timeInput.insertAdjacentElement('afterend', errSpan);
        }
        hasError = true;
      }

      // Abort on validation failure — do NOT save to storage (Req 7.5)
      if (hasError) return;

      // 3. Build and persist the session (Req 7.2)
      const distance = Number(distanceVal);
      const time = Number(timeVal);
      const date = (dateInput && dateInput.value) ? dateInput.value : toDateKey(new Date());

      const session = buildRunningSession({ distance, time, date });
      StorageService.addRunningSession(session);

      // 4. Update UI: show chart, hide empty-state, re-render chart (Req 7.4 — within 500 ms)
      const emptyEl = document.getElementById('running-empty');
      const chartContainer = document.querySelector('#running .chart-container');
      if (emptyEl) emptyEl.style.display = 'none';
      if (chartContainer) chartContainer.style.display = '';

      RunningModule.renderChart(); // reads fresh sessions from storage

      // 5. Reset form fields after a successful save
      if (distanceInput) distanceInput.value = '';
      if (timeInput) timeInput.value = '';
      if (dateInput) dateInput.value = toDateKey(new Date()); // reset to today
    });
  },
};

// ── INVESTMENT PROGRESS ──

const InvestmentModule = {
  /**
   * Shared helper: given the three numeric values, recompute all derived
   * display values and update the Investment section DOM.
   *
   * - Progress bar fill: safePercent(current, goal) %
   * - Monthly %: Math.min(100, Math.floor(current / monthlyTarget * 100))
   *              (0 when monthlyTarget === 0)
   * - "Goal Reached" indicator: visible when current >= goal && goal > 0
   *
   * @param {number} current
   * @param {number} monthlyTarget
   * @param {number} goal
   * Requirements: 8.2, 8.3, 8.6
   */
  _updateDisplay(current, monthlyTarget, goal) {
    // Progress bar fill — safePercent handles goal === 0 → returns 0 (Req 8.2)
    const progressPct = safePercent(current, goal);

    const fillEl = document.getElementById('investment-progress-fill');
    if (fillEl) fillEl.style.width = `${progressPct}%`;

    const barEl = document.querySelector('#investment .progress-bar');
    if (barEl) barEl.setAttribute('aria-valuenow', progressPct);

    const progressLabelEl = document.getElementById('investment-progress-label');
    if (progressLabelEl) progressLabelEl.textContent = `${progressPct}%`;

    // Monthly target % — capped at 100, 0 when monthlyTarget is 0 (Req 8.3)
    const monthlyPct = monthlyTarget > 0
      ? Math.min(100, Math.floor(current / monthlyTarget * 100))
      : 0;

    const monthlyPctEl = document.getElementById('investment-monthly-pct');
    if (monthlyPctEl) monthlyPctEl.textContent = `${monthlyPct}%`;

    // "Goal Reached" indicator (Req 8.6)
    const goalReachedEl = document.getElementById('investment-goal-reached');
    if (goalReachedEl) {
      goalReachedEl.style.display = (current >= goal && goal > 0) ? '' : 'none';
    }
  },

  /**
   * Restore the InvestmentRecord from StorageService, populate the three
   * input fields, and render the progress bar, monthly %, and "Goal Reached"
   * indicator.
   *
   * Falls back to { current: 0, monthlyTarget: 0, goal: 0 } when no record
   * is stored or the stored value is corrupt (Req 8.5).
   *
   * Requirements: 8.2, 8.3, 8.5, 8.6
   */
  render() {
    // 1. Load stored record, default to zeros on null / corrupt (Req 8.5)
    const DEFAULT = { current: 0, monthlyTarget: 0, goal: 0 };
    const stored = StorageService.getInvestment();
    const record = (stored && typeof stored === 'object') ? stored : DEFAULT;

    const current = (typeof record.current === 'number' && isFinite(record.current) && record.current >= 0)
      ? record.current : 0;
    const monthlyTarget = (typeof record.monthlyTarget === 'number' && isFinite(record.monthlyTarget))
      ? record.monthlyTarget : 0;
    const goal = (typeof record.goal === 'number' && isFinite(record.goal))
      ? record.goal : 0;

    // 2. Populate input fields
    const currentInput = document.getElementById('investment-current');
    if (currentInput) currentInput.value = current;

    const monthlyTargetInput = document.getElementById('investment-monthly-target');
    if (monthlyTargetInput) monthlyTargetInput.value = monthlyTarget;

    const goalInput = document.getElementById('investment-goal');
    if (goalInput) goalInput.value = goal;

    // 3. Render progress bar, monthly %, goal reached (Req 8.2, 8.3, 8.6)
    this._updateDisplay(current, monthlyTarget, goal);
  },

  /**
   * Wire `input` event listeners on all three Investment fields.
   *
   * On each change:
   *   - Parse all three field values.
   *   - Validate: current >= 0 (parseFloat check), monthlyTarget > 0 and
   *     goal > 0 (validatePositiveNumber).
   *   - If any field is invalid: show inline <span class="field-error"> text
   *     and skip StorageService.setInvestment.
   *   - If all valid: clear all error spans, update DOM via _updateDisplay,
   *     persist via StorageService.setInvestment.
   *   - On StorageError event (quota exceeded): show error indicator without
   *     reverting the UI (Req 8.4).
   *
   * All DOM updates complete synchronously — well within 300 ms (Req 8.1).
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.6
   */
  initHandlers() {
    const currentInput = document.getElementById('investment-current');
    const monthlyTargetInput = document.getElementById('investment-monthly-target');
    const goalInput = document.getElementById('investment-goal');

    if (!currentInput || !monthlyTargetInput || !goalInput) return;

    const currentErrorEl = document.getElementById('investment-current-error');
    const monthlyTargetErrorEl = document.getElementById('investment-monthly-target-error');
    const goalErrorEl = document.getElementById('investment-goal-error');

    /**
     * Read, validate, and either update-display-and-persist or show errors.
     * @private
     */
    const handleChange = () => {
      const currentVal = currentInput.value;
      const monthlyTargetVal = monthlyTargetInput.value;
      const goalVal = goalInput.value;

      // ── Validate ──
      let hasError = false;

      // current: non-negative (0 is allowed; validatePositiveNumber would reject 0)
      const currentNum = parseFloat(currentVal);
      const currentValid = currentVal !== '' && Number.isFinite(currentNum) && currentNum >= 0;
      if (!currentValid) {
        if (currentErrorEl) currentErrorEl.textContent = 'Current investment must be 0 or greater.';
        hasError = true;
      } else {
        if (currentErrorEl) currentErrorEl.textContent = '';
      }

      // monthlyTarget: strictly positive
      const monthlyTargetValid = validatePositiveNumber(monthlyTargetVal);
      if (!monthlyTargetValid) {
        if (monthlyTargetErrorEl) monthlyTargetErrorEl.textContent = 'Monthly target must be a positive number.';
        hasError = true;
      } else {
        if (monthlyTargetErrorEl) monthlyTargetErrorEl.textContent = '';
      }

      // goal: strictly positive
      const goalValid = validatePositiveNumber(goalVal);
      if (!goalValid) {
        if (goalErrorEl) goalErrorEl.textContent = 'Goal must be a positive number.';
        hasError = true;
      } else {
        if (goalErrorEl) goalErrorEl.textContent = '';
      }

      // ── Abort on any invalid field — do NOT persist (Req 8.1) ──
      if (hasError) return;

      // ── All valid: update DOM and persist ──
      const monthlyTarget = Number(monthlyTargetVal);
      const goal = Number(goalVal);

      InvestmentModule._updateDisplay(currentNum, monthlyTarget, goal);

      // Listen for StorageError before writing (Req 8.4)
      let storageErrorOccurred = false;
      const onStorageError = () => { storageErrorOccurred = true; };
      window.addEventListener('StorageError', onStorageError, { once: true });
      StorageService.setInvestment({ current: currentNum, monthlyTarget, goal });
      window.removeEventListener('StorageError', onStorageError);

      // If quota exceeded: surface an error indicator without reverting UI (Req 8.4)
      if (storageErrorOccurred) {
        let errorEl = document.getElementById('investment-storage-error');
        if (!errorEl) {
          errorEl = document.createElement('p');
          errorEl.id = 'investment-storage-error';
          errorEl.className = 'investment-error';
          errorEl.setAttribute('role', 'alert');
          errorEl.setAttribute('aria-live', 'polite');
          errorEl.textContent = 'Could not save changes — storage quota exceeded.';
          const investmentSection = document.getElementById('investment');
          if (investmentSection) investmentSection.appendChild(errorEl);
        }
        errorEl.style.display = '';
      }
    };

    currentInput.addEventListener('input', handleChange);
    monthlyTargetInput.addEventListener('input', handleChange);
    goalInput.addEventListener('input', handleChange);
  },
};

// ── NAVIGATION BAR ──

/**
 * Manages section visibility by toggling the `section--active` CSS class,
 * and triggers chart re-renders when the Statistics or Running section is opened.
 *
 * Requirements: 1.1, 5.4
 */
const NavigationBar = {
  /**
   * Attach click listeners to every `<button data-target="...">` inside `<nav>`.
   * On click:
   *   1. Remove `section--active` from every `<section>` inside `<main id="app">`.
   *   2. Add `section--active` to the section whose `id` matches `data-target`.
   *   3. If the target is `"statistics"`, call `StatisticsModule.renderCharts()`.
   *   4. If the target is `"running"`, call `RunningModule.renderChart()`.
   *
   * Requirements: 1.1, 5.4
   */
  bind() {
    const navItems = document.querySelectorAll('#navbar button[data-target]');
    const sections = document.querySelectorAll('#app section');

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        // 1. Hide every section
        sections.forEach(s => s.classList.remove('section--active'));

        // 2. Show the target section
        const targetId = item.dataset.target;
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.add('section--active');

        // 3. Re-render charts when navigating to chart-heavy sections (Req 5.4)
        if (targetId === 'statistics') StatisticsModule.renderCharts();
        if (targetId === 'running') RunningModule.renderChart();
      });
    });
  },
};

// ── INIT ──

// ── EXPORTS (test environment only) ──
// These export statements make pure utility functions available to vitest.
// index.html loads this file as type="module", so this is valid ESM in both
// the browser and the test runner. DOM-dependent module objects (DashboardModule,
// ChecklistModule, etc.) are intentionally NOT exported.
export {
  toDateKey,
  habitPercent,
  progressPercent,
  safePercent,
  subtractDays,
  computeStreak,
  computeTotalCompletions,
  clampMastered,
  buildRunningSession,
  buildRunningChartData,
  validatePositiveNumber,
  buildWeeklyData,
  buildMonthlyData,
  buildHabitData,
  formatDate,
  StorageService,
  TOTALS,
  HABITS,
  HABIT_KEYS,
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialise storage (migration / validation hook)
  StorageService.init();

  // 2. Render all module views from persisted state
  DashboardModule.render();
  ChecklistModule.render();
  JapaneseModule.render();
  JapaneseModule.initHandlers(); // Task 10.2 — wire input event handlers for mastered fields

  // 3. Set the running date input to today by default (Req 7.1), then render
  const runningDateInput = document.getElementById('running-date');
  if (runningDateInput && !runningDateInput.value) {
    runningDateInput.value = toDateKey(new Date());
  }
  RunningModule.initForm();
  RunningModule.render();

  // 4. Wire investment input handlers and render initial state
  InvestmentModule.initHandlers();
  InvestmentModule.render();

  // 5. Wire navigation — must come after all modules are initialised
  NavigationBar.bind();

  // 6. Activate the dashboard section by default (Req 1.1)
  //    (index.html already has class="section--active" on #dashboard, but we
  //    ensure it programmatically in case the HTML ever changes)
  const allSections = document.querySelectorAll('#app section');
  allSections.forEach(s => s.classList.remove('section--active'));
  const dashboardSection = document.getElementById('dashboard');
  if (dashboardSection) dashboardSection.classList.add('section--active');
});
