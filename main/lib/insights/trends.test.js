const { findTrends } = require('./trends');

function days(n, fn) {
  const out = []; let d = new Date('2025-01-01T00:00:00Z');
  for (let i = 0; i < n; i++) { out.push(Object.assign({ date: d.toISOString().slice(0, 10) }, fn(i))); d = new Date(d.getTime() + 86400000); }
  return out;
}
const SETTINGS = { sleepTargetMin: 480 };

describe('findTrends', () => {
  it('detects a rising mood trend', () => {
    const facts = days(30, i => ({ mood: Math.min(5, 1 + i * 0.1) }));
    const t = findTrends(facts, SETTINGS).find(r => r.metric === 'mood');
    expect(t).toBeTruthy();
    expect(t.direction).toBe('up');
    expect(t.slopePerDay).toBeGreaterThan(0);
  });
  it('ignores a flat series', () => {
    const facts = days(30, () => ({ mood: 3 }));
    expect(findTrends(facts, SETTINGS).find(r => r.metric === 'mood')).toBeUndefined();
  });
  it('computes weight kg/week and ETA to goal', () => {
    const facts = days(30, i => ({ weightTrend: 85 - i * 0.05 }));
    const t = findTrends(facts, { ...SETTINGS, goalWeight: 80 }).find(r => r.metric === 'weight');
    expect(t.kgPerWeek).toBeCloseTo(-0.35, 2);
    expect(t.etaDays).toBeGreaterThan(0);
  });
  it('accumulates sleep debt', () => {
    const facts = days(14, () => ({ sleepMin: 420 }));
    const t = findTrends(facts, SETTINGS).find(r => r.metric === 'sleepDebt');
    expect(t.totalDebtMin).toBe(840);
  });
  it('flags low confidence when n < 14', () => {
    const facts = days(7, i => ({ mood: Math.min(5, 1 + i * 0.3) }));
    const t = findTrends(facts, SETTINGS).find(r => r.metric === 'mood');
    expect(t.confidence).toBe('low');
  });
});
