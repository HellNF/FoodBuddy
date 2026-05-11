const Database = require('better-sqlite3');
const { computeFocusStats } = require('./focus.ipc');

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE focus_sessions (id INTEGER PRIMARY KEY, date TEXT, started_at TEXT, ended_at TEXT, duration_min INTEGER DEFAULT 0, type TEXT DEFAULT 'pomodoro', project TEXT, note TEXT, completed INTEGER DEFAULT 1, created_at TEXT)`);
  return db;
}

function insert(db, { date, duration_min, completed = 1, project = null }) {
  db.prepare(`INSERT INTO focus_sessions (date, duration_min, completed, project) VALUES (?, ?, ?, ?)`)
    .run(date, duration_min, completed, project);
}

// Test 1: Empty DB → days=[], all zeros
test('empty db returns zeros', () => {
  const db = makeDb();
  const stats = computeFocusStats(db, { from: '2026-04-11', to: '2026-05-11', today: '2026-05-11' });
  expect(stats.days).toEqual([]);
  expect(stats.current_streak).toBe(0);
  expect(stats.best_streak).toBe(0);
  expect(stats.week_min).toBe(0);
  expect(stats.last_week_min).toBe(0);
  expect(stats.total_min_30d).toBe(0);
  expect(stats.avg_min_per_active_day).toBe(0);
  expect(stats.by_project).toEqual([]);
});

// Test 2: Two days with ≥10 min each ending today → current_streak===2
test('current_streak is 2 for two qualifying days ending today', () => {
  const db = makeDb();
  const today = '2026-05-11';
  const yesterday = '2026-05-10';
  insert(db, { date: today, duration_min: 25 });
  insert(db, { date: yesterday, duration_min: 15 });
  const stats = computeFocusStats(db, { from: '2026-04-11', to: today, today });
  expect(stats.current_streak).toBe(2);
});

// Test 3: Project tracking
test('by_project includes named project and __none__ for null', () => {
  const db = makeDb();
  const today = '2026-05-11';
  insert(db, { date: today, duration_min: 30, project: 'ProjectA' });
  insert(db, { date: today, duration_min: 20, project: null });
  const stats = computeFocusStats(db, { from: '2026-04-11', to: today, today });
  const projects = stats.by_project.map(p => p.project);
  expect(projects).toContain('ProjectA');
  expect(projects).toContain('__none__');
});

// Test 4: week_min sums correctly (only last 7 days)
test('week_min sums only last 7 days', () => {
  const db = makeDb();
  const today = '2026-05-11';
  // Within last 7 days
  insert(db, { date: '2026-05-11', duration_min: 20 });
  insert(db, { date: '2026-05-09', duration_min: 15 });
  // Outside last 7 days (day 8+)
  insert(db, { date: '2026-05-04', duration_min: 100 });
  const stats = computeFocusStats(db, { from: '2026-04-11', to: today, today });
  expect(stats.week_min).toBe(35);
});

// Test 5: Day with exactly 9 min doesn't qualify for streak, 10 min does
test('streak counts only qualifying days (>=10 min)', () => {
  const db = makeDb();
  const today = '2026-05-11';
  insert(db, { date: today, duration_min: 10 });         // qualifies
  insert(db, { date: '2026-05-10', duration_min: 9 });   // doesn't qualify
  const stats = computeFocusStats(db, { from: '2026-04-11', to: today, today });
  expect(stats.current_streak).toBe(1);
  expect(stats.best_streak).toBe(1);
});

// Test 6: best_streak with 3 consecutive qualifying days
test('best_streak is 3 for three consecutive qualifying days', () => {
  const db = makeDb();
  const today = '2026-05-11';
  insert(db, { date: '2026-04-20', duration_min: 10 });
  insert(db, { date: '2026-04-21', duration_min: 15 });
  insert(db, { date: '2026-04-22', duration_min: 20 });
  // Gap, then today alone
  insert(db, { date: today, duration_min: 12 });
  const stats = computeFocusStats(db, { from: '2026-04-11', to: today, today });
  expect(stats.best_streak).toBe(3);
});
