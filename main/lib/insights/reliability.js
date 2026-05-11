'use strict';
const { median } = require('./stats');

const LEVELS = ['precise', 'approx', 'none'];

function autoLevel(fact) {
  if (!fact.mealCount || fact.kcalIn == null || fact.kcalIn === 0) return 'none';
  if (fact.kcalIn < 1000 || fact.kcalIn > 5000) return 'approx';
  if (fact.mealCount <= 1) return 'approx';
  if (!fact.hasBreakfast && fact.firstMealHour != null && fact.firstMealHour > 13) return 'approx';
  if (fact.gramRoundness != null && fact.gramRoundness >= 0.8) return 'approx';
  return 'precise';
}

function computeReliability(facts) {
  for (const f of facts) {
    if (f.foodReliability && f.foodReliability.manualOverride) continue;
    f.foodReliability = { level: autoLevel(f), manualOverride: false };
  }
  // Pass B: median of kcalIn over Pass-A 'precise' days; downgrade outliers > ±50%.
  const preciseKcal = facts.filter(f => f.foodReliability.level === 'precise' && !f.foodReliability.manualOverride && f.kcalIn != null).map(f => f.kcalIn);
  const med = median(preciseKcal);
  if (med != null && med > 0) {
    for (const f of facts) {
      if (f.foodReliability.manualOverride) continue;
      if (f.foodReliability.level === 'precise' && f.kcalIn != null && Math.abs(f.kcalIn - med) / med > 0.5) {
        f.foodReliability = { level: 'approx', manualOverride: false };
      }
    }
  }
  return facts;
}

function setDayReliability(db, date, level) {
  if (!LEVELS.includes(level)) throw new Error(`invalid reliability level: ${level}`);
  db.prepare(`INSERT INTO food_day_reliability (date, level, source, updated_at) VALUES (?, ?, 'manual', datetime('now'))
              ON CONFLICT(date) DO UPDATE SET level=excluded.level, source='manual', updated_at=datetime('now')`).run(date, level);
}

function clearDayReliability(db, date) {
  db.prepare('DELETE FROM food_day_reliability WHERE date=?').run(date);
}

module.exports = { autoLevel, computeReliability, setDayReliability, clearDayReliability, LEVELS };
