# Implementation Plan: Sakura Tracker

## Overview

Implement Sakura Tracker as three static files (`index.html`, `style.css`, `script.js`) with Chart.js loaded via CDN. All logic is vanilla JavaScript; data persists in `window.localStorage`. The build order follows a bottom-up dependency chain: scaffold → storage → utilities → HTML → CSS → modules → wiring → tests.

## Tasks

- [x] 1. Project scaffold — three files with section comments and CDN link
  - Create `index.html` with `<link>` to `style.css`, Chart.js CDN `<script>` tag, and `<script src="script.js" defer>`
  - Create `style.css` with nine ordered section comments: Reset/Base, Layout, Navigation, Dashboard, Daily Checklist, Statistics, Japanese Progress, Running Progress, Investment Progress
  - Create `script.js` with six ordered section comments: Dashboard, Daily Checklist, Statistics, Japanese Progress, Running Progress, Investment Progress plus a Storage Layer comment block at the top
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 2. StorageService — all get/set methods with error handling
  - [x] 2.1 Implement `StorageService` object with `getHabits`, `setHabits`, `getAllHabitDays`, `getJapanese`, `setJapanese`, `getRunning`, `addRunningSession`, `getInvestment`, `setInvestment`, `clear` methods
    - Wrap every `JSON.parse` in `try/catch`; return `null`/`[]`/default object on failure
    - Wrap every `localStorage.setItem` in `try/catch`; emit a `StorageError` custom event on quota failure
    - Use the `st_` namespace prefix for all keys (e.g. `st_habits_YYYY-MM-DD`, `st_japanese`, `st_running`, `st_investment`)
    - _Requirements: 2.7, 3.2, 3.4, 3.6, 6.6, 6.7, 7.2, 8.5_

- [x] 3. Utility functions — `toDateKey`, `habitPercent`, `progressPercent`, `safePercent`, `computeStreak`, `computeTotalCompletions`, `clampMastered`, `buildRunningSession`, `buildRunningChartData`
  - [x] 3.1 Implement `toDateKey(date)`, `habitPercent(record)`, `progressPercent(value, total)`, `safePercent(numerator, denominator)`
    - `toDateKey`: `date.toISOString().slice(0, 10)`
    - `habitPercent`: `Math.floor((checkedCount / 10) * 100)`, returning 0 for null record
    - `progressPercent` / `safePercent`: `Math.min(Math.floor((value / total) * 100), 100)`; return 0 when `total <= 0`
    - _Requirements: 2.1, 2.4, 4.1, 6.3, 6.4, 8.2, 8.3_

  - [x] 3.4 Implement `computeStreak(allDays, todayKey)` and `subtractDays(dateKey, n)`
    - Streak walks backward from `yesterday = subtractDays(todayKey, 1)`, incrementing while every habit in a day is `true`; stops on first gap or incomplete day; never reads `todayKey`'s own record
    - _Requirements: 2.2_

  - [x] 3.6 Implement `computeTotalCompletions(allDays)`
    - Sum all `true` boolean values across all stored `HabitDayRecord` objects
    - _Requirements: 2.3_

  - [x] 3.8 Implement `clampMastered(script, rawInput)` using `TOTALS = { hiragana: 46, katakana: 46, kanji: 2136 }`
    - Returns `Math.max(0, Math.min(TOTALS[script], Math.floor(rawInput)))`
    - _Requirements: 6.2, 6.4_

  - [x] 3.10 Implement `buildRunningSession({ distance, time, date })` and `buildRunningChartData(sessions)`
    - `buildRunningSession`: creates `{ date, distance, time, pace: time / distance }`
    - `buildRunningChartData`: sorts sessions ascending by `date`, returns `{ labels, data }`
    - _Requirements: 7.2, 7.3_

- [x] 4. Checkpoint — verify utility functions and StorageService
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. HTML structure — all sections and navigation bar
  - [x] 5.1 Add `<nav>` element with six `<button data-target="...">` items: dashboard, checklist, statistics, japanese, running, investment
    - _Requirements: 1.1, 1.5_

  - [x] 5.2 Add `<section id="dashboard">` with placeholders for date, streak, total completions, today's progress percentage, and the `<div class="progress-bar">` element including the fraction label
    - _Requirements: 2.1, 2.4, 4.3_

  - [x] 5.3 Add `<section id="checklist">` with a `<ul id="habit-list">` (ten `<li>` items with `<input type="checkbox">` rendered by JS) and the progress bar container
    - _Requirements: 3.1, 4.1, 4.2, 4.4_

  - [x] 5.4 Add `<section id="statistics">` with three `<canvas>` elements: `weekly-chart`, `monthly-chart`, `habit-chart`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.5 Add `<section id="japanese">` with three card containers (hiragana, katakana, kanji), each holding `<input type="number">`, `<span>` for total, and `<div class="progress-bar">`
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 5.6 Add `<section id="running">` with the session form (`distance`, `time`, `date` fields + submit button), `<canvas id="running-chart">`, and empty-state placeholder `<p>`
    - _Requirements: 7.1, 7.5, 7.6_

  - [x] 5.7 Add `<section id="investment">` with three `<input type="number">` fields (current, monthly-target, goal), inline `<span class="field-error">` slots, progress bar, monthly % display, and "Goal Reached" indicator element
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

- [x] 6. CSS theme — glassmorphism, dark mode, responsive breakpoints
  - [x] 6.1 Implement Reset/Base and Layout styles: dark background (luminance < 20 %), flex/grid page shell, `section--active` show/hide toggle
    - _Requirements: 9.1, 1.1_

  - [x] 6.2 Implement Navigation styles: horizontal nav bar on desktop, vertical stacking on mobile (< 768 px), each item min tap-target 44 × 44 px
    - _Requirements: 1.3, 1.5_

  - [x] 6.3 Implement card glassmorphism styles: `backdrop-filter: blur(...)`, `background-color` with opacity 0.05–0.25, `border-radius ≥ 12px`, drop shadow blur 8–32 px
    - _Requirements: 9.2_

  - [x] 6.4 Implement Progress_Bar styles: full-width track, filled inner `<div>` with `width` driven by inline style, smooth CSS transition 150–400 ms
    - _Requirements: 9.3, 4.2_

  - [x] 6.5 Implement responsive breakpoints: single-column layout below 768 px, multi-column at ≥ 768 px and ≥ 1280 px; no horizontal scrollbar at any breakpoint
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 6.6 Add section-specific styles for Dashboard, Daily Checklist, Statistics, Japanese Progress, Running Progress, Investment Progress in order matching section comment structure
    - _Requirements: 10.4_

- [x] 7. DashboardModule
  - [x] 7.1 Implement `DashboardModule.render()`: call `computeStreak`, `computeTotalCompletions`, `habitPercent` for today, `formatDate` for today's date; write results to DOM
    - Read today's key via `toDateKey(new Date())`; retrieve all days from `StorageService.getAllHabitDays()`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 7.2 Implement `DashboardModule.updateProgress()`: re-read today's `HabitDayRecord` from StorageService and update only the progress percentage and progress bar fill width in the DOM
    - _Requirements: 4.1, 4.2_

- [x] 8. ChecklistModule + progress bar
  - [x] 8.1 Implement `ChecklistModule.render()`: generate ten `<li>` elements from the `HABITS` constant array in canonical order; restore checked state from StorageService for today's date; render progress bar initial state
    - _Requirements: 3.1, 3.4, 3.5, 4.1, 4.4_


  - [x] 8.2 Implement checkbox `change` handler: read today's record (or create empty), toggle the habit boolean, write back via `StorageService.setHabits`; call `DashboardModule.updateProgress()`; update progress bar fraction label and fill width synchronously; show error indicator on `StorageError` without reverting UI
    - _Requirements: 3.2, 3.3, 3.6, 4.2, 4.3_

- [x] 9. StatisticsModule + ChartRenderer (three charts)
  - [x] 9.1 Implement `buildWeeklyData(allDays, today)` and `buildMonthlyData(allDays)` and `buildHabitData(allDays)` data-builder functions
    - Weekly: last 7 calendar days, each y = `habitPercent(allDays[dateKey])` defaulting to 0
    - Monthly: every calendar day of current month, same formula
    - Habit consistency: for each of 10 habits, `Math.floor((daysChecked / totalDays) * 100)`, default 0 if no days stored
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x] 9.5 Implement `ChartRenderer.create(canvasId, config)` and `StatisticsModule.renderCharts()`
    - Guard `typeof Chart !== 'undefined'`; destroy existing instance before recreating; show "Charts unavailable" fallback text if Chart.js not loaded
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

- [x] 10. JapaneseModule (three progress cards)
  - [ ] 10.1 Implement `JapaneseModule.render()`: read `StorageService.getJapanese()` (default `{ hiragana: 0, katakana: 0, kanji: 0 }` on null/corrupt); render three cards with clamped mastered values and progress bars filled via `safePercent`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7_

  - [ ] 10.2 Implement `input` event handler on each mastered field: call `clampMastered`, update progress bar fill width and percentage label, persist via `StorageService.setJapanese` — all synchronously within 100 ms
    - _Requirements: 6.2, 6.4, 6.5, 6.6_

- [x] 11. RunningModule (form, validation, line chart)
  - [x] 11.1 Implement `validatePositiveNumber(value)` shared helper: returns `false` for empty string, non-numeric, `NaN`, `Infinity`, and `<= 0`
    - _Requirements: 7.5, 8.1_

  - [x] 11.3 Implement `RunningModule.render()`: restore sessions from `StorageService.getRunning()`; render empty-state placeholder if no sessions; otherwise call `RunningModule.renderChart()`
    - _Requirements: 7.6_

  - [x] 11.4 Implement running form submit handler: validate distance and time via `validatePositiveNumber`; show inline `<span class="field-error">` adjacent to offending field if invalid and abort; on success call `buildRunningSession`, `StorageService.addRunningSession`, then `RunningModule.renderChart()` within 500 ms
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 11.5 Implement `RunningModule.renderChart()`: call `buildRunningChartData(sessions)` to get sorted labels/data; create or replace Chart.js line chart on `running-chart` canvas; guard for Chart.js unavailability
    - _Requirements: 7.3, 7.4_

- [x] 12. InvestmentModule (fields, validation, progress bar)
  - [x] 12.1 Implement `InvestmentModule.render()`: restore record from `StorageService.getInvestment()` (default `{ current: 0, monthlyTarget: 0, goal: 0 }`); populate fields; recalculate and render progress bar, monthly %, and "Goal Reached" indicator
    - _Requirements: 8.2, 8.3, 8.5, 8.6_

  - [x] 12.2 Implement `input`/`change` event handlers for all three fields: validate (`current ≥ 0`, `monthlyTarget > 0`, `goal > 0`) using `validatePositiveNumber` (with non-negative variant for current); show inline `<span class="field-error">` on invalid input and skip storage; on valid: compute `safePercent(current, goal)` and `Math.min(100, Math.floor(current / monthlyTarget * 100))`, update DOM and progress bar, show "Goal Reached" if `current >= goal && goal > 0`, persist via `StorageService.setInvestment` — all within 300 ms
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

- [x] 13. NavigationBar wiring
  - [ ] 13.1 Implement `NavigationBar.bind()`: attach `click` listeners to each nav item; on click remove `section--active` from all sections, add it to the target section; if target is `statistics` call `StatisticsModule.renderCharts()`; if target is `running` call `RunningModule.renderChart()`; on `DOMContentLoaded` call `StorageService.init()`, `DashboardModule.render()`, `ChecklistModule.render()`, `JapaneseModule.render()`, `InvestmentModule.render()`, then `NavigationBar.bind()`; activate the dashboard section by default
    - _Requirements: 1.1, 5.4_

- [x] 14. Checkpoint — full integration smoke tests
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 15. Property-based test suite (fast-check, all 10 properties from design's first PBT section)
  - [ ] 15.1 Set up test environment: create `package.json` with `vitest` and `fast-check` as dev dependencies; create `vite.config.js`; create `test/sakura.test.js` with imports for all pure utility functions exported from `script.js`
    - _Requirements: 10.5 (no frameworks in production files; test tooling is dev-only)_

- [ ] 16. Unit and integration tests
  -

- [ ] 17. Final checkpoint — all tests pass and files are complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All production code lives in exactly three files: `index.html`, `style.css`, `script.js` (Req 10.1)
- Test tooling (`package.json`, `vite.config.js`, `test/`) is dev-only and does not violate the no-framework production requirement (Req 10.5)
- `fast-check` is used for property-based tests; `vitest` is the test runner
- Minimum 100 iterations per property test (fast-check default, configured explicitly)
- Each property test file tagged: `// Feature: sakura-tracker, Property N: <title>`
- Checkpoints at tasks 4, 14, and 17 provide incremental validation gates
- Property sub-tasks reference both the design's first PBT section numbers (used during module implementation) and the design's second Correctness Properties section numbers (used in the consolidated test suite)


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "3.4", "3.6", "3.8", "3.10"] },
    { "id": 3, "tasks": ["3.5", "3.7", "3.9", "3.11", "3.12", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "7.1", "7.2", "9.1", "10.1", "11.1"] },
    { "id": 5, "tasks": ["7.3", "8.1", "8.2", "9.2", "9.3", "9.4", "9.5", "10.2", "11.2", "11.3", "12.1"] },
    { "id": 6, "tasks": ["8.3", "8.4", "8.5", "9.6", "10.3", "11.4", "11.5", "12.2", "13.1"] },
    { "id": 7, "tasks": ["11.6", "12.3", "13.2", "15.1"] },
    { "id": 8, "tasks": ["15.2", "15.3", "15.4", "16.1", "16.2"] },
    { "id": 9, "tasks": ["16.3"] }
  ]
}
```
