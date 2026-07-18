# Design Document — Sakura Tracker

## Overview

Sakura Tracker is a single-page productivity web application delivered as three static files: `index.html`, `style.css`, and `script.js`. There are no build tools, no module bundlers, no server-side components. The only external dependency is Chart.js, loaded from a CDN. All user data is persisted in `window.localStorage`.

The application has six logical sections navigated via an in-page navigation bar:

1. **Dashboard** — date, streak, total completions, today's percentage
2. **Daily Checklist** — ten fixed habit checkboxes for today
3. **Statistics** — three Chart.js charts (weekly bar, monthly bar, habit-consistency bar)
4. **Japanese Progress** — Hiragana / Katakana / Kanji mastery cards
5. **Running Progress** — session log form + pace line chart
6. **Investment Progress** — current value / monthly target / goal tracker

Navigation works by toggling a CSS class (`section--active`) on `<section>` elements; there is no URL routing.

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Vanilla JS only | Requirement 10.5 — no frameworks |
| LocalStorage only | No backend, offline-first |
| Chart.js via CDN | Requirement 10.2 — no inlining |
| Section-show/hide navigation | Zero-dependency SPA pattern |
| Floor() for all percentages | Requirement 2.4, 3.3, 6.3, 8.2 — consistent truncation |
| Streak excludes today | Requirement 2.2 — in-progress day is not counted |

---

## Architecture

```
index.html
├── <link rel="stylesheet" href="style.css">
├── <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>  <!-- CDN -->
└── <script src="script.js" defer></script>

script.js  (single namespace, section comments required by Req 10.3)
├── // ── STORAGE LAYER ──────────────────────────────────────────
│   └── StorageService  (read / write / clear helpers for LocalStorage)
├── // ── DASHBOARD ──────────────────────────────────────────────
│   └── DashboardModule  (streak calc, total completions, today %)
├── // ── DAILY CHECKLIST ─────────────────────────────────────────
│   └── ChecklistModule  (render, toggle, persist)
├── // ── STATISTICS ──────────────────────────────────────────────
│   └── StatisticsModule  (build datasets, ChartRenderer wrapper)
├── // ── JAPANESE PROGRESS ───────────────────────────────────────
│   └── JapaneseModule  (card render, input handler, persist)
├── // ── RUNNING PROGRESS ────────────────────────────────────────
│   └── RunningModule  (form validation, pace calc, chart)
└── // ── INVESTMENT PROGRESS ─────────────────────────────────────
    └── InvestmentModule  (field validation, progress calc, persist)

style.css  (section comments required by Req 10.4)
├── /* Reset/Base */
├── /* Layout */
├── /* Navigation */
├── /* Dashboard */
├── /* Daily Checklist */
├── /* Statistics */
├── /* Japanese Progress */
├── /* Running Progress */
└── /* Investment Progress */
```

### Navigation Flow

```
DOMContentLoaded
    │
    ├── StorageService.init()
    │       └── migrate / validate stored data
    ├── DashboardModule.render()
    ├── ChecklistModule.render()
    ├── NavigationBar.bind()
    │       ├── click → hide all sections
    │       └── show target section
    │           ├── if Statistics → StatisticsModule.renderCharts()
    │           ├── if Running   → RunningModule.renderChart()
    │           └── other        → (already rendered)
    └── attach global event listeners
```

### Timing Constraints

| Interaction | Max latency | Mechanism |
|---|---|---|
| Progress_Bar after habit toggle | 300 ms | synchronous DOM update |
| Japanese card Progress_Bar | 100 ms | `input` event handler |
| Running chart after save | 500 ms | synchronous chart update |
| Investment recalculate | 300 ms | `input` / `change` event |

All updates are synchronous DOM mutations; none require async I/O, so timing constraints are met by design.

---

## Components and Interfaces

### StorageService

Central read/write façade around `window.localStorage`. All other modules communicate with LocalStorage only through this service.

```js
StorageService = {
  getHabits(dateKey)          // → HabitDayRecord | null
  setHabits(dateKey, record)  // → void (throws StorageError on quota fail)
  getAllHabitDays()            // → { [dateKey]: HabitDayRecord }
  getJapanese()               // → JapaneseRecord | null
  setJapanese(record)         // → void
  getRunning()                // → RunningSession[]
  addRunningSession(session)  // → void
  getInvestment()             // → InvestmentRecord | null
  setInvestment(record)       // → void
  clear()                     // → void (used in tests only)
}
```

All methods wrap `JSON.parse` / `JSON.stringify` in `try/catch` and return `null` (or empty array / default object) on parse failure, satisfying Requirements 2.7, 3.6 (error indicator), 6.7, 8.5.

### DashboardModule

Reads all habit days from StorageService and computes:

- **today's date string** → formatted via `Date` API
- **streak** → `computeStreak(allDays, todayKey)` pure function
- **total completions** → sum of checked habits across all days
- **today's progress** → `Math.floor((checkedToday / 10) * 100)`

### ChecklistModule

Owns the `<ul>` of ten habit items. Renders from a constant `HABITS` array. On checkbox `change`:
1. Read today's record from StorageService (or create empty)
2. Toggle the habit in the record
3. Write back to StorageService
4. Call `DashboardModule.updateProgress()` (updates progress bar + dashboard stats in < 300 ms)
5. If write throws StorageError → show error indicator, do NOT revert UI (Req 3.6)

### StatisticsModule / ChartRenderer

Wraps Chart.js. Three charts:

| Chart | Type | X-axis | Y-axis |
|---|---|---|---|
| Weekly | Bar | Last 7 days (Mon–Sun labels) | Completion % (0–100) |
| Monthly | Bar | Days 1–N of current month | Completion % (0–100) |
| Habit Consistency | Bar | 10 habit names | Average completion % |

`ChartRenderer.create(canvasId, config)` — creates or replaces a Chart.js instance (stored in a `charts` map to allow `destroy()` before recreate on re-visit).

### JapaneseModule

Constants: `TOTALS = { hiragana: 46, katakana: 46, kanji: 2136 }`.

Each card renders:
- Label + total display
- `<input type="number" min="0" max="{total}">` for mastered count
- Progress_Bar (`<div class="progress-bar">` with inline `width` style)

On `input` event: clamp value, recalculate `Math.floor((mastered / total) * 100)`, update DOM, persist via StorageService (< 100 ms since all synchronous).

### RunningModule

Form fields: `distance` (number, positive decimal), `time` (number, positive decimal), `date` (date picker, default = today).

Validation (Req 7.5):
- `distance > 0` and numeric → else show inline error adjacent to field
- `time > 0` and numeric → else show inline error adjacent to field

On valid submit: `pace = time / distance` → store `RunningSession` → `runningChart.update()`.

Empty state: if `sessions.length === 0` render placeholder text + empty chart with axes.

### InvestmentModule

Three `<input type="number">` fields. On `change`:
1. Validate: non-negative (current), positive (target), positive (goal) → inline error if invalid, no state update
2. Compute progress bar % = `Math.floor((current / goal) * 100)` clamped to 100
3. Compute monthly % = `Math.min(Math.floor((current / monthlyTarget) * 100), 100)`
4. If `current >= goal && goal > 0` → show "Goal Reached" indicator
5. Persist via StorageService

### NavigationBar

```js
navItems.forEach(item => {
  item.addEventListener('click', () => {
    sections.forEach(s => s.classList.remove('section--active'));
    document.getElementById(item.dataset.target).classList.add('section--active');
    if (item.dataset.target === 'statistics') StatisticsModule.renderCharts();
    if (item.dataset.target === 'running')    RunningModule.renderChart();
  });
});
```

---

## Data Models

All data is stored in `window.localStorage` as JSON strings under defined keys.

### Key Schema

| Key | Type | Description |
|---|---|---|
| `st_habits_{YYYY-MM-DD}` | `HabitDayRecord` | One key per calendar day |
| `st_japanese` | `JapaneseRecord` | Single record, all three scripts |
| `st_running` | `RunningSession[]` | Append-only array |
| `st_investment` | `InvestmentRecord` | Single record |

The `st_` namespace prefix avoids collision with other apps on the same origin.

### HabitDayRecord

```ts
interface HabitDayRecord {
  date: string;          // "YYYY-MM-DD"
  habits: {
    running:     boolean;
    gym:         boolean;
    pushUp:      boolean;
    sitUp:       boolean;
    pullUp:      boolean;
    japaneseStudy: boolean;
    shadowing:   boolean;
    programming: boolean;
    reading:     boolean;
    meditation:  boolean;
  };
}
```

Ten boolean fields map one-to-one to the ten fixed habits (Req 3.1). The ten keys are fixed constants in `HABIT_KEYS`.

### JapaneseRecord

```ts
interface JapaneseRecord {
  hiragana: number;   // 0–46
  katakana: number;   // 0–46
  kanji:    number;   // 0–2136
}
```

Fixed totals are constants, NOT stored (Req 6.6).

### RunningSession

```ts
interface RunningSession {
  date:     string;   // "YYYY-MM-DD"
  distance: number;   // km, > 0
  time:     number;   // minutes, > 0
  pace:     number;   // minutes/km = time / distance
}
```

### InvestmentRecord

```ts
interface InvestmentRecord {
  current:       number;   // >= 0
  monthlyTarget: number;   // > 0
  goal:          number;   // > 0
}
```

### Streak Algorithm

```js
function computeStreak(allDays, todayKey) {
  // allDays: { "YYYY-MM-DD": HabitDayRecord }
  // todayKey: "YYYY-MM-DD" — excluded from streak
  let streak = 0;
  let cursor = subtractDays(todayKey, 1);   // yesterday
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
```

`subtractDays(dateKey, n)` returns a new `"YYYY-MM-DD"` string. The loop terminates as soon as any past day is missing from LocalStorage or was not fully completed (Req 2.2).

### Date Key Utility

```js
function toDateKey(date) {
  // date: Date object
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}
```

### Percentage Utilities

```js
function habitPercent(record) {
  if (!record) return 0;
  const checked = Object.values(record.habits).filter(Boolean).length;
  return Math.floor((checked / 10) * 100);
}

function progressPercent(value, total) {
  if (!total || total === 0) return 0;
  return Math.min(Math.floor((value / total) * 100), 100);
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Habit percentage is always a floored integer in [0, 100]

*For any* count of checked habits from 0 to 10, `habitPercent` SHALL return `Math.floor((checkedCount / 10) * 100)` as a whole integer in the inclusive range [0, 100] — never negative, never above 100, never a fractional value.

**Validates: Requirements 2.4, 4.1, 4.3**

---

### Property 2: Streak counts only consecutive fully-completed past days, never today

*For any* map of stored `HabitDayRecord` objects and any `todayKey` string, `computeStreak(allDays, todayKey)` SHALL return a non-negative integer that equals the count of the longest consecutive run of fully-complete calendar days ending on the day before `todayKey`. It SHALL return 0 when no past fully-complete day exists, SHALL never include `todayKey`'s record in the count, and SHALL stop at the first gap or incompletely-completed past day.

**Validates: Requirements 2.2**

---

### Property 3: Total completions equals sum of all checked habits across all stored days

*For any* collection of `HabitDayRecord` objects, `computeTotalCompletions(allDays)` SHALL return a non-negative integer equal to the sum of all `true` boolean values across every record's `habits` object.

**Validates: Requirements 2.3**

---

### Property 4: progressPercent always returns a value in [0, 100] and never throws

*For any* non-negative `value` and any `total` (including 0, negative, and fractional), `progressPercent(value, total)` SHALL return a value equal to `Math.min(Math.floor((value / total) * 100), 100)` when `total > 0`, SHALL return 0 when `total ≤ 0`, and SHALL never throw a runtime error.

**Validates: Requirements 6.3, 6.4, 8.2, 8.3**

---

### Property 5: Running pace equals time divided by distance for all valid session inputs

*For any* running session where `distance > 0` and `time > 0`, the `pace` field stored by `buildSession(distance, time, date)` SHALL equal `time / distance` within floating-point epsilon (1e-9).

**Validates: Requirements 7.2**

---

### Property 6: Running session chart dataset is always in ascending date order

*For any* array of `RunningSession` objects with arbitrary (possibly unsorted) dates, the chart dataset produced by `buildRunningChartData(sessions)` SHALL have its labels and data points sorted in ascending chronological order by session date.

**Validates: Requirements 7.3**

---

### Property 7: LocalStorage round-trip fidelity for all data types

*For any* valid `HabitDayRecord`, `JapaneseRecord`, `RunningSession[]`, or `InvestmentRecord`, writing it via the corresponding `StorageService.set*` method and immediately reading it back with the corresponding `StorageService.get*` SHALL return an object that is deeply equal to the original.

**Validates: Requirements 3.2, 3.4, 6.6, 7.2, 8.5**

---

### Property 8: Corrupt or missing LocalStorage data returns safe defaults without throwing

*For any* arbitrary string (including valid JSON, malformed JSON, empty string, or random characters) stored under any Sakura Tracker LocalStorage key, every `StorageService.get*` call SHALL return the appropriate safe default — `null` or a zeroed default object — and SHALL NOT throw a runtime error.

**Validates: Requirements 2.7, 6.7, 8.5**

---

### Property 9: clampMastered always returns a value in [0, TOTALS[script]]

*For any* script name (`"hiragana"`, `"katakana"`, or `"kanji"`) and any integer input (including negative values, values above the maximum, and zero), `clampMastered(script, rawInput)` SHALL return an integer in the range `[0, TOTALS[script]]`.

**Validates: Requirements 6.2, 6.4**

---

### Property 10: Invalid form inputs are rejected without modifying LocalStorage

*For any* combination of invalid running session inputs (`distance ≤ 0`, `time ≤ 0`, empty, or non-numeric) or invalid investment inputs (negative, non-numeric, or zero where positive is required), the form submission handler SHALL not call any `StorageService.set*` method, and SHALL render at least one inline error element adjacent to the offending field.

**Validates: Requirements 7.5, 8.1**

---

## Error Handling

| Scenario | Module | Behavior |
|---|---|---|
| `localStorage.setItem` throws (quota exceeded) | StorageService | Catch error, emit `StorageError` event; calling module shows inline error indicator |
| Corrupted JSON in any LocalStorage key | StorageService | `try/catch` around `JSON.parse`; return `null`/default value |
| `chart.js` not loaded (CDN failure) | StatisticsModule / RunningModule | Guard `typeof Chart !== 'undefined'`; show "Charts unavailable" message inside canvas container |
| Running form: `distance ≤ 0` or `time ≤ 0` or non-numeric | RunningModule | Show inline `<span class="field-error">` adjacent to offending `<input>`; do NOT call StorageService |
| Investment form: negative or non-numeric value | InvestmentModule | Show inline `<span class="field-error">` adjacent to offending `<input>`; do NOT call StorageService |
| Japanese input out-of-range | JapaneseModule | Clamp via `Math.min(Math.max(value, 0), total)`; no error shown (browser `min`/`max` attrs aid prevention) |
| `HabitDayRecord` missing keys on restore | ChecklistModule | Treat missing key as `false` (falsy default) |

All error messages are visible in-UI (not only console) to meet the user-facing requirement in Req 3.6.

---

## Testing Strategy

### Overview

The testing strategy uses two complementary approaches:

- **Unit / example-based tests** — verify specific behaviors, edge cases, and DOM interactions
- **Property-based tests** — verify universal invariants across randomly generated inputs

Since Sakura Tracker's core logic consists of pure utility functions (`computeStreak`, `habitPercent`, `progressPercent`, pace calculation, `clampMastered`, `StorageService`), PBT is highly applicable. Chart rendering and DOM interactions are covered by example-based tests.

### Property-Based Test Configuration

- Library: **[fast-check](https://github.com/dubzzz/fast-check)** (`npm install --save-dev fast-check` for the test environment only)
- Minimum **100 runs** per property test (fast-check's default)
- Each property test file is tagged with a comment referencing the design property:
  ```js
  // Feature: sakura-tracker, Property {N}: {property_text}
  ```

### Property Tests (one per design property)

#### Property 1 — Habit percentage is always a floored integer in [0, 100]
```js
// Feature: sakura-tracker, Property 1: habitPercent returns floor((n/10)*100) in [0,100]
fc.assert(fc.property(
  fc.integer({ min: 0, max: 10 }),
  (checkedCount) => {
    const pct = habitPercent(checkedCount);
    return Number.isInteger(pct)
      && pct >= 0
      && pct <= 100
      && pct === Math.floor((checkedCount / 10) * 100);
  }
));
```

#### Property 2 — Streak excludes today, counts consecutive fully-complete past days
```js
// Feature: sakura-tracker, Property 2: computeStreak never counts today and stops at first gap
fc.assert(fc.property(
  fc.dictionary(
    fc.date().map(toDateKey),
    arbitraryHabitDayRecord()
  ),
  fc.date().map(toDateKey),
  (allDays, todayKey) => {
    const withToday = { ...allDays, [todayKey]: fullyCompleteRecord(todayKey) };
    const streak = computeStreak(withToday, todayKey);
    // Even with a complete today record, today must not be counted
    const streakWithout = computeStreak(allDays, todayKey);
    return Number.isInteger(streak) && streak >= 0 && streak === streakWithout;
  }
));
```

#### Property 3 — Total completions equals sum of all true habit booleans
```js
// Feature: sakura-tracker, Property 3: computeTotalCompletions = sum of all true booleans
fc.assert(fc.property(
  fc.array(arbitraryHabitDayRecord()),
  (records) => {
    const allDays = Object.fromEntries(records.map(r => [r.date, r]));
    const total = computeTotalCompletions(allDays);
    const expected = records.reduce((sum, r) =>
      sum + Object.values(r.habits).filter(Boolean).length, 0);
    return total === expected;
  }
));
```

#### Property 4 — progressPercent always in [0, 100], never throws
```js
// Feature: sakura-tracker, Property 4: progressPercent never throws, always in [0,100]
fc.assert(fc.property(
  fc.float({ min: -1e6, max: 1e6 }),
  fc.float({ min: -1e6, max: 1e6 }),
  (value, total) => {
    let result;
    try {
      result = progressPercent(value, total);
    } catch (e) {
      return false; // must not throw
    }
    return typeof result === 'number' && result >= 0 && result <= 100;
  }
));
```

#### Property 5 — Running pace equals time / distance within epsilon
```js
// Feature: sakura-tracker, Property 5: pace = time / distance for valid sessions
fc.assert(fc.property(
  fc.float({ min: 0.01, max: 1000 }),
  fc.float({ min: 0.01, max: 600 }),
  (distance, time) => {
    const session = buildRunningSession({ distance, time, date: '2025-01-01' });
    return Math.abs(session.pace - time / distance) < 1e-9;
  }
));
```

#### Property 6 — Running chart dataset is in ascending date order
```js
// Feature: sakura-tracker, Property 6: chart dataset dates are ascending
fc.assert(fc.property(
  fc.array(arbitraryRunningSession(), { minLength: 0, maxLength: 50 }),
  (sessions) => {
    const data = buildRunningChartData(sessions);
    for (let i = 1; i < data.labels.length; i++) {
      if (data.labels[i] < data.labels[i - 1]) return false;
    }
    return true;
  }
));
```

#### Property 7 — LocalStorage round-trip fidelity for all data types
```js
// Feature: sakura-tracker, Property 7: StorageService round-trip fidelity
fc.assert(fc.property(
  arbitraryHabitDayRecord(),
  (record) => {
    StorageService.setHabits(record.date, record);
    const restored = StorageService.getHabits(record.date);
    return deepEqual(record, restored);
  }
));
// (repeat analogously for JapaneseRecord, RunningSession[], InvestmentRecord)
```

#### Property 8 — Corrupt LocalStorage returns safe defaults without throwing
```js
// Feature: sakura-tracker, Property 8: corrupt localStorage returns safe defaults
fc.assert(fc.property(
  fc.string(),
  (garbage) => {
    localStorage.setItem('st_japanese', garbage);
    let result;
    try {
      result = StorageService.getJapanese();
    } catch (e) {
      return false; // must not throw
    }
    // result must be null or a valid JapaneseRecord with non-negative values
    if (result === null) return true;
    return result.hiragana >= 0 && result.katakana >= 0 && result.kanji >= 0;
  }
));
```

#### Property 9 — clampMastered always returns a value in [0, TOTALS[script]]
```js
// Feature: sakura-tracker, Property 9: clampMastered bounds any input to [0, total]
fc.assert(fc.property(
  fc.oneof(fc.constant('hiragana'), fc.constant('katakana'), fc.constant('kanji')),
  fc.integer({ min: -2000, max: 5000 }),
  (script, rawInput) => {
    const clamped = clampMastered(script, rawInput);
    return clamped >= 0 && clamped <= TOTALS[script];
  }
));
```

#### Property 10 — Invalid form inputs are rejected without modifying LocalStorage
```js
// Feature: sakura-tracker, Property 10: invalid inputs are rejected, storage unchanged
fc.assert(fc.property(
  fc.oneof(
    fc.constant(0),
    fc.float({ max: 0 }),
    fc.constant(NaN),
    fc.constant(''),
    fc.constant('abc')
  ),
  (invalidValue) => {
    const callsBefore = StorageService.__callCount();
    runningFormSubmit({ distance: invalidValue, time: 5, date: '2025-01-01' });
    const callsAfter = StorageService.__callCount();
    return callsBefore === callsAfter; // no storage write occurred
  }
));
```

### Unit / Example-Based Tests

| Test | What is verified |
|---|---|
| Date format "Monday, 01 January 2025" | Req 2.1 |
| Streak = 0 when no past days in LocalStorage | Req 2.6 |
| Streak stops at non-consecutive day gap | Req 2.2 |
| Habit list renders exactly 10 items in correct order | Req 3.1 |
| Checking habit → progress bar updates within same sync frame | Req 4.2 |
| Running form rejects `distance = 0` → inline error shown | Req 7.5 |
| Running form rejects empty time field → inline error shown | Req 7.5 |
| No running sessions → placeholder text rendered | Req 7.6 |
| Investment "Goal Reached" shown when `current ≥ goal > 0` | Req 8.6 |
| Statistics all-zero when LocalStorage empty | Req 5.5 |
| Chart.js not loaded → "Charts unavailable" fallback shown | Error handling |
| LocalStorage write failure → error indicator, UI not reverted | Req 3.6 |

### Integration Tests

| Test | What is verified |
|---|---|
| App loads with empty LocalStorage → all values display 0 | Req 2.6, 6.7, 8.5 |
| Check habit → LocalStorage written → reload restores that state | Req 3.2, 3.4 |
| Enter Japanese mastered value → reload restores value | Req 6.6 |
| Add running session → chart updates without page reload | Req 7.4 |
| Update investment fields → recalculates within same frame | Req 8.4 |

### What Is NOT Covered by PBT

The following are verified by visual review, CSS snapshots, or manual testing only:

- Glassmorphism styling (backdrop-filter, border-radius, shadows) — Req 9
- Responsive single/multi-column layout at breakpoints — Req 1
- CSS transition durations (150–400 ms) — Req 9.3
- `index.html` / `style.css` section comment structure — Req 10.3, 10.4
- Chart.js CDN `<script>` tag presence — Req 10.2

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The properties below were derived by analyzing every acceptance criterion and identifying those that express universal rules over a range of inputs (rather than one-off UI or timing behaviors). Properties expressed as "for any" statements can be directly translated into property-based tests using a library such as [fast-check](https://github.com/dubzzz/fast-check).

---

### Property 1: Date Formatting Correctness

*For any* valid `Date` object, `formatDate(date)` SHALL return a string that matches the pattern `"<Weekday>, <DD> <Month> <YYYY>"` where the weekday is the correct English full weekday name, DD is zero-padded to two digits, Month is the correct English full month name, and YYYY is the four-digit year.

**Validates: Requirements 2.1**

---

### Property 2: Streak Calculation Correctness

*For any* `HabitsMap` (a map of date strings to 10-element boolean arrays), `calcStreak(habits, today)` SHALL return the count of the longest unbroken sequence of calendar days ending on the day immediately before `today` in which all ten habit entries are `true`. If no such sequence exists, the result SHALL be 0. The result SHALL be a non-negative integer.

**Validates: Requirements 2.2**

---

### Property 3: Total Completions Summation

*For any* `HabitsMap`, `calcTotalCompletions(habits)` SHALL return a value equal to the exact count of `true` values summed across all stored date entries. Adding a new fully-checked day SHALL increase the total by exactly 10; adding a day with k checked habits SHALL increase the total by exactly k.

**Validates: Requirements 2.3**

---

### Property 4: Progress Percentage Formula

*For any* non-negative integer `numerator` and positive integer `denominator`, a progress percentage calculation SHALL return `Math.floor((numerator / denominator) * 100)`, clamped to the range `[0, 100]`. This property applies uniformly to today's habit progress (denominator = 10), Japanese character mastery (denominator = fixed total per script), and investment goal progress (denominator = goal value).

**Validates: Requirements 2.4, 4.1, 6.3, 8.2**

---

### Property 5: Habit Toggle Persistence Round-Trip

*For any* combination of date string and habit index (0–9), toggling a habit to checked (`true`) and then reading back that date's habits from LocalStorage SHALL return `true` at that index. Toggling the same habit to unchecked (`false`) and then reading back SHALL return `false` at that index. All other indices in the array SHALL be unchanged by a single toggle operation.

**Validates: Requirements 3.2, 3.3, 3.4**

---

### Property 6: Progress Bar Label Format

*For any* integer `checked` in the range `[0, 10]`, the progress bar label SHALL be the string `"<checked> / 10"` where `<checked>` is the exact integer value. No other format is acceptable.

**Validates: Requirements 4.3**

---

### Property 7: Weekly Chart Data Accuracy

*For any* `HabitsMap` and any reference date `today`, `buildWeeklyData(habits, today)` SHALL return exactly 7 data points. Each point at offset `i` (0 = 6 days ago, 6 = today) SHALL have a `y` value equal to `floor((trueCount(habits[date_i]) / 10) * 100)`, and SHALL be 0 if no entry exists for that date.

**Validates: Requirements 5.1, 5.5**

---

### Property 8: Monthly Chart Data Accuracy

*For any* `HabitsMap` and any reference month, `buildMonthlyData(habits, month)` SHALL return exactly one data point per calendar day of that month. Each data point's `y` value SHALL equal `floor((trueCount(habits[date]) / 10) * 100)`, defaulting to 0 for dates with no stored entry.

**Validates: Requirements 5.2, 5.5**

---

### Property 9: Habit Consistency Chart Data

*For any* `HabitsMap`, `buildHabitData(habits)` SHALL return exactly 10 entries — one per habit in the canonical order. Each entry's value SHALL equal `floor((daysHabitWasChecked / totalDaysStored) * 100)` for that habit index, where totalDaysStored is the count of date keys in the map. If the map is empty, all 10 values SHALL be 0.

**Validates: Requirements 5.3, 5.5**

---

### Property 10: Japanese Input Clamping

*For any* numeric input `v` and script `s` with fixed total `T`, `clampJapanese(v, T)` SHALL return `Math.max(0, Math.min(T, Math.floor(v)))`. Values below 0 SHALL clamp to 0; values above T SHALL clamp to T; fractional inputs SHALL be floored. This property holds for all three scripts (Hiragana T=46, Katakana T=46, Kanji T=2136).

**Validates: Requirements 6.2, 6.4**

---

### Property 11: Japanese Progress State Round-Trip

*For any* `JapaneseState` object with values within their valid ranges, serialising the state to LocalStorage via `StorageService.set` and then deserialising it via `StorageService.get` SHALL produce an object equal (field-by-field) to the original. The round-trip SHALL hold regardless of which fields are set or the order of operations.

**Validates: Requirements 6.6**

---

### Property 12: Running Pace Calculation

*For any* running session with `distance > 0` and `time > 0`, the stored `pace` field SHALL equal `time / distance` (minutes per kilometre). *For any* array of RunningSession records, the pace value stored for each session SHALL never depend on any other session's data — pace is calculated independently per session.

**Validates: Requirements 7.2**

---

### Property 13: Running Sessions Chronological Ordering

*For any* array of `RunningSession` objects, the chart data built by `buildRunningChartData(sessions)` SHALL have its entries sorted in strictly ascending order by the `date` field (lexicographic ascending on ISO date strings). Inserting a session with an earlier date SHALL reposition it before all sessions with later dates in the chart output.

**Validates: Requirements 7.3**

---

### Property 14: Invalid Numeric Input Rejection

*For any* input value that is `<= 0`, `NaN`, empty string, or non-numeric text, the validation functions for both Running Progress (distance / time fields) and Investment Progress (current / monthly / goal fields) SHALL return `false` and the underlying `appState` and `localStorage` SHALL remain unchanged after the attempted submission. *For any* valid positive numeric input, the validation SHALL return `true`.

**Validates: Requirements 7.5, 8.1**

---

### Property 15: Monthly Target Percentage Cap

*For any* non-negative `current` and positive `monthly`, `calcMonthlyPercent(current, monthly)` SHALL return `Math.min(100, Math.floor((current / monthly) * 100))`. The result SHALL never exceed 100 regardless of how large `current` is relative to `monthly`. If `monthly` is 0 or negative, the function SHALL return 0 without throwing a runtime error.

**Validates: Requirements 8.3**

---

### Property 16: Investment State Round-Trip

*For any* `InvestmentState` with `current >= 0`, `monthly > 0`, and `goal > 0`, serialising then deserialising via `StorageService` SHALL produce an object field-for-field equal to the original. If the stored data is missing or corrupt (non-parseable JSON), deserialisation SHALL return `{ current: 0, monthly: 0, goal: 0 }` without throwing.

**Validates: Requirements 8.5**

---

## Error Handling

### LocalStorage Failures

All reads from `localStorage` go through `StorageService.get(key)`, which wraps `JSON.parse` in a try/catch. On any error (corrupt JSON, missing key, `SecurityError`), it returns `null`. Callers treat `null` as "no data" and fall back to safe defaults (zeros, empty arrays, unchecked habits).

All writes go through `StorageService.set(key, value)`, which catches `QuotaExceededError` and returns `false`. The calling section displays an inline error indicator without reverting the previous valid state.

### Numeric Input Validation

A shared `validatePositiveNumber(value)` helper is used by both Running Progress and Investment Progress. It returns `false` for empty strings, non-numeric values, `NaN`, `Infinity`, and values `<= 0`. Validation errors are surfaced as inline `<span class="error-msg">` elements adjacent to the offending input field; the form is not submitted.

For Investment Progress, the `current` field accepts `0` (non-negative), while `monthly` and `goal` must be strictly positive.

### Division by Zero

All percentage calculations check the denominator before dividing:
```js
function safePercent(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0
  return Math.min(100, Math.floor((numerator / denominator) * 100))
}
```
This single utility is used by the Dashboard, Progress Bar, Japanese Progress, and Investment Progress to prevent runtime errors.

### Date Handling

`getTodayKey()` always uses `new Date()` and `toISOString().slice(0, 10)` to produce a consistent `"YYYY-MM-DD"` key. If the system clock is unavailable (extremely rare browser error), the function catches and returns `"0000-00-00"`, rendering empty data rather than crashing.

### Chart.js Canvas Reuse

Each chart variable (`weeklyChart`, `monthlyChart`, etc.) is checked before re-creation:
```js
if (weeklyChart) weeklyChart.destroy()
weeklyChart = new Chart(ctx, config)
```
This prevents the "Canvas is already in use" runtime error when the Statistics section is re-rendered.

---

## Testing Strategy

### Overview

The dual-testing approach covers two complementary layers:

- **Unit tests (example-based)**: verify specific scenarios, edge cases, error recovery, and integration wiring
- **Property-based tests**: verify universal invariants across randomised inputs using [fast-check](https://github.com/dubzzz/fast-check)

Since the application is Vanilla JS with no build tool, tests are written as a standalone test file (`test/sakura.test.js`) runnable with [Vitest](https://vitest.dev/) (zero-config, native ESM support). A minimal `vite.config.js` and `package.json` support the test runner without affecting the three production files.

### Property-Based Tests

Each property defined in the Correctness Properties section maps to one property-based test. fast-check generates 100+ randomised inputs per run.

**Tag format**: `// Feature: sakura-tracker, Property <N>: <property title>`

| Property | Test Description | Arbitraries Used |
|----------|-----------------|------------------|
| 1 | `formatDate` always produces the correct pattern | `fc.date()` |
| 2 | `calcStreak` returns non-negative int; counts correctly | Generated `HabitsMap` + `today` string |
| 3 | `calcTotalCompletions` equals exact sum of `true` values | Generated `HabitsMap` |
| 4 | `safePercent(n, d)` equals `clamp(floor(n/d*100), 0, 100)` | `fc.nat()` pairs |
| 5 | Habit toggle read-back equals the toggled value | `fc.integer({min:0, max:9})` + `fc.boolean()` |
| 6 | Progress bar label is `"<n> / 10"` for n in 0–10 | `fc.integer({min:0, max:10})` |
| 7 | `buildWeeklyData` returns 7 points with correct values | Generated `HabitsMap` + date |
| 8 | `buildMonthlyData` returns one point per day of month | Generated `HabitsMap` + year/month |
| 9 | `buildHabitData` returns 10 entries with correct rates | Generated `HabitsMap` |
| 10 | `clampJapanese(v, T)` satisfies clamping invariant | `fc.float()` + totals |
| 11 | Japanese state serialize → deserialize is identity | Generated `JapaneseState` |
| 12 | `pace = time / distance` stored correctly | `fc.float({min:0.01, max:500})` pairs |
| 13 | `buildRunningChartData` output is sorted ascending by date | Shuffled `RunningSession[]` |
| 14 | Invalid inputs return `false`; state unchanged | Generated invalid values |
| 15 | `calcMonthlyPercent` never exceeds 100 | `fc.nat()` pairs |
| 16 | Investment state serialize → deserialize is identity | Generated `InvestmentState` |

**Minimum iterations**: 100 per property test (fast-check default is 100, configured explicitly).

### Unit Tests (Example-Based)

| Area | Scenario |
|------|----------|
| Dashboard | Empty LocalStorage → all zeros rendered |
| Dashboard | Corrupted JSON in `sk_habits` → graceful fallback to zeros |
| Habit List | All 10 habits rendered in canonical order |
| Habit List | New date → all habits unchecked |
| Habit List | LocalStorage write failure → visual error indicator shown |
| Statistics | Empty data → 0 % for all chart data points |
| Statistics | Chart instances destroyed before re-creation |
| Japanese | Missing LocalStorage key → all mastered values = 0 |
| Japanese | Three cards displayed (Hiragana, Katakana, Kanji) |
| Running | Empty session list → placeholder message shown |
| Running | Submitting form with empty fields → error displayed |
| Investment | Goal reached (current >= goal) → "Goal Reached" indicator shown |
| Investment | Corrupt localStorage → all fields default to 0 |

### Testing for Non-PBT Requirements

The following requirements are validated outside property-based tests:

| Requirement | Approach |
|-------------|----------|
| Responsive layout (Req 1) | Manual testing at 320 px, 768 px, 1280 px viewports; CSS linting |
| Glassmorphism theme (Req 9) | Visual review; CSS audit for `backdrop-filter`, `border-radius`, `transition` |
| Three-file structure (Req 10.1) | File system check (part of project conventions) |
| Chart.js CDN only (Req 10.2) | Code review / grep for inline Chart.js source |
| Section comments (Req 10.3–10.4) | Code review |
| Timing constraints (≤ 300 ms / ≤ 100 ms / ≤ 500 ms) | Manual interaction testing; browser DevTools performance tab |
