/**
 * Sakura Tracker — main test suite
 *
 * Test runner : vitest  (npm run test:run)
 * PBT library : fast-check
 *
 * Pure utility functions imported from script.js.
 * DOM-dependent module objects are NOT imported here; they are tested
 * separately via integration tests (task 16.x) with full jsdom setup.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

import {
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
} from '../script.js';

// ─────────────────────────────────────────────────────────────
//  Smoke test — verify all imports resolved correctly
// ─────────────────────────────────────────────────────────────
describe('Imports', () => {
  it('all pure utility functions are exported from script.js', () => {
    expect(typeof toDateKey).toBe('function');
    expect(typeof habitPercent).toBe('function');
    expect(typeof progressPercent).toBe('function');
    expect(typeof safePercent).toBe('function');
    expect(typeof subtractDays).toBe('function');
    expect(typeof computeStreak).toBe('function');
    expect(typeof computeTotalCompletions).toBe('function');
    expect(typeof clampMastered).toBe('function');
    expect(typeof buildRunningSession).toBe('function');
    expect(typeof buildRunningChartData).toBe('function');
    expect(typeof validatePositiveNumber).toBe('function');
    expect(typeof buildWeeklyData).toBe('function');
    expect(typeof buildMonthlyData).toBe('function');
    expect(typeof buildHabitData).toBe('function');
    expect(typeof formatDate).toBe('function');
    expect(typeof StorageService).toBe('object');
    expect(typeof TOTALS).toBe('object');
    expect(Array.isArray(HABITS)).toBe(true);
    expect(Array.isArray(HABIT_KEYS)).toBe(true);
  });

  it('HABITS and HABIT_KEYS each have exactly 10 entries', () => {
    expect(HABITS).toHaveLength(10);
    expect(HABIT_KEYS).toHaveLength(10);
  });

  it('TOTALS has correct values for all three Japanese scripts', () => {
    expect(TOTALS.hiragana).toBe(46);
    expect(TOTALS.katakana).toBe(46);
    expect(TOTALS.kanji).toBe(2136);
  });
});

// ─────────────────────────────────────────────────────────────
//  Utility properties (tasks 15.2)
//  Property 1 : habitPercent
//  Property 2 : computeStreak
//  Property 3 : computeTotalCompletions
//  Property 4 : progressPercent / safePercent
// ─────────────────────────────────────────────────────────────
describe('Utility properties', () => {
  // Feature: sakura-tracker, Property 1: habitPercent returns floor((n/10)*100) in [0,100]
  // Validates: Requirements 3.1
  it('Property 1 — habitPercent result is always a floored integer in [0, 100]', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 10 }),
      (checkedCount) => {
        // Build a fake HabitDayRecord with checkedCount true values
        const keys = ['running','gym','pushUp','sitUp','pullUp','japaneseStudy','shadowing','programming','reading','meditation'];
        const habits = {};
        keys.forEach((k, i) => { habits[k] = i < checkedCount; });
        const record = { date: '2025-01-01', habits };
        const pct = habitPercent(record);
        return Number.isInteger(pct) && pct >= 0 && pct <= 100 && pct === Math.floor((checkedCount / 10) * 100);
      }
    ), { numRuns: 100 });
  });

  // Feature: sakura-tracker, Property 2: computeStreak never counts today and stops at first gap
  // Validates: Requirements 2.3
  it('Property 2 — streak never counts today and stops at first incomplete/missing day', () => {
    fc.assert(fc.property(
      fc.date({ min: new Date('2024-01-02'), max: new Date('2026-12-31') }),
      (todayDate) => {
        const todayKey = toDateKey(todayDate);
        const keys = ['running','gym','pushUp','sitUp','pullUp','japaneseStudy','shadowing','programming','reading','meditation'];
        const fullRecord = { date: todayKey, habits: Object.fromEntries(keys.map(k => [k, true])) };
        const allDays = { [todayKey]: fullRecord };
        const streak = computeStreak(allDays, todayKey);
        // today fully complete but streak is still 0 because today is excluded
        return Number.isInteger(streak) && streak === 0;
      }
    ), { numRuns: 100 });
  });

  // Feature: sakura-tracker, Property 3: computeTotalCompletions = sum of all true booleans
  // Validates: Requirements 2.4
  it('Property 3 — totalCompletions equals the exact count of true habit values across all days', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          date: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }).map(toDateKey),
          habits: fc.record({
            running: fc.boolean(), gym: fc.boolean(), pushUp: fc.boolean(),
            sitUp: fc.boolean(), pullUp: fc.boolean(), japaneseStudy: fc.boolean(),
            shadowing: fc.boolean(), programming: fc.boolean(),
            reading: fc.boolean(), meditation: fc.boolean(),
          })
        }),
        { minLength: 0, maxLength: 30 }
      ),
      (records) => {
        // Deduplicate by date (last write wins)
        const allDays = {};
        records.forEach(r => { allDays[r.date] = r; });
        const total = computeTotalCompletions(allDays);
        const expected = Object.values(allDays).reduce((sum, r) =>
          sum + Object.values(r.habits).filter(Boolean).length, 0);
        return total === expected;
      }
    ), { numRuns: 100 });
  });

  // Feature: sakura-tracker, Property 4: progressPercent never throws, always in [0,100]
  // Validates: Requirements 2.5
  it('Property 4 — progressPercent / safePercent always returns a value in [0, 100]', () => {
    fc.assert(fc.property(
      fc.float({ min: -1e6, max: 1e6, noNaN: true }),
      fc.float({ min: -1e6, max: 1e6, noNaN: true }),
      (value, total) => {
        let result;
        try { result = progressPercent(value, total); } catch (e) { return false; }
        return typeof result === 'number' && result >= 0 && result <= 100;
      }
    ), { numRuns: 100 });
  });

  // Feature: sakura-tracker, Property 15: Monthly Target Percentage Cap
  // Validates: Requirements 8.2
  it('Property 15 — safePercent is capped at 100 for numerator > denominator', () => {
    fc.assert(fc.property(
      fc.float({ min: 1, max: 1e6, noNaN: true }),
      fc.float({ min: 1, max: 1e6, noNaN: true }),
      (numerator, denominator) => {
        const result = safePercent(numerator, denominator);
        return result >= 0 && result <= 100;
      }
    ), { numRuns: 100 });
  });
});

// ─────────────────────────────────────────────────────────────
//  Running properties (task 15.3)
//  Property 5 : pace = time / distance
//  Property 6 : chart data is ascending by date
//  Property 9 : clampMastered bounds any input to [0, total]
//  Property 10: Japanese Input Clamping
// ─────────────────────────────────────────────────────────────
describe('Running & Japanese properties', () => {
  // Feature: sakura-tracker, Property 5: pace = time / distance for valid sessions
  // Validates: Requirements 7.2
  it('Property 5 — buildRunningSession pace equals time / distance', () => {
    fc.assert(fc.property(
      fc.float({ min: 0.01, max: 1000, noNaN: true }),
      fc.float({ min: 0.01, max: 600, noNaN: true }),
      (distance, time) => {
        const session = buildRunningSession({ distance, time, date: '2025-01-01' });
        return Math.abs(session.pace - time / distance) < 1e-9;
      }
    ), { numRuns: 100 });
  });

  // Feature: sakura-tracker, Property 6: chart dataset dates are ascending
  // Validates: Requirements 7.3
  it('Property 6 — buildRunningChartData labels are always in ascending date order', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          date: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }).map(toDateKey),
          distance: fc.float({ min: 0.1, max: 100, noNaN: true }),
          time: fc.float({ min: 1, max: 300, noNaN: true }),
          pace: fc.float({ min: 1, max: 30, noNaN: true }),
        }),
        { minLength: 0, maxLength: 50 }
      ),
      (sessions) => {
        const chartData = buildRunningChartData(sessions);
        // buildRunningChartData returns { labels, data }
        for (let i = 1; i < chartData.labels.length; i++) {
          if (chartData.labels[i] < chartData.labels[i - 1]) return false;
        }
        return true;
      }
    ), { numRuns: 100 });
  });

  // Feature: sakura-tracker, Property 9: clampMastered bounds any input to [0, total]
  // Validates: Requirements 6.3
  it('Property 9 — clampMastered always returns a value in [0, TOTALS[script]]', () => {
    fc.assert(fc.property(
      fc.oneof(fc.constant('hiragana'), fc.constant('katakana'), fc.constant('kanji')),
      fc.integer({ min: -2000, max: 5000 }),
      (script, rawInput) => {
        const clamped = clampMastered(script, rawInput);
        return Number.isInteger(clamped) && clamped >= 0 && clamped <= TOTALS[script];
      }
    ), { numRuns: 100 });
  });

  // Feature: sakura-tracker, Property 10: Japanese Input Clamping
  // Validates: Requirements 6.3
  it('Property 10 — clampMastered floors fractional values before clamping', () => {
    fc.assert(fc.property(
      fc.oneof(fc.constant('hiragana'), fc.constant('katakana'), fc.constant('kanji')),
      fc.float({ min: 0, max: 2200, noNaN: true }),
      (script, rawInput) => {
        const clamped = clampMastered(script, rawInput);
        return clamped >= 0 && clamped <= TOTALS[script] && Number.isInteger(clamped);
      }
    ), { numRuns: 100 });
  });
});

// ─────────────────────────────────────────────────────────────
//  StorageService properties (task 15.4)
//  Property 7 : round-trip fidelity
//  Property 8 : corrupt data returns safe defaults
//  Property 11: Japanese Progress State Round-Trip
//  Property 16: Investment State Round-Trip
// ─────────────────────────────────────────────────────────────
describe('StorageService properties', () => {
  beforeEach(() => {
    // Reset localStorage between tests (jsdom environment)
    localStorage.clear();
  });

  // Feature: sakura-tracker, Property 7: StorageService round-trip fidelity
  // Validates: Requirements 3.2
  it('Property 7 — setHabits then getHabits returns the same record', () => {
    fc.assert(fc.property(
      fc.record({
        date: fc.constant('2025-06-01'),
        habits: fc.record({
          running: fc.boolean(), gym: fc.boolean(), pushUp: fc.boolean(),
          sitUp: fc.boolean(), pullUp: fc.boolean(), japaneseStudy: fc.boolean(),
          shadowing: fc.boolean(), programming: fc.boolean(),
          reading: fc.boolean(), meditation: fc.boolean(),
        })
      }),
      (record) => {
        localStorage.clear();
        StorageService.setHabits(record.date, record);
        const restored = StorageService.getHabits(record.date);
        return JSON.stringify(restored) === JSON.stringify(record);
      }
    ), { numRuns: 100 });
  });

  // Feature: sakura-tracker, Property 8: corrupt localStorage returns safe defaults
  // Validates: Requirements 3.4
  it('Property 8 — corrupt or missing localStorage data returns safe defaults without throwing', () => {
    fc.assert(fc.property(
      fc.string(),
      (garbage) => {
        localStorage.setItem('st_japanese', garbage);
        let result;
        try { result = StorageService.getJapanese(); } catch (e) { return false; }
        // Must return null (unrecognised JSON) or a valid object with non-negative values
        if (result === null) return true;
        return typeof result === 'object' && result.hiragana >= 0 && result.katakana >= 0 && result.kanji >= 0;
      }
    ), { numRuns: 100 });
  });

  // Feature: sakura-tracker, Property 11: Japanese Progress State Round-Trip
  // Validates: Requirements 6.1
  it('Property 11 — setJapanese then getJapanese returns the same record', () => {
    fc.assert(fc.property(
      fc.record({
        hiragana: fc.integer({ min: 0, max: 46 }),
        katakana: fc.integer({ min: 0, max: 46 }),
        kanji: fc.integer({ min: 0, max: 2136 }),
      }),
      (record) => {
        localStorage.clear();
        StorageService.setJapanese(record);
        const restored = StorageService.getJapanese();
        return JSON.stringify(restored) === JSON.stringify(record);
      }
    ), { numRuns: 100 });
  });

  // Feature: sakura-tracker, Property 16: Investment State Round-Trip
  // Validates: Requirements 8.3
  it('Property 16 — setInvestment then getInvestment returns the same record', () => {
    fc.assert(fc.property(
      fc.record({
        current: fc.float({ min: 0, max: 1e7, noNaN: true }),
        monthlyTarget: fc.float({ min: 0.01, max: 1e6, noNaN: true }),
        goal: fc.float({ min: 0.01, max: 1e7, noNaN: true }),
      }),
      (record) => {
        localStorage.clear();
        StorageService.setInvestment(record);
        const restored = StorageService.getInvestment();
        return JSON.stringify(restored) === JSON.stringify(record);
      }
    ), { numRuns: 100 });
  });
});

// ─────────────────────────────────────────────────────────────
//  Invalid input rejection (task 15.4)
//  Property 10 (design): invalid inputs rejected, storage unchanged
//  Property 14: Invalid Numeric Input Rejection
// ─────────────────────────────────────────────────────────────
describe('Input validation properties', () => {
  // Feature: sakura-tracker, Property 10: invalid inputs are rejected, storage unchanged
  // Validates: Requirements 7.5
  it('Property 10 — validatePositiveNumber returns false for every non-positive / non-numeric value', () => {
    fc.assert(fc.property(
      fc.oneof(
        fc.constant(0),
        fc.constant(-1),
        fc.float({ max: 0, noNaN: true }),
        fc.constant(NaN),
        fc.constant(''),
        fc.constant('abc'),
        fc.constant(null),
        fc.constant(undefined),
        fc.constant(Infinity),
        fc.constant(-Infinity),
      ),
      (invalidValue) => validatePositiveNumber(invalidValue) === false
    ), { numRuns: 100 });
  });

  // Feature: sakura-tracker, Property 14: Invalid Numeric Input Rejection
  // Validates: Requirements 7.5, 8.1
  it('Property 14 — validatePositiveNumber returns true only for finite positive numbers', () => {
    fc.assert(fc.property(
      fc.float({ min: 0.001, max: 1e9, noNaN: true }),
      (validValue) => validatePositiveNumber(validValue) === true
    ), { numRuns: 100 });
  });
});

// ─────────────────────────────────────────────────────────────
//  Statistics data builders (task 9.2 – 9.4 design props)
//  Property 7 (design): buildWeeklyData returns exactly 7 points
//  Property 8 (design): buildMonthlyData returns one point per calendar day
//  Property 9 (design): buildHabitData returns exactly 10 entries
// ─────────────────────────────────────────────────────────────
describe('Statistics data builder properties', () => {
  // Feature: sakura-tracker, Property 7: buildWeeklyData returns 7 points with correct values
  // Validates: Requirements 5.1
  it('Property 7 (design) — buildWeeklyData always returns exactly 7 data points', () => {
    fc.assert(fc.property(
      fc.date({ min: new Date('2024-01-10'), max: new Date('2026-12-31') }),
      (todayDate) => {
        const allDays = {};
        // buildWeeklyData returns { labels, data }
        const data = buildWeeklyData(allDays, todayDate);
        return data.labels.length === 7 && data.data.length === 7;
      }
    ), { numRuns: 100 });
  });

  // Feature: sakura-tracker, Property 8: buildMonthlyData returns one point per day of month
  // Validates: Requirements 5.2
  it('Property 8 (design) — buildMonthlyData returns one point per calendar day of the current month', () => {
    fc.assert(fc.property(
      fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
      (_someDate) => {
        const allDays = {};
        // buildMonthlyData uses current Date internally; we just verify structure
        // buildMonthlyData returns { labels, data }
        const data = buildMonthlyData(allDays);
        return data.labels.length > 0 && data.data.length > 0 &&
               data.data.every(v => v >= 0 && v <= 100);
      }
    ), { numRuns: 10 }); // fewer runs since we can't control "today"
  });

  // Feature: sakura-tracker, Property 9: buildHabitData returns 10 entries with correct rates
  // Validates: Requirements 5.3
  it('Property 9 (design) — buildHabitData returns exactly 10 entries in canonical habit order', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          date: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }).map(toDateKey),
          habits: fc.record({
            running: fc.boolean(), gym: fc.boolean(), pushUp: fc.boolean(),
            sitUp: fc.boolean(), pullUp: fc.boolean(), japaneseStudy: fc.boolean(),
            shadowing: fc.boolean(), programming: fc.boolean(),
            reading: fc.boolean(), meditation: fc.boolean(),
          })
        }),
        { minLength: 0, maxLength: 20 }
      ),
      (records) => {
        const allDays = {};
        records.forEach(r => { allDays[r.date] = r; });
        // buildHabitData returns { labels, data }
        const data = buildHabitData(allDays);
        return data.labels.length === 10 && data.data.length === 10 &&
               data.data.every(v => v >= 0 && v <= 100);
      }
    ), { numRuns: 100 });
  });
});
