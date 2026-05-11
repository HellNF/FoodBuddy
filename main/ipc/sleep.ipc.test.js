const Database = require('better-sqlite3');
const { computeSleepStats } = require('./sleep.ipc');

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE sleep_log (
    id INTEGER PRIMARY KEY,
    date TEXT UNIQUE,
    bedtime TEXT,
    wake_time TEXT,
    duration_min INTEGER,
    quality INTEGER,
    factors TEXT,
    note TEXT,
    created_at TEXT
  )`);
  return db;
}

function insert(db, { date, duration_min = null, quality = null, factors = null }) {
  db.prepare(
    'INSERT INTO sleep_log (date, duration_min, quality, factors) VALUES (?, ?, ?, ?)'
  ).run(date, duration_min, quality, factors);
}

describe('computeSleepStats', () => {
  test('1. empty DB → zeros/nulls/empty', () => {
    const db = makeDb();
    const result = computeSleepStats(db, { from: '2025-01-01', to: '2025-01-31', today: '2025-01-31' });

    expect(result.days).toEqual([]);
    expect(result.logged_streak).toBe(0);
    expect(result.best_logged_streak).toBe(0);
    expect(result.days_logged_30d).toBe(0);
    expect(result.avg_duration_min).toBeNull();
    expect(result.avg_quality).toBeNull();
    expect(result.week_avg_min).toBeNull();
    expect(result.last_week_avg_min).toBeNull();
    expect(result.debt_min_7d).toBe(0);
    expect(result.factor_counts).toEqual([]);
    expect(result.best_night).toBeNull();
  });

  test('2. 2 consecutive days ending today → logged_streak === 2', () => {
    const db = makeDb();
    insert(db, { date: '2025-03-10', duration_min: 480 });
    insert(db, { date: '2025-03-11', duration_min: 450 });
    const result = computeSleepStats(db, { from: '2025-03-01', to: '2025-03-11', today: '2025-03-11' });
    expect(result.logged_streak).toBe(2);
  });

  test('2b. 3 consecutive days ending yesterday → logged_streak === 3', () => {
    const db = makeDb();
    insert(db, { date: '2025-03-09', duration_min: 480 });
    insert(db, { date: '2025-03-10', duration_min: 480 });
    insert(db, { date: '2025-03-11', duration_min: 480 });
    const result = computeSleepStats(db, { from: '2025-03-01', to: '2025-03-12', today: '2025-03-12' });
    expect(result.logged_streak).toBe(3);
  });

  test('2c. gap before today → logged_streak === 0', () => {
    const db = makeDb();
    insert(db, { date: '2025-03-09', duration_min: 480 });
    // gap on 10, 11 (today)
    const result = computeSleepStats(db, { from: '2025-03-01', to: '2025-03-11', today: '2025-03-11' });
    expect(result.logged_streak).toBe(0);
  });

  test('3. factor_counts from JSON', () => {
    const db = makeDb();
    insert(db, { date: '2025-04-01', duration_min: 480, factors: '["Caffeina","Stress"]' });
    insert(db, { date: '2025-04-02', duration_min: 480, factors: '["Caffeina"]' });
    const result = computeSleepStats(db, { from: '2025-04-01', to: '2025-04-30', today: '2025-04-30' });
    expect(result.factor_counts).toEqual([
      { factor: 'Caffeina', count: 2 },
      { factor: 'Stress', count: 1 },
    ]);
  });

  test('4. debt_min_7d: one night of 420 min → debt 60', () => {
    const db = makeDb();
    insert(db, { date: '2025-05-05', duration_min: 420 });
    const result = computeSleepStats(db, { from: '2025-04-29', to: '2025-05-05', today: '2025-05-05' });
    expect(result.debt_min_7d).toBe(60);
  });

  test('4b. debt_min_7d: 8h night → debt 0', () => {
    const db = makeDb();
    insert(db, { date: '2025-05-05', duration_min: 480 });
    const result = computeSleepStats(db, { from: '2025-04-29', to: '2025-05-05', today: '2025-05-05' });
    expect(result.debt_min_7d).toBe(0);
  });

  test('5. avg_duration_min correct average', () => {
    const db = makeDb();
    insert(db, { date: '2025-06-01', duration_min: 400 });
    insert(db, { date: '2025-06-02', duration_min: 600 });
    insert(db, { date: '2025-06-03', duration_min: null });
    const result = computeSleepStats(db, { from: '2025-06-01', to: '2025-06-03', today: '2025-06-03' });
    expect(result.avg_duration_min).toBeCloseTo(500, 1);
  });

  test('6. best_night is highest duration_min row', () => {
    const db = makeDb();
    insert(db, { date: '2025-07-01', duration_min: 390 });
    insert(db, { date: '2025-07-02', duration_min: 540 });
    insert(db, { date: '2025-07-03', duration_min: 480 });
    const result = computeSleepStats(db, { from: '2025-07-01', to: '2025-07-03', today: '2025-07-03' });
    expect(result.best_night).toEqual({ date: '2025-07-02', duration_min: 540 });
  });

  test('7. best_logged_streak longest run in window', () => {
    const db = makeDb();
    insert(db, { date: '2025-08-01', duration_min: 480 });
    insert(db, { date: '2025-08-02', duration_min: 480 });
    // gap 03
    insert(db, { date: '2025-08-04', duration_min: 480 });
    insert(db, { date: '2025-08-05', duration_min: 480 });
    insert(db, { date: '2025-08-06', duration_min: 480 });
    const result = computeSleepStats(db, { from: '2025-08-01', to: '2025-08-06', today: '2025-08-06' });
    expect(result.best_logged_streak).toBe(3);
  });

  test('8. avg_quality only over non-null rows', () => {
    const db = makeDb();
    insert(db, { date: '2025-09-01', duration_min: 480, quality: 4 });
    insert(db, { date: '2025-09-02', duration_min: 480, quality: null });
    insert(db, { date: '2025-09-03', duration_min: 480, quality: 2 });
    const result = computeSleepStats(db, { from: '2025-09-01', to: '2025-09-03', today: '2025-09-03' });
    expect(result.avg_quality).toBeCloseTo(3, 1);
  });

  test('9. days_logged_30d counts only rows in last 30d', () => {
    const db = makeDb();
    insert(db, { date: '2025-10-01', duration_min: 480 });
    insert(db, { date: '2025-10-15', duration_min: 480 });
    insert(db, { date: '2025-10-31', duration_min: 480 });
    const result = computeSleepStats(db, { from: '2025-10-02', to: '2025-10-31', today: '2025-10-31' });
    // Only rows from 10-02 onward in the last 30d from today 10-31: 10-15 and 10-31 = 2
    expect(result.days_logged_30d).toBe(2);
  });

  test('10. factor_counts: null or invalid factors are skipped', () => {
    const db = makeDb();
    insert(db, { date: '2025-11-01', duration_min: 480, factors: null });
    insert(db, { date: '2025-11-02', duration_min: 480, factors: 'not_json' });
    insert(db, { date: '2025-11-03', duration_min: 480, factors: '["Stress"]' });
    const result = computeSleepStats(db, { from: '2025-11-01', to: '2025-11-30', today: '2025-11-30' });
    expect(result.factor_counts).toEqual([{ factor: 'Stress', count: 1 }]);
  });
});
