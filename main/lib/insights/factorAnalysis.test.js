const { findFactorInsights } = require('./factorAnalysis');

function days(n, fn) {
  const out = []; let d = new Date('2025-01-01T00:00:00Z');
  for (let i = 0; i < n; i++) { out.push(Object.assign({ date: d.toISOString().slice(0, 10) }, fn(i))); d = new Date(d.getTime() + 86400000); }
  return out;
}

describe('findFactorInsights', () => {
  it('finds a sleep-factor quality contrast', () => {
    const facts = days(20, i => ({
      sleepFactors: i % 2 === 0 ? ['caffe tardi'] : [],
      sleepQuality: i % 2 === 0 ? 2 : 4,
      sleepMin: 420,
    }));
    const res = findFactorInsights(facts);
    const tag = res.find(r => r.kind === 'factor' && r.tag === 'caffe tardi' && r.metric === 'sleepQuality');
    expect(tag).toBeTruthy();
    expect(tag.withMean).toBeCloseTo(2, 6);
    expect(tag.withoutMean).toBeCloseTo(4, 6);
  });
  it('ignores tags with fewer than 6 occurrences', () => {
    const facts = days(20, i => ({ sleepFactors: i < 3 ? ['rumore'] : [], sleepQuality: i < 3 ? 2 : 4, sleepMin: 420 }));
    expect(findFactorInsights(facts).find(r => r.tag === 'rumore')).toBeUndefined();
  });
  it('finds a perceived-effort → next-day energy contrast', () => {
    const facts = days(20, i => ({
      workoutDone: true, perceivedEffort: i % 2 === 0 ? 5 : 2,
      energy: 3,
    }));
    for (let i = 1; i < facts.length; i++) facts[i].energy = facts[i - 1].perceivedEffort >= 4 ? 2 : 4;
    const res = findFactorInsights(facts);
    expect(res.find(r => r.kind === 'factor' && r.tag === 'perceivedEffort' && r.metric === 'energy')).toBeTruthy();
  });
});
