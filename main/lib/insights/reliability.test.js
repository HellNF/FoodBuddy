const Database = require('better-sqlite3');
const { computeReliability, setDayReliability, clearDayReliability, autoLevel } = require('./reliability');

function fact(over) {
  return Object.assign({
    date: '2025-01-01', mealCount: 3, kcalIn: 2000, hasBreakfast: true,
    firstMealHour: null, gramRoundness: 0.2,
    foodReliability: { level: 'precise', manualOverride: false },
  }, over);
}

describe('autoLevel (Pass A structural flags)', () => {
  it('none when no items', () => { expect(autoLevel(fact({ mealCount: 0, kcalIn: null }))).toBe('none'); });
  it('none when kcalIn is 0', () => { expect(autoLevel(fact({ mealCount: 1, kcalIn: 0 }))).toBe('none'); });
  it('approx when kcalIn < 1000', () => { expect(autoLevel(fact({ kcalIn: 800 }))).toBe('approx'); });
  it('approx when kcalIn > 5000', () => { expect(autoLevel(fact({ kcalIn: 6000 }))).toBe('approx'); });
  it('approx when only one meal', () => { expect(autoLevel(fact({ mealCount: 1 }))).toBe('approx'); });
  it('approx when high gram-roundness', () => { expect(autoLevel(fact({ gramRoundness: 0.9 }))).toBe('approx'); });
  it('precise otherwise', () => { expect(autoLevel(fact({}))).toBe('precise'); });
});

describe('computeReliability (Pass B median deviation)', () => {
  it('downgrades a precise day far from the personal median', () => {
    const facts = [
      fact({ date: '2025-01-01', kcalIn: 2000 }),
      fact({ date: '2025-01-02', kcalIn: 2100 }),
      fact({ date: '2025-01-03', kcalIn: 1900 }),
      fact({ date: '2025-01-04', kcalIn: 3500 }),
    ];
    computeReliability(facts);
    expect(facts[3].foodReliability.level).toBe('approx');
    expect(facts[0].foodReliability.level).toBe('precise');
  });
  it('respects a manual override', () => {
    const facts = [fact({ date: '2025-01-01', kcalIn: 800, foodReliability: { level: 'precise', manualOverride: true } })];
    computeReliability(facts);
    expect(facts[0].foodReliability.level).toBe('precise');
  });
});

describe('override persistence', () => {
  it('set then clear', () => {
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE food_day_reliability (date TEXT PRIMARY KEY, level TEXT, source TEXT DEFAULT 'manual', updated_at TEXT)`);
    setDayReliability(db, '2025-01-01', 'approx');
    expect(db.prepare('SELECT level FROM food_day_reliability WHERE date=?').get('2025-01-01').level).toBe('approx');
    clearDayReliability(db, '2025-01-01');
    expect(db.prepare('SELECT * FROM food_day_reliability WHERE date=?').get('2025-01-01')).toBeUndefined();
  });
  it('rejects an invalid level', () => {
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE food_day_reliability (date TEXT PRIMARY KEY, level TEXT, source TEXT DEFAULT 'manual', updated_at TEXT)`);
    expect(() => setDayReliability(db, '2025-01-01', 'bogus')).toThrow();
  });
});
