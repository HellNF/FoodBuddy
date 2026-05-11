const Database = require('better-sqlite3');
const { buildDailyFacts, dataQuality } = require('./dailyFacts');

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
  `);
  db.prepare('INSERT INTO foods (id,name,calories,protein,carbs,fat,fiber) VALUES (1,?,100,5,10,2,1)').run('rice');
  db.prepare("INSERT INTO log (date,food_id,grams,meal) VALUES ('2025-01-01',1,300,'Breakfast')").run();
  db.prepare("INSERT INTO log (date,food_id,grams,meal) VALUES ('2025-01-01',1,500,'Lunch')").run();
  db.prepare("INSERT INTO sleep_log (date,bedtime,wake_time,duration_min,quality,factors) VALUES ('2025-01-01','23:30','07:30',480,4,?)").run(JSON.stringify(['caffe tardi']));
  db.prepare("INSERT INTO mood_log (date,mood,energy,stress) VALUES ('2025-01-01',4,3,2)").run();
  db.prepare("INSERT INTO daily_energy (date,resting_kcal,active_kcal,steps) VALUES ('2025-01-01',1500,400,8000)").run();
  db.prepare("INSERT INTO weight_log (date,weight) VALUES ('2025-01-01',80)").run();
  db.prepare("INSERT INTO mood_log (date,mood,energy,stress) VALUES ('2025-01-02',2,2,4)").run();
  return db;
}

describe('buildDailyFacts', () => {
  const db = makeDb();
  const facts = buildDailyFacts(db, { from: '2025-01-01', to: '2025-01-02' });

  it('produces one row per date in range', () => {
    expect(facts.map(f => f.date)).toEqual(['2025-01-01', '2025-01-02']);
  });
  it('sums kcalIn from logged food only', () => {
    expect(facts[0].kcalIn).toBe(800);
  });
  it('computes kcalOut and kcalBalance', () => {
    expect(facts[0].kcalOut).toBe(1900);
    expect(facts[0].kcalBalance).toBe(800 - 1900);
  });
  it('parses bedtimeHour from HH:MM', () => {
    expect(facts[0].bedtimeHour).toBeCloseTo(23.5, 6);
    expect(facts[0].wakeHour).toBeCloseTo(7.5, 6);
  });
  it('parses sleep factors array', () => {
    expect(facts[0].sleepFactors).toEqual(['caffe tardi']);
  });
  it('detects hasBreakfast', () => {
    expect(facts[0].hasBreakfast).toBe(true);
    expect(facts[0].mealCount).toBe(2);
  });
  it('leaves missing signals as null (no food on day 2)', () => {
    expect(facts[1].kcalIn).toBe(null);
    expect(facts[1].mealCount).toBe(0);
    expect(facts[1].mood).toBe(2);
  });
  it('marks weekend correctly (2025-01-01 is Wednesday)', () => {
    expect(facts[0].isWeekend).toBe(false);
  });
});

describe('dataQuality', () => {
  it('reports coverage and tier', () => {
    const db = makeDb();
    const facts = buildDailyFacts(db, { from: '2025-01-01', to: '2025-01-02' });
    const dq = dataQuality(facts, 2);
    expect(dq.daysWithAnyData).toBe(2);
    expect(dq.perSignalCoverage.mood).toBeCloseTo(1, 6);
    expect(dq.perSignalCoverage.kcalIn).toBeCloseTo(0.5, 6);
    expect(dq.tierUnlocked).toBe(0);
  });
});
