# Insight Engine + Data Reliability — Design (Sub-project 1)

**Date:** 2026-05-11
**Status:** Approved (brainstorming) — revised after critical review
**Part of:** "LifeBuddy intelligence" — a 3-part effort. SP1 = this doc. SP2 = adaptive targets & smart suggestions. SP3 = check-in flows & dashboard cohesion. Each sub-project gets its own spec → plan → implementation cycle.

## Goal

Add an intelligence layer that reads data across all existing modules (food diary, sleep, mood, habits, focus, tasks, workouts, weight, energy, water) and surfaces meaningful, **statistically honest** insights: cross-module associations, trends, anomalies, and milestones. Because food logging is often imprecise, every nutrition-involving analysis must be reliability-aware and the user must be able to exclude nutrition entirely. Because most users won't have months of data, the experience must be useful from day one.

Non-goals for SP1 (deferred to SP2/SP3): adaptive TDEE/calorie targets, smart food suggestions, time-of-day reminders, morning/evening check-in flows, dashboard reorganization. Also deferred: free-text mining of `note` fields (mood/sleep/workout notes) — needs its own treatment. SP1 only adds one `InsightCard` to the existing bento dashboard plus the `InsightsPage`.

## Design principles (from the critical review)

1. **No fake discoveries.** Likert scales (mood/energy/stress 1–5) are ordinal → use **Spearman ρ**, not Pearson, for any pair involving them; Pearson only for genuinely continuous pairs (kcal, minutes, steps, weight). Every association is tested for significance with a **permutation test** (shuffle one series N=2000 times, p = fraction of |ρ_shuffled| ≥ |ρ_observed|), and the family of tests gets **Benjamini–Hochberg FDR** correction. Nothing surfaces unless it survives FDR at q = 0.10. This is the single most important property of the engine.
2. **Honest about confounders.** Day-of-week is a known common cause (weekends move sleep, mood, and intake together). For each association we also compute the **partial association controlling for weekend** (residualize both series on `isWeekend`, then re-correlate). If the association vanishes when controlling for weekend, we either drop it or label it explicitly as "spiegato dal weekend".
3. **Correlation, not causation, in the copy.** Templates never use causal arrows. They say "associato a" / "nei giorni in cui… tende a…". A standing footnote on the Insights page explains correlation ≠ causation.
4. **Speak in contrasts, not coefficients.** The headline of an association insight is a concrete group comparison ("nei giorni con 7h+ di sonno il tuo umore medio è 3.8, contro 2.9 negli altri — su 23 giorni affidabili"), with the scatter + ρ/p as supporting detail, not the lede.
5. **Useful from day one.** A tiered system: single-module trends and milestones need little data and appear early; cross-module associations need more and appear later. The empty/low-data state is a first-class design, not an afterthought.
6. **Cheap recompute over fragile caching.** The whole computation is a few ms over ≤180 rows; we do not sprinkle cache-invalidation calls across every IPC handler. One in-memory memo keyed by a global `dataVersion` counter (bumped by a single shared write hook) is the only caching, and it's optional.

## Architecture

All computation runs in the **main process** (Node, direct `better-sqlite3` access, no UI blocking). New module follows the established IPC + types + api + page + dashboard-card pattern.

```
main/ipc/insights.ipc.js          IPC handlers (insights:get, insights:setDayReliability)
main/lib/insights/
  dailyFacts.js                   builds one normalized row per date with every signal
  reliability.js                  heuristic food-day reliability scoring + manual override read
  stats.js                        spearman, pearson, permutationTest, benjaminiHochberg,
                                  residualizeOnWeekend, linearRegression, groupContrast
  associations.js                 runs the curated pair list through stats, returns survivors
  trends.js                       single-series regressions, sleep-debt accumulation
  anomalies.js                    today/yesterday vs trailing baseline (robust z via MAD)
  factorAnalysis.js               sleep_log.factors tag → quality/duration contrasts;
                                  perceived_effort → next-day mood/energy contrasts
  insightBuilder.js               assembles + ranks + renders Insight[]; handles cold-start tiering
  templates.js                    template strings per insight type (Italian copy + i18n keys)
src/pages/InsightsPage.tsx        dedicated page (grouped by module; scatter mini-charts; cold-start state)
src/components/dashboard/InsightCard.tsx   "insight of the day" bento card (incl. low-data variant)
src/api.ts                        window.api.insights.* wrappers
src/types.ts                      Insight, DailyFacts, DayReliability types
src/i18n/translations.ts          new keys under insights.*
```

**Data flow:** page/dashboard calls `insights:get({ window })` → main builds `DailyFacts[]` → `dataQuality` summary (how many days, per-signal coverage, # reliable food days) → runs `trends`, `anomalies`, `factorAnalysis`, and `associations` (which internally does permutation + FDR + weekend control) → `insightBuilder` filters by tier-appropriate gates, ranks, renders → returns `{ insights: Insight[], dataQuality }`. Computed on demand; optional memo keyed by `dataVersion`. Default window = 90 days (configurable); analyses that need it can look back further for context (e.g. weight EMA seed).

**Structured output** — every `Insight` carries machine-readable evidence so a future LLM layer can consume it without recomputing:

```ts
type Insight = {
  id: string;                     // stable per type+subject, for deterministic daily rotation & dedup
  type: 'association' | 'trend' | 'anomaly' | 'factor' | 'milestone';
  tier: 1 | 2 | 3;                // 1 = low-data (trend/milestone), 2 = factor/anomaly, 3 = cross-module association
  severity: 'info' | 'notice' | 'strong';
  score: number;                  // ranking score, see Ranking
  subject: string;                // e.g. "sleepMin~mood"
  relatedModules: string[];       // e.g. ["sleep", "mood"]
  period: { from: string; to: string };
  evidence: {
    n?: number;                   // sample size after pairwise NA drop
    rho?: number;                  // Spearman (ordinal pairs)
    r?: number;                    // Pearson (continuous pairs)
    pValue?: number;               // permutation-test p
    qValue?: number;               // FDR-adjusted
    lag?: 0 | 1 | 2;               // days, when applicable
    weekendControlled?: { rho?: number; r?: number; survived: boolean };
    contrast?: { highLabel: string; highMean: number; lowLabel: string; lowMean: number; unit: string };
    slope?: number;                // trend: units/day
    zScore?: number;               // anomaly (robust)
    reliabilityBasis?: number;     // # reliable food days used (nutrition insights only)
  };
  confidence: 'low' | 'medium' | 'high';   // derived from p/q, n, and weekend-control survival
  text: string;                   // rendered, localized; contrast-led, non-causal
  actionHint?: string;            // optional; drawn from a small fixed subject→hint map (see Action hints)
};

type DataQuality = {
  windowDays: number;
  daysWithAnyData: number;
  perSignalCoverage: Record<string, number>;   // 0..1 per DailyFacts column
  reliableFoodDays: number;
  tierUnlocked: 1 | 2 | 3;        // highest tier that has enough data to produce anything
};
```

## DailyFacts model

One in-memory row per date over the window. Columns normalized; anything missing stays `null`. Every analysis drops rows that are `null` **on the columns it uses** (pairwise). For lagged pairs, the shift is by **calendar date** (yesterday = date − 1 day), not by row index — rows with no data on the needed neighbouring date are dropped, so a gap never produces a phantom "+1 day" pair.

| Field | Source | Notes |
|---|---|---|
| `date`, `dow`, `isWeekend` | the date | weekend = Sat/Sun (locale-aware later; fixed for now) |
| `sleepMin`, `sleepQuality` | `sleep_log` | quality 1–5 (ordinal) |
| `bedtimeHour`, `wakeHour` | `sleep_log` | parsed to decimal hour; format confirmed in plan |
| `sleepFactors` | `sleep_log.factors` | parsed to a string[] of tags |
| `sleepDebtMin` | derived | trailing 7-day deficit vs `insights.sleepTargetMin` |
| `mood`, `energy`, `stress` | `mood_log` | 1–5 (ordinal) |
| `kcalIn`, `protein`, `carbs`, `fat`, `fiber` | `log` + `foods` | only `status='logged'` |
| `kcalOut`, `activeKcal`, `steps` | `daily_energy` | |
| `kcalBalance` | derived | `kcalIn - kcalOut` |
| `mealCount`, `firstMealHour`, `lastMealHour`, `hasBreakfast` | `log` | reliability + meal-timing patterns |
| `gramRoundness` | `log` | fraction of items whose grams are a round multiple of 50; for reliability |
| `workoutDone`, `workoutMin`, `perceivedEffort` | `workout_sessions` + `exercises` | |
| `tasksPlanned`, `tasksDone`, `taskCompletionPct` | `tasks` | |
| `habitsTracked`, `habitsDone`, `habitPct` | `habit_logs` | |
| `focusMin`, `focusSessions` | `focus_sessions` | completed |
| `waterMl` | `water_log` | |
| `weight`, `weightTrend` | `weight_log` | trend = EMA (α ≈ 0.1), seeded from data before the window if available |
| `foodReliability` | `reliability.js` | `'precise' \| 'approx' \| 'none'` + `manualOverride: bool` |

## Food-day reliability

`reliability.js` computes a per-day level (auto-detect + manual override). To avoid the bootstrap circularity ("reliable" depending on a mean over "reliable days"), reliability is a **two-pass** computation:

- **Pass A — structural flags only** (no reference to any personal mean): a day is `none` if 0 logged items or `kcalIn === 0`; `approx` if any of: `kcalIn < 1000` or `kcalIn > 5000`; `mealCount <= 1`; no breakfast and `firstMealHour > 13`; `gramRoundness >= 0.8` (almost everything entered as round 50 g multiples → lazy estimate); otherwise `precise`.
- **Pass B — personal-deviation flag**: compute the **median** `kcalIn` over Pass-A `precise` days. Any Pass-A `precise` day whose `kcalIn` deviates > ±50% from that median is downgraded to `approx`. (Median, not mean; computed only over already-clean days; one pass, no iteration.)

**Manual override:**

```sql
CREATE TABLE IF NOT EXISTS food_day_reliability (
  date TEXT PRIMARY KEY,
  level TEXT NOT NULL,            -- 'precise' | 'approx' | 'none'
  source TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`source='manual'` always wins. Created in `main/db.js` migrations block. UI: a clickable pill in `DiaryTable` and the dashboard ("📊 preciso ▾" → preciso / approssimativo / non loggato), wired through `insights:setDayReliability({ date, level })`. Setting it back to the auto value deletes the override row.

**Gating:** any association/trend/anomaly using a nutrition field (`kcalIn`, macros, `kcalBalance`, meal-timing) uses **only** `precise` days by default; `approx` days included only if `insights.includeApproxDays`. Rendered text always states the basis ("su 23 giorni affidabili"). If `insights.useNutrition` is off: all nutrition pairs skipped, no reliability badges anywhere.

## Statistics core (`stats.js`)

- `spearman(x, y)` / `pearson(x, y)` — pairwise complete observations only.
- `permutationTest(x, y, corrFn, iters=2000)` → `{ stat, pValue }`. Seeded RNG for test determinism.
- `benjaminiHochberg(pvalues[], q=0.10)` → boolean[] of which survive, plus adjusted q-values.
- `residualizeOnWeekend(series, isWeekendFlags)` → series with the weekend group-mean removed; used to recompute the association controlling for weekend.
- `linearRegression(t, y)` → `{ slope, intercept, r2, sd }` over complete points; `t` in days from window start.
- `robustZ(value, baseline[])` → `(value − median) / (1.4826 · MAD)`.
- `groupContrast(values, mask)` → `{ highMean, lowMean, highN, lowN }` for the contrast-led copy. For an ordinal split, `mask` is "above the personal median of the predictor" (or a natural cutoff like sleep ≥ 7h where one exists).

## Insight engine

### Tiering (cold-start)
- **Tier 1 — needs ≥ 5 days of a single signal:** single-module trends (mood/energy/stress direction, weight kg/week + ETA to goal, sleep-debt, task/habit completion direction) and milestones (top current streaks). Available almost immediately.
- **Tier 2 — needs ≥ 10 days:** anomalies (today/yesterday vs ≥10-day robust baseline) and factor analysis (`sleepFactors` tag contrasts; `perceivedEffort` → next-day mood/energy) once a tag/value has ≥ 6 occurrences.
- **Tier 3 — needs ≥ 21 paired days surviving NA drop (and ≥ `minPairN` reliable days for nutrition pairs):** cross-module associations with permutation + FDR + weekend control.

`DataQuality.tierUnlocked` tells the UI how far we are. Below Tier 1 (essentially first run), the Insights page shows a "what I'll learn as you log" explainer listing the signals being tracked and roughly how many days each insight type needs.

### 1. Associations (Tier 3)
Curated whitelist of signal pairs; for each, candidate lags depend on the pair (most: lag 0; sleep→mood and workout→mood/energy: 0, 1, 2; intake→weightTrend: weekly aggregate). For each (pair, lag): pick `spearman` if either series is ordinal else `pearson`; run `permutationTest`; also compute the weekend-controlled statistic. Collect all candidates' p-values, apply `benjaminiHochberg(q=0.10)`. A candidate becomes an Insight only if it survives FDR **and** `n ≥ 21` (and reliability basis ≥ `minPairN` for nutrition). Among lags that survive for the same pair, keep the strongest. `severity`: `strong` if survives weekend control and |ρ|≥0.5 and n≥28; `notice` if survives weekend control; `info` if it only survives uncontrolled (text says "potrebbe essere spiegato dal weekend"). `confidence` from q-value + n + weekend survival. Headline = `groupContrast`.

Initial whitelist (≈14 pairs): sleepMin~mood, sleepQuality~mood, sleepMin~kcalIn, sleepMin~focusMin, stress~sleepQuality, workoutDone~mood, workoutMin~energy, habitPct~energy, habitPct~mood, kcalBalance~weightTrend (weekly), steps~mood, lastMealHour~sleepQuality, focusMin~mood, taskCompletionPct~mood, waterMl~energy.

### 2. Trends (Tier 1)
`linearRegression` over the trailing 30 days (or all available if fewer, down to 5), per series, NA-dropped: weight (kg/week + ETA to goal weight if a weight goal exists in settings), mood/energy/stress (rising/falling), sleep debt (accumulated), task completion %, habit %. Keep if `|slope · span| > 0.5 · sd` and `n ≥ 5`. Lower confidence when `n < 14` and copy says "presto" / "ancora pochi dati".

### 3. Anomalies (Tier 2)
For today and yesterday vs the trailing baseline (≥10 days; reliable-only when nutrition is involved): `robustZ` > 2.5 on `sleepMin`, `kcalIn`, `kcalBalance`, `mood`, `energy`, `stress`, `steps`. Adjacent-day anomalies are merged into one narrative insight when they relate ("Ieri ~1.200 kcal sotto la tua media — e oggi umore 2/5"). Anomalies older than 2 days are not surfaced.

### 4. Factor analysis (Tier 2)
- `sleepFactors`: for each tag with ≥ 6 nights, `groupContrast` on `sleepQuality` and `sleepMin` (nights with tag vs without). Keep if the contrast exceeds a min effect (≥ 0.5 on quality, or ≥ 25 min) — no FDR here because the sample is the user's own labels, but report `n` and frame as descriptive ("le notti che hai etichettato 'caffè tardi': qualità media 2.6 vs 3.8").
- `perceivedEffort`: split workout days into high/low effort by personal median; `groupContrast` on next-day `mood` and `energy`.

### 5. Milestones (Tier 1)
Reuse existing streak data (`streaks.ipc.js` / `streak-utils.js`); surface only top current streaks/milestones, capped at 2, lowest priority.

### Ranking
`score = severityWeight × recencyFactor × confidenceFactor × actionability`
- `severityWeight`: strong 3, notice 2, info 1
- `recencyFactor`: anomalies (today/yesterday) boosted; others flat
- `confidenceFactor`: high 1.2, medium 1.0, low 0.8
- `actionability`: ×1.3 if `actionHint` present

Dashboard `InsightCard`: when `tierUnlocked < 1` it shows the low-data variant ("Sto iniziando a conoscerti — logga ancora qualche giorno"); otherwise it shows exactly one insight, chosen deterministically by day: take the top 5 by score, `pick = epochDay % len`. Stable within a day, rotates across days. `InsightsPage`: all insights grouped by `relatedModules`; associations rendered with the contrast headline + a small scatter mini-chart (reuse `Sparkline` / a tiny scatter component) + confidence badge + reliability basis + the standing "correlazione ≠ causalità" footnote; a `DataQuality` strip at the top showing coverage and what unlocks next.

### Action hints
A small fixed `subject → hint` map in `templates.js` (e.g. `lastMealHour~sleepQuality` → "prova a cenare prima"; `sleepMin~mood` → "una sveglia coerente aiuta"). Only a handful; if a subject isn't in the map, `actionHint` is undefined. Hints are phrased as gentle experiments, never prescriptions.

## Settings (new keys in `settings` table)

| Key | Type | Default | Effect |
|---|---|---|---|
| `insights.enabled` | bool | `true` | master switch; off ⇒ no card, no page content |
| `insights.useNutrition` | bool | `true` | off ⇒ drop all nutrition pairs + hide reliability badges |
| `insights.includeApproxDays` | bool | `false` | include `approx` days in nutrition analyses |
| `insights.minPairN` | int | `21` | min paired sample size for an association (also reliable-day floor for nutrition) |
| `insights.fdrQ` | float | `0.10` | Benjamini–Hochberg target false-discovery rate |
| `insights.sleepTargetMin` | int | `480` | target sleep for sleep-debt calc |
| `insights.windowDays` | int | `90` | analysis window |

Surfaced in `SettingsPage` under a new "Insights" section. (`minPairN` / `fdrQ` shown as "advanced".)

## Performance & privacy
Fully local. ≤ 180 rows; permutation tests are the only non-trivial cost: 14 pairs × ~2 lags × 2000 shuffles × O(n log n) ≈ low tens of ms — run once per `insights:get`, behind the optional `dataVersion` memo. No per-handler cache plumbing. Permutation RNG seeded from `dataVersion` so a given dataset gives stable results within a session (and reproducible tests).

## Testing
Test runner/conventions confirmed in the implementation plan. Fixtures = synthetic in-memory DB seeded with known patterns.
- `dailyFacts`: cross-table merge, null handling, derived fields (`kcalBalance`, `bedtimeHour` parse, `weightTrend` EMA, `gramRoundness`, `sleepFactors` parse), calendar-date lag pairing skips gaps.
- `reliability`: each Pass-A flag triggers `approx`; `none` conditions; Pass-B median-deviation downgrade; manual override beats auto; setting to auto value removes override.
- `stats`: `spearman`/`pearson` vs hand-computed values; `permutationTest` p-value on a constructed strong vs null relationship; `benjaminiHochberg` against the textbook example; `residualizeOnWeekend` removes a pure weekend effect; `robustZ`; `groupContrast`.
- `associations`: a real injected association survives FDR with correct sign; **pure-noise input produces zero associations** (false-positive guard — the critical test); a weekend-driven-only pattern is flagged as weekend-explained (`severity: info`); below-`n` pairs excluded; `useNutrition=false` removes nutrition pairs; `includeApproxDays` changes `n` and `reliabilityBasis`.
- `trends`: regression slope on a synthetic linear series; sleep-debt accumulation; low-`n` lowers confidence.
- `anomalies`: robust-z detects an injected spike; baseline excludes unreliable days; >2-day-old anomalies suppressed.
- `factorAnalysis`: a tag with a real quality effect produces a contrast; a tag with < 6 nights produces nothing; `perceivedEffort` next-day contrast.
- `insightBuilder`: tier gating by `DataQuality`; ranking order; deterministic daily pick; cold-start variant when `tierUnlocked < 1`.
- Integration: seed a DB with an injected pattern ("poor sleep → +250 kcal next day") plus realistic noise on other signals, assert the engine produces exactly the matching association (right sign, plausible `n`, survives FDR) and does **not** produce spurious ones.

## Open items for the implementation plan
- Confirm the test runner/setup present in the repo (scripts dir / package.json) and match conventions.
- Confirm exact stored formats of `sleep_log.bedtime` / `wake_time` / `factors`.
- Confirm where a weight goal lives in settings (for trend ETA).
- Decide whether the `dataVersion` memo is worth implementing in SP1 or punted (computation may already be fast enough to skip caching entirely).
