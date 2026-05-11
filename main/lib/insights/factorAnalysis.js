'use strict';
const { mean, median } = require('./stats');

function findFactorInsights(facts) {
  const out = [];
  // ── sleep-factor tags ──
  const tagSet = new Set();
  for (const f of facts) if (Array.isArray(f.sleepFactors)) for (const t of f.sleepFactors) tagSet.add(t);
  for (const tag of tagSet) {
    for (const [metric, minDelta] of [['sleepQuality', 0.5], ['sleepMin', 25]]) {
      const withTag = facts.filter(f => Array.isArray(f.sleepFactors) && f.sleepFactors.includes(tag) && f[metric] != null).map(f => f[metric]);
      const without = facts.filter(f => Array.isArray(f.sleepFactors) && !f.sleepFactors.includes(tag) && f[metric] != null).map(f => f[metric]);
      if (withTag.length < 6 || without.length < 3) continue;
      const wM = mean(withTag), woM = mean(without);
      if (Math.abs(wM - woM) < minDelta) continue;
      out.push({ kind: 'factor', tag, metric, withMean: wM, withoutMean: woM, withN: withTag.length, withoutN: without.length });
    }
  }
  // ── perceived effort → next-day mood/energy ──
  const byDate = {}; for (const f of facts) byDate[f.date] = f;
  const effortDays = facts.filter(f => f.workoutDone && f.perceivedEffort != null);
  if (effortDays.length >= 12) {
    const medEffort = median(effortDays.map(f => f.perceivedEffort));
    for (const metric of ['mood', 'energy']) {
      const high = [], low = [];
      for (const f of effortDays) {
        const next = byDate[new Date(new Date(f.date + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10)];
        if (!next || next[metric] == null) continue;
        (f.perceivedEffort >= medEffort ? high : low).push(next[metric]);
      }
      if (high.length < 6 || low.length < 6) continue;
      const hM = mean(high), lM = mean(low);
      if (Math.abs(hM - lM) < 0.5) continue;
      out.push({ kind: 'factor', tag: 'perceivedEffort', metric, highEffortNextDayMean: hM, lowEffortNextDayMean: lM, highN: high.length, lowN: low.length });
    }
  }
  return out;
}

module.exports = { findFactorInsights };
