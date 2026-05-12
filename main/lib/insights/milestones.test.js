'use strict';
const { findMilestones } = require('./milestones');

const SETTINGS = { sleepTargetMin: 480 };

function days(n, fn, startIso = '2025-01-01') {
  const out = []; let d = new Date(startIso + 'T00:00:00Z');
  for (let i = 0; i < n; i++) {
    out.push(Object.assign({ date: d.toISOString().slice(0, 10) }, fn(i)));
    d = new Date(d.getTime() + 86400000);
  }
  return out;
}

describe('findMilestones', () => {
  it('returns empty array when no data', () => {
    expect(findMilestones([], SETTINGS)).toEqual([]);
  });

  it('detects habit_streak_7 earned on last day', () => {
    const facts = days(10, i => ({ habitPct: i >= 3 ? 0.8 : 0.1 }));
    const ms = findMilestones(facts, SETTINGS);
    const m = ms.find(m => m.id === 'habit_streak_7');
    expect(m).toBeTruthy();
    expect(m.streakLength).toBeGreaterThanOrEqual(7);
    expect(m.achievedDate).toBe(facts[facts.length - 1].date);
  });

  it('does NOT detect habit_streak_7 if streak is old (> 3 days ago)', () => {
    // streak ends 5 days before last fact
    const facts = days(15, i => ({ habitPct: i >= 1 && i <= 7 ? 0.8 : 0.1 }));
    const ms = findMilestones(facts, SETTINGS);
    expect(ms.find(m => m.id === 'habit_streak_7')).toBeUndefined();
  });

  it('detects log_streak_7 earned on last day', () => {
    const facts = days(10, i => ({ kcalIn: i >= 3 ? 2000 : 0 }));
    const ms = findMilestones(facts, SETTINGS);
    const m = ms.find(m => m.id === 'log_streak_7');
    expect(m).toBeTruthy();
    expect(m.streakLength).toBeGreaterThanOrEqual(7);
  });

  it('detects weight_new_low with sufficient data', () => {
    const facts = days(20, i => ({
      weight: 80 - i * 0.1,    // declining — last day is lowest
      kcalIn: 2000,
    }));
    const ms = findMilestones(facts, SETTINGS);
    const m = ms.find(m => m.id === 'weight_new_low');
    expect(m).toBeTruthy();
    expect(m.value).toBeCloseTo(80 - 19 * 0.1, 1);
  });

  it('does NOT detect weight_new_low with < 14 weight entries', () => {
    const facts = days(10, i => ({ weight: 80 - i * 0.1 }));
    const ms = findMilestones(facts, SETTINGS);
    expect(ms.find(m => m.id === 'weight_new_low')).toBeUndefined();
  });

  it('detects perfect_day for yesterday', () => {
    const facts = days(3, i => ({
      habitPct: 0.9,
      kcalIn: 2000,
      sleepMin: 490,  // >= 480
    }));
    const ms = findMilestones(facts, SETTINGS);
    const m = ms.find(m => m.id === 'perfect_day');
    expect(m).toBeTruthy();
    expect(m.achievedDate).toBe(facts[facts.length - 2].date); // yesterday
  });

  it('does NOT detect perfect_day if sleep below target', () => {
    const facts = days(3, i => ({
      habitPct: 0.9,
      kcalIn: 2000,
      sleepMin: 400,  // < 480
    }));
    const ms = findMilestones(facts, SETTINGS);
    expect(ms.find(m => m.id === 'perfect_day')).toBeUndefined();
  });

  it('returns milestones with kind, id, achievedDate', () => {
    const facts = days(10, i => ({ habitPct: 0.8 }));
    const ms = findMilestones(facts, SETTINGS);
    for (const m of ms) {
      expect(m.kind).toBe('milestone');
      expect(typeof m.id).toBe('string');
      expect(typeof m.achievedDate).toBe('string');
    }
  });
});
