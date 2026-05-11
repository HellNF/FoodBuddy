'use strict';
const { linearRegression } = require('./stats');

const TREND_METRICS = ['mood', 'energy', 'stress', 'taskCompletionPct', 'habitPct', 'weight'];

function lastNDays(facts, n) { return facts.slice(Math.max(0, facts.length - n)); }
function confidenceFor(n) { return n < 14 ? 'low' : n < 21 ? 'medium' : 'high'; }

function findTrends(facts, settings) {
  const window = lastNDays(facts, 30);
  const out = [];
  for (const metric of TREND_METRICS) {
    const sourceKey = metric === 'weight' ? 'weightTrend' : metric;
    const pts = []; let baseDate = null;
    for (const f of window) {
      const v = f[sourceKey];
      if (v == null || Number.isNaN(Number(v))) continue;
      if (baseDate == null) baseDate = f.date;
      const dayIdx = Math.round((new Date(f.date + 'T00:00:00Z') - new Date(baseDate + 'T00:00:00Z')) / 86400000);
      pts.push([dayIdx, Number(v)]);
    }
    if (pts.length < 5) continue;
    const t = pts.map(p => p[0]), y = pts.map(p => p[1]);
    const reg = linearRegression(t, y);
    const span = t[t.length - 1] - t[0] || 1;
    if (Math.abs(reg.slope * span) <= 0.5 * reg.sd) continue;
    const base = { kind: 'trend', metric, slopePerDay: reg.slope, direction: reg.slope > 0 ? 'up' : 'down', n: pts.length, span, confidence: confidenceFor(pts.length) };
    if (metric === 'weight') {
      base.kgPerWeek = reg.slope * 7;
      const last = y[y.length - 1];
      if (settings.goalWeight != null && reg.slope !== 0 && Math.sign(settings.goalWeight - last) === Math.sign(reg.slope)) {
        base.etaDays = Math.round((settings.goalWeight - last) / reg.slope);
      }
    }
    out.push(base);
  }
  // sleep debt
  const target = settings.sleepTargetMin ?? 480;
  const sleepPts = window.filter(f => f.sleepMin != null);
  if (sleepPts.length >= 5) {
    const totalDebtMin = sleepPts.reduce((s, f) => s + Math.max(0, target - f.sleepMin), 0);
    if (totalDebtMin >= 180) out.push({ kind: 'trend', metric: 'sleepDebt', totalDebtMin, n: sleepPts.length, confidence: confidenceFor(sleepPts.length) });
  }
  return out;
}

module.exports = { findTrends };
