const Database = require('better-sqlite3');
const { getInsights, setReliability, clearReliability } = require('./insights.ipc');

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE foods (id INTEGER PRIMARY KEY, name TEXT, calories REAL, protein REAL, carbs REAL, fat REAL, fiber REAL DEFAULT 0);
    CREATE TABLE log (id INTEGER PRIMARY KEY, date TEXT, food_id INTEGER, grams REAL, meal TEXT DEFAULT 'Lunch', status TEXT DEFAULT 'logged');
    CREATE TABLE sleep_log (id INTEGER PRIMARY KEY, date TEXT UNIQUE, bedtime TEXT, wake_time TEXT, duration_min INTEGER, quality INTEGER, factors TEXT, note TEXT);
    CREATE TABLE mood_log (id INTEGER PRIMARY KEY, date TEXT UNIQUE, mood INTEGER, energy INTEGER, stress INTEGER, note TEXT);
    CREATE TABLE daily_energy (date TEXT PRIMARY KEY, resting_kcal REAL DEFAULT 0, active_kcal REAL DEFAULT 0, extra_kcal REAL DEFAULT 0, steps INTEGER DEFAULT 0);
    CREATE TABLE weight_log (id INTEGER PRIMARY KEY, date TEXT UNIQUE, weight REAL);
    CREATE TABLE water_log (id INTEGER PRIMARY KEY, date TEXT, ml REAL);
    CREATE TABLE habits (id INTEGER PRIMARY KEY, name TEXT, archived INTEGER DEFAULT 0);
    CREATE TABLE habit_logs (id INTEGER PRIMARY KEY, habit_id INTEGER, date TEXT, value INTEGER DEFAULT 1, UNIQUE(habit_id, date));
    CREATE TABLE tasks (id INTEGER PRIMARY KEY, date TEXT, title TEXT, done INTEGER DEFAULT 0);
    CREATE TABLE focus_sessions (id INTEGER PRIMARY KEY, date TEXT, duration_min INTEGER DEFAULT 0, completed INTEGER DEFAULT 1);
    CREATE TABLE workout_sessions (id INTEGER PRIMARY KEY, date TEXT, duration_min INTEGER, perceived_effort INTEGER);
    CREATE TABLE exercises (id INTEGER PRIMARY KEY, date TEXT, duration_min REAL DEFAULT 0, calories_burned REAL DEFAULT 0);
    CREATE TABLE food_day_reliability (date TEXT PRIMARY KEY, level TEXT, source TEXT DEFAULT 'manual', updated_at TEXT);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
  `);
  return db;
}

describe('insights IPC logic', () => {
  it('getInsights returns { insights, dataQuality } with defaults when no settings rows exist', () => {
    const db = makeDb();
    const res = getInsights(db, { windowDays: 90, today: '2025-01-10' });
    expect(Array.isArray(res.insights)).toBe(true);
    expect(res.dataQuality).toBeTruthy();
  });
  it('getInsights honors insights.enabled=0 in settings', () => {
    const db = makeDb();
    db.prepare("INSERT INTO settings (key,value) VALUES ('insights.enabled','0')").run();
    expect(getInsights(db, { windowDays: 90, today: '2025-01-10' }).insights).toEqual([]);
  });
  it('setReliability + clearReliability round-trip', () => {
    const db = makeDb();
    setReliability(db, { date: '2025-01-01', level: 'approx' });
    expect(db.prepare('SELECT level FROM food_day_reliability WHERE date=?').get('2025-01-01').level).toBe('approx');
    clearReliability(db, { date: '2025-01-01' });
    expect(db.prepare('SELECT * FROM food_day_reliability WHERE date=?').get('2025-01-01')).toBeUndefined();
  });
});
