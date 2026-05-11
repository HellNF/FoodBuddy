# Insight Engine + Data Reliability — Design (Sub-project 1)

**Date:** 2026-05-11
**Status:** Approved (brainstorming)
**Part of:** "LifeBuddy intelligence" — a 3-part effort. SP1 = this doc. SP2 = adaptive targets & smart suggestions. SP3 = check-in flows & dashboard cohesion. Each sub-project gets its own spec → plan → implementation cycle.

## Goal

Add an intelligence layer that reads data across all existing modules (food diary, sleep, mood, habits, focus, tasks, workouts, weight, energy, water) and surfaces meaningful, honest insights: cross-module correlations, trends, anomalies, and milestones. Because food logging is often imprecise, every nutrition-involving analysis must be reliability-aware and the user must be able to exclude nutrition entirely.

Non-goals for SP1 (deferred to SP2/SP3): adaptive TDEE/calorie targets, smart food suggestions, time-of-day reminders, morning/evening check-in flows, dashboard reorganization. SP1 only adds one `InsightCard` to the existing bento dashboard.

## Architecture

All computation runs in the **main process** (Node, direct `better-sqlite3` access, no UI blocking). New module follows the established IPC + types + api + page + dashboard-card pattern.

```
main/ipc/insights.ipc.js          IPC handlers (insights:get, insights:setDayReliability)
main/lib/insights/
  dailyFacts.js                   builds one normalized row per date with every signal
  reliability.js                  heuristic food-day reliability scoring + manual override read
  correlations.js                 Pearson + lag analysis over signal pairs (pairwise NA drop)
  trends.js                       rolling means, linear regression, sleep debt accumulation
  anomalies.js                    today/yesterday vs 28-day baseline (z-score)
  insightBuilder.js               assembles raw results into ranked Insight[] with rendered text
  templates.js                    template strings per insight type (Italian + i18n keys)
src/pages/InsightsPage.tsx        dedicated page (grouped by module, scatter mini-charts)
src/components/dashboard/InsightCard.tsx   "insight of the day" bento card
src/api.ts                        window.api.insights.* wrappers
src/types.ts                      Insight, DailyFacts, DayReliability types
src/i18n/translations.ts          new keys
```

**Data flow:** page/dashboard calls `insights:get({ window })` → main builds `DailyFacts[]` → feeds correlations + trends + anomalies → `insightBuilder` filters (significance + reliability gates), ranks by relevance, renders text via `templates` → returns `Insight[]`. Computed on demand; in-memory cache keyed by `{window, settingsHash}` with a short TTL and invalidation on relevant mutations (any write to log/sleep_log/mood_log/habit_logs/focus_sessions/tasks/workout_sessions/weight_log/daily_energy/water_log). Default window = 90 days.

**Structured output:** every `Insight` carries machine-readable evidence alongside rendered text, so a future LLM layer (SP "B+") can consume it without recomputing:

```ts
type Insight = {
  id: string;                     // stable per type+subject, for deterministic daily rotation
  type: 'correlation' | 'trend' | 'anomaly' | 'milestone';
  severity: 'info' | 'notice' | 'strong';
  score: number;                  // ranking score, see Ranking
  subject: string;                // e.g. "sleep→mood"
  relatedModules: string[];       // e.g. ["sleep", "mood"]
  evidence: {
    n?: number;                   // sample size after NA drop
    r?: number;                   // Pearson coefficient
    lag?: 0 | 1;                  // days
    slope?: number;               // regression slope (units/day)
    zScore?: number;
    reliabilityBasis?: number;    // # reliable days used (nutrition insights only)
  };
  text: string;                   // rendered, localized
  actionHint?: string;            // optional short suggestion
};
```

## DailyFacts model

One in-memory row per date over the window. Columns normalized; anything missing stays `null`. Every analysis drops rows that are `null` **on the columns it uses** (pairwise), so a gap in sleep data does not zero out a food↔mood analysis.

| Field | Source | Notes |
|---|---|---|
| `date`, `dow`, `isWeekend` | the date | for weekly patterns |
| `sleepMin`, `sleepQuality` | `sleep_log` | quality 1–5 |
| `bedtimeHour`, `wakeHour` | `sleep_log` | parsed to decimal hour |
| `sleepDebtMin` | derived | rolling 7-day deficit vs `insights.sleepTargetMin` |
| `mood`, `energy`, `stress` | `mood_log` | 1–5 |
| `kcalIn`, `protein`, `carbs`, `fat`, `fiber` | `log` + `foods` | only `status='logged'` |
| `kcalOut`, `activeKcal`, `steps` | `daily_energy` | |
| `kcalBalance` | derived | `kcalIn - kcalOut` |
| `mealCount`, `firstMealHour`, `lastMealHour`, `hasBreakfast` | `log` | for reliability + meal-timing patterns |
| `workoutDone`, `workoutMin`, `perceivedEffort` | `workout_sessions` + `exercises` | |
| `tasksPlanned`, `tasksDone`, `taskCompletionPct` | `tasks` | |
| `habitsTracked`, `habitsDone`, `habitPct` | `habit_logs` | |
| `focusMin`, `focusSessions` | `focus_sessions` | completed sessions |
| `waterMl` | `water_log` | |
| `weight`, `weightTrend` | `weight_log` | trend = EMA (smoothing ~0.1) |
| `foodReliability` | `reliability.js` | `'precise' \| 'approx' \| 'none'` + `manualOverride: bool` |

## Food-day reliability

`reliability.js` computes a per-day level (auto-detect with manual override).

**Auto rules (in order):**
- `none` — 0 logged items, or `kcalIn === 0`.
- `approx` — at least one red flag:
  - `kcalIn < 1000` or `kcalIn > 5000`
  - `mealCount <= 1`
  - no breakfast logged and `firstMealHour > 13`
  - every logged item has the same round gram amount (e.g. all 100 g → lazy estimate)
  - `kcalIn` deviates more than ±50% from the user's reliable-day personal mean (computed over the window)
- `precise` — otherwise.

**Manual override:** new table

```sql
CREATE TABLE IF NOT EXISTS food_day_reliability (
  date TEXT PRIMARY KEY,
  level TEXT NOT NULL,            -- 'precise' | 'approx' | 'none'
  source TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`source='manual'` always wins over the auto level. Created in `main/db.js` migrations block. UI: a clickable pill in `DiaryTable` and the dashboard ("📊 preciso ▾" → preciso / approssimativo / non loggato), wired through `insights:setDayReliability({ date, level })`.

**Gating:** any correlation/trend/anomaly that uses a nutrition field (`kcalIn`, macros, `kcalBalance`, meal-timing) uses **only** `precise` days by default. If `insights.includeApproxDays` is on, it also uses `approx` days. The rendered text always states the basis: "su 23 giorni affidabili". If `insights.useNutrition` is off, all nutrition pairs are skipped entirely and no reliability badges show anywhere.

## Insight engine

### 1. Correlation with lag
Over a curated whitelist of ~15 signal pairs, compute Pearson at lag 0 and lag +1 day. Initial whitelist:

- sleepMin → mood (lag 0, +1)
- sleepQuality → mood (0, +1)
- sleepMin → kcalIn (0)
- sleepMin → focusMin (0)
- stress → sleepQuality (0, same night)
- workoutDone → mood (+1)
- workoutMin → energy (+1)
- habitPct → energy (0)
- habitPct → mood (0)
- kcalBalance → weightTrend (0, weekly aggregate)
- steps → mood (0)
- lastMealHour → sleepQuality (0)
- focusMin → mood (0)
- taskCompletionPct → mood (0)
- waterMl → energy (0)

Keep a result if `|r| >= insights.minPairCorr` (default 0.35) **and** `n >= insights.minPairN` (default 14). Severity: `strong` if `|r| >= 0.55 && n >= 21`, `notice` if `|r| >= 0.45`, else `info`. Nutrition pairs additionally require `reliabilityBasis >= minPairN`.

### 2. Trend
Linear regression over the trailing 30 days (drop NA per series):
- weight: kg/week + ETA to goal weight (if a weight goal exists in settings)
- mood / energy / stress: rising or falling
- sleep debt: accumulated minutes over the window
- task completion %, habit %: rising or falling

Keep if slope is non-trivial relative to series spread (|slope·30| > 0.5·SD) and `n >= 14`.

### 3. Anomaly
For today and yesterday vs a 28-day baseline (mean ± SD over reliable days where nutrition is involved): z-score > 2 on `sleepMin`, `kcalIn`, `kcalBalance`, `mood`, `energy`, `stress`, `steps`. Combine adjacent-day anomalies into one insight when they form a story ("Ieri 1.200 kcal sotto la tua media — e oggi umore 2/5"). Anomalies older than 2 days are not surfaced.

### 4. Milestone
Reuse existing streak data (`streaks.ipc.js` / `streak-utils.js`); surface only the top current streaks/milestones, capped at 2, lower priority than the above.

### Ranking
`score = severityWeight × recencyFactor × actionability`
- `severityWeight`: strong = 3, notice = 2, info = 1
- `recencyFactor`: anomalies (today/yesterday) get a boost; correlations/trends use a flat factor
- `actionability`: pairs with an `actionHint` get ×1.3

Dashboard `InsightCard` shows exactly one insight, chosen deterministically by day: `topN = insights sorted by score, take 5; pick index = (epochDay) % len(topN)` — so it rotates daily but is stable within a day. `InsightsPage` shows all insights grouped by `relatedModules`, each correlation rendered with a small scatter mini-chart (reuse `Sparkline`/a tiny scatter component) and the reliability basis badge.

## Settings (new keys in `settings` table)

| Key | Type | Default | Effect |
|---|---|---|---|
| `insights.enabled` | bool | `true` | master switch; off ⇒ no card, no page content |
| `insights.useNutrition` | bool | `true` | off ⇒ drop all nutrition pairs + hide reliability badges |
| `insights.includeApproxDays` | bool | `false` | include `approx` days in nutrition analyses |
| `insights.minPairN` | int | `14` | min sample size for a correlation |
| `insights.minPairCorr` | float | `0.35` | min `|r|` for a correlation |
| `insights.sleepTargetMin` | int | `480` | target sleep for sleep-debt calc |

Surfaced in `SettingsPage` under a new "Insights" section.

## Performance & privacy
Fully local. 90-day window ⇒ ≤ ~90 rows, all math O(n) or O(pairs·n) ⇒ well under ~5 ms. In-memory cache with TTL + mutation invalidation avoids recompute on every dashboard mount.

## Testing
Unit tests (existing test runner; fixtures = synthetic in-memory DB seeded with known patterns):
- `dailyFacts`: merge across tables, null handling, derived fields (`kcalBalance`, `bedtimeHour` parsing, `weightTrend` EMA).
- `reliability`: each red flag triggers `approx`; `none` conditions; manual override beats auto.
- `correlations`: Pearson against a hand-computed value; lag shift correctness; pairwise NA drop (gap in one series doesn't break the pair); below-threshold results excluded.
- `trends`: regression slope on a synthetic linear series; sleep-debt accumulation.
- `anomalies`: z-score detection on an injected spike; baseline excludes unreliable days.
- `insightBuilder`: threshold filtering, ranking order, deterministic daily pick, `useNutrition=off` removes nutrition insights, `includeApproxDays` changes `n`.
- Integration: seed a DB with an injected pattern ("poor sleep → +250 kcal next-ish day") and assert the engine produces the matching correlation insight with correct sign and a plausible `n`.

## Open items for the implementation plan
- Confirm the test runner/setup actually present in the repo (scripts dir / package.json) and match its conventions.
- Confirm exact column/parse details for `bedtime`/`wake_time` formats stored in `sleep_log`.
- Decide the i18n key namespace prefix (`insights.*`).
