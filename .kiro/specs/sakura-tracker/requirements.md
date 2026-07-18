# Requirements Document

## Introduction

Sakura Tracker is a modern productivity web application designed to help individuals stay disciplined daily while preparing to work in Japan. It provides a daily habit checklist, progress statistics, Japanese language learning progress tracking, running performance tracking, and investment goal monitoring — all persisted via LocalStorage and presented with a glassmorphism dark-mode UI built using HTML, CSS, and Vanilla JavaScript.

## Glossary

- **App**: The Sakura Tracker web application.
- **User**: The person using the App in a web browser.
- **Habit**: One of the ten fixed daily activities the User tracks completion of.
- **Daily_Checklist**: The list of ten Habits the User can check or uncheck each day.
- **Streak**: The count of consecutive calendar days on which the User completed all ten Habits.
- **Dashboard**: The top-level summary view showing date, Streak, total completed tasks, and today's progress percentage.
- **Progress_Bar**: A visual horizontal bar element that fills proportionally to a completion percentage.
- **Statistics_View**: The section displaying weekly, monthly, and habit-consistency charts.
- **Japanese_Progress**: The section displaying Hiragana, Katakana, and Kanji learning progress cards.
- **Running_Progress**: The section storing and displaying running distance, time, and average pace data.
- **Investment_Progress**: The section storing and displaying investment current value, monthly target, and goal data.
- **LocalStorage**: The browser-native key-value storage used to persist all App data.
- **Chart_Renderer**: The Chart.js-based component responsible for rendering all statistical charts.
- **Theme**: The visual design system (glassmorphism, dark mode, rounded cards, soft shadows, smooth animations).
- **Pace**: Average running pace expressed as minutes per kilometre.

---

## Requirements

### Requirement 1: Responsive Layout

**User Story:** As a User, I want the App to display correctly on desktop, tablet, and mobile screen sizes, so that I can use it on any device.

#### Acceptance Criteria

1. THE App SHALL render a functional, readable layout on viewport widths of at least 320 px (mobile), 768 px (tablet), and 1280 px (desktop), where "readable" means rendered text size is at least 12 px and interactive elements are at least 44 × 44 px.
2. WHEN the viewport width changes, THE App SHALL reflow its layout so that no horizontal scrollbar appears at any of the three breakpoints.
3. THE App SHALL use a single-column layout on mobile viewports (< 768 px) and a multi-column layout on tablet and desktop viewports (≥ 768 px).
4. WHEN any media element or card cannot fit its column at a given breakpoint, THE App SHALL constrain that element to the column width without cropping its content.
5. ON mobile viewports (< 768 px), THE App navigation SHALL stack vertically and each navigation item SHALL have a minimum tap-target height of 44 px.

---

### Requirement 2: Dashboard Summary

**User Story:** As a User, I want a Dashboard at the top of the page showing today's date, my current Streak, total completed tasks, and today's progress percentage, so that I can see my overall status at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL display today's date formatted as "Day, DD Month YYYY" (e.g. "Monday, 01 January 2025").
2. THE Dashboard SHALL display the current Streak as a whole number of consecutive fully-completed past calendar days (days on which all ten Habits were checked); today is excluded from the Streak count while it is still in progress. If no fully-completed past day exists, Streak SHALL display 0.
3. THE Dashboard SHALL display the total number of individual Habit checks recorded across all stored days in LocalStorage (i.e. the sum of checked Habits for every day stored).
4. THE Dashboard SHALL display today's progress as an integer percentage calculated as floor((number of Habits checked today ÷ 10) × 100).
5. WHEN the User opens the App, THE Dashboard SHALL update all four summary values by reading from LocalStorage before rendering.
6. WHEN the App is opened for the first time and LocalStorage contains no data, THE Dashboard SHALL display Streak = 0, total completions = 0, and today's progress = 0 %.
7. IF LocalStorage data is corrupted or unreadable, THE Dashboard SHALL display Streak = 0, total completions = 0, and today's progress = 0 % without throwing a runtime error.

---

### Requirement 3: Daily Habit Checklist

**User Story:** As a User, I want a Daily Habit Checklist with the ten fixed Habits, so that I can mark each one done and track my day.

#### Acceptance Criteria

1. THE Daily_Checklist SHALL display exactly ten Habits in the following order: Running, Gym, Push Up, Sit Up, Pull Up, Japanese Study, Shadowing, Programming, Reading, Meditation.
2. WHEN the User checks a Habit, THE Daily_Checklist SHALL mark that Habit as completed and persist the checked state for today's date in LocalStorage.
3. WHEN the User unchecks a Habit, THE Daily_Checklist SHALL mark that Habit as incomplete and persist the unchecked state for today's date in LocalStorage.
4. WHEN the User opens the App on a given calendar date, THE Daily_Checklist SHALL restore the checked state for each Habit from LocalStorage for that date. IF no LocalStorage record exists for that date, THE Daily_Checklist SHALL display all Habits as unchecked.
5. WHEN the User opens the App and the current calendar date differs from the last recorded date in LocalStorage, THE Daily_Checklist SHALL display all Habits as unchecked for the new date.
6. IF a LocalStorage write fails when persisting a check or uncheck, THE Daily_Checklist SHALL reflect the interaction visually and display an error indicator to the User without reverting the prior persisted state.

---

### Requirement 4: Today's Progress Bar

**User Story:** As a User, I want a Progress Bar showing today's completion percentage, so that I can see how close I am to finishing all Habits.

#### Acceptance Criteria

1. THE Progress_Bar SHALL display a fill level equal to floor((number of Habits checked today ÷ 10) × 100) percent.
2. WHEN the User checks or unchecks a Habit, THE Progress_Bar SHALL update its fill level within 300 milliseconds without a page reload.
3. THE Progress_Bar SHALL display a numeric label showing the fraction of completed Habits (e.g. "7 / 10") alongside the integer percentage value.
4. WHEN zero Habits are checked, THE Progress_Bar SHALL display a fill level of 0 % and the label "0 / 10".

---

### Requirement 5: Statistics Charts

**User Story:** As a User, I want to see weekly completion, monthly completion, and habit-consistency charts, so that I can understand my long-term discipline trends.

#### Acceptance Criteria

1. THE Statistics_View SHALL render a weekly completion chart using Chart_Renderer showing the daily completion percentage for each of the last 7 calendar days.
2. THE Statistics_View SHALL render a monthly completion chart using Chart_Renderer showing the daily completion percentage for each day of the current calendar month.
3. THE Statistics_View SHALL render a habit-consistency chart using Chart_Renderer showing the completion rate (0–100 %) for each of the ten Habits across all stored data.
4. WHEN the User opens the Statistics_View, THE Chart_Renderer SHALL read data from LocalStorage and render all three charts before displaying them to the User.
5. IF no data exists in LocalStorage for a given day or Habit, THEN THE Chart_Renderer SHALL render a value of 0 % for that data point without displaying an error.
6. WHEN LocalStorage data changes (e.g. after checking a Habit), THE Statistics_View SHALL reflect updated data the next time it is opened or refreshed by the User.

---

### Requirement 6: Japanese Progress Cards

**User Story:** As a User, I want three Japanese Progress cards (Hiragana, Katakana, Kanji) each with a Progress Bar, so that I can track how much of each writing system I have mastered.

#### Acceptance Criteria

1. THE Japanese_Progress SHALL display three separate cards: one for Hiragana, one for Katakana, and one for Kanji.
2. EACH Japanese_Progress card SHALL contain a numeric input for the User to enter the number of characters mastered, bounded as an integer in the range 0 to the fixed total for that writing system (Hiragana: 46, Katakana: 46, Kanji: 2136). The total values SHALL be read-only reference constants, not editable by the User.
3. EACH Japanese_Progress card SHALL display a Progress_Bar filled to floor((characters mastered ÷ fixed total) × 100) percent, clamped to 0–100 %.
4. IF characters mastered is 0 or the fixed total is 0, THE Japanese_Progress card SHALL display a Progress_Bar fill of 0 % without a division-by-zero error.
5. WHEN the User updates the mastered value in a Japanese_Progress card, THE Japanese_Progress SHALL recalculate and re-render the Progress_Bar within 100 milliseconds.
6. THE Japanese_Progress SHALL persist each card's mastered value in LocalStorage so that it is restored on the next App load. Fixed totals are constants and SHALL NOT be persisted.
7. IF LocalStorage data for Japanese_Progress is missing or corrupt on App load, THE Japanese_Progress SHALL initialise all three cards with a mastered value of 0 without throwing a runtime error.

---

### Requirement 7: Running Progress Tracker

**User Story:** As a User, I want to log my running sessions with distance, time, and pace, and see a pace-improvement line chart, so that I can monitor my running performance over time.

#### Acceptance Criteria

1. THE Running_Progress SHALL provide an input form with fields for Distance (km, positive decimal), Time (minutes, positive decimal), and Date (calendar date picker defaulting to today) for each running session.
2. WHEN the User submits a running session, THE Running_Progress SHALL calculate Average Pace as (Time ÷ Distance) minutes/km and store the session record (date, distance, time, pace) as a JSON object in LocalStorage.
3. THE Running_Progress SHALL display a line chart rendered by Chart_Renderer showing Average Pace (y-axis, minutes/km) against Date (x-axis) for all stored sessions in ascending chronological order.
4. WHEN a new session is saved, THE Running_Progress SHALL update the line chart within 500 milliseconds without a page reload.
5. IF the User submits a session with Distance ≤ 0 or Time ≤ 0 or either field is empty or non-numeric, THEN THE Running_Progress SHALL display an inline validation error message adjacent to the offending field and SHALL NOT save the session to LocalStorage.
6. IF no running sessions exist in LocalStorage, THE Running_Progress SHALL render an empty chart with labelled axes and a "No sessions logged yet" placeholder message.

---

### Requirement 8: Investment Progress Tracker

**User Story:** As a User, I want to track my current investment value, monthly target, and overall investment goal, and see a Progress Bar, so that I can stay on track with my financial discipline.

#### Acceptance Criteria

1. THE Investment_Progress SHALL provide input fields for Current Investment (numeric, non-negative), Monthly Target (numeric, positive), and Goal (numeric, positive). IF the User enters a negative value or non-numeric text in any field, THE Investment_Progress SHALL display an inline validation error and SHALL NOT update the stored values.
2. THE Investment_Progress SHALL display a Progress_Bar filled to floor((Current Investment ÷ Goal) × 100) percent, clamped to 0–100 %. IF Goal is 0, THE Investment_Progress SHALL display 0 % without a division-by-zero error.
3. THE Investment_Progress SHALL display the monthly-target percentage as floor((Current Investment ÷ Monthly Target) × 100), capped at 100 %. IF Monthly Target is 0, THE Investment_Progress SHALL display 0 % without a division-by-zero error.
4. WHEN the User updates any Investment_Progress field with a valid value, THE Investment_Progress SHALL recalculate and re-render all values and the Progress_Bar within 300 milliseconds.
5. THE Investment_Progress SHALL persist all three values in LocalStorage so that they are restored on the next App load. IF LocalStorage data is missing or corrupt on load, THE Investment_Progress SHALL initialise all three fields to 0 without throwing a runtime error.
6. IF Current Investment is greater than or equal to Goal and Goal is greater than 0, THEN THE Investment_Progress SHALL display the Progress_Bar at 100 % and show a visible "Goal Reached" indicator.

---

### Requirement 9: Glassmorphism Dark-Mode Theme

**User Story:** As a User, I want the App to have a modern glassmorphism dark-mode appearance with smooth animations, rounded cards, and soft shadows, so that the interface feels premium and motivating.

#### Acceptance Criteria

1. THE Theme SHALL apply a dark background (luminance < 20 % of full white) as the base colour for all pages.
2. THE Theme SHALL render all cards with a semi-transparent frosted-glass background using CSS `backdrop-filter: blur` with a background-color opacity between 0.05 and 0.25, rounded corners (border-radius ≥ 12 px), and a drop shadow with a blur radius between 8 px and 32 px.
3. THE Theme SHALL apply smooth CSS transitions with duration between 150 ms and 400 ms to all interactive elements including checkbox state changes, Progress_Bar fills, and button hover states.
4. THE Theme SHALL remain consistent (dark mode, glassmorphism styling) without a manual toggle — dark mode is always active.

---

### Requirement 10: Separate Source Files and Code Quality

**User Story:** As a developer, I want the App code split into separate `index.html`, `style.css`, and `script.js` files with clear comments, so that the codebase is maintainable and easy to understand.

#### Acceptance Criteria

1. THE App SHALL be implemented in exactly three files: `index.html`, `style.css`, and `script.js`.
2. THE App SHALL load Chart.js from a CDN `<script>` tag in `index.html` and SHALL NOT embed or inline the Chart.js library source code in any of the three files.
3. THE `script.js` file SHALL contain section comments — each being a single-line or block comment whose text is solely the section name — delimiting each of the following major feature areas in order: Dashboard, Daily Checklist, Statistics, Japanese Progress, Running Progress, Investment Progress.
4. THE `style.css` file SHALL contain section comments delimiting each of the following style blocks in order: Reset/Base, Layout, Navigation, Dashboard, Daily Checklist, Statistics, Japanese Progress, Running Progress, Investment Progress.
5. THE App SHALL not rely on any JavaScript framework, library, or build tool other than Chart.js.
