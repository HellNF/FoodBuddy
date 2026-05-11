const Database = require('better-sqlite3');
const { computeWorkoutStats } = require('./workouts.ipc');

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE workout_sessions (id INTEGER PRIMARY KEY, date TEXT, plan_id INTEGER, started_at TEXT, ended_at TEXT, duration_min INTEGER DEFAULT 0, calories_burned INTEGER DEFAULT 0, perceived_effort INTEGER, note TEXT, created_at TEXT);
    CREATE TABLE workout_exercise_sets (id INTEGER PRIMARY KEY, session_id INTEGER, exercise_id INTEGER, set_idx INTEGER, reps INTEGER, weight_kg REAL, distance_km REAL, duration_sec INTEGER, rest_sec INTEGER);
    CREATE TABLE exercise_types (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, met_value REAL DEFAULT 5.0, category TEXT DEFAULT 'other');
  `);
  return db;
}

// Helper: insert a session and return its id
function insertSession(db, { date, duration_min = 30, calories_burned = 100 }) {
  const r = db.prepare(
    'INSERT INTO workout_sessions (date, duration_min, calories_burned) VALUES (?, ?, ?)'
  ).run(date, duration_min, calories_burned);
  return r.lastInsertRowid;
}

// Helper: insert an exercise
function insertExercise(db, { name }) {
  const r = db.prepare('INSERT INTO exercise_types (name) VALUES (?)').run(name);
  return r.lastInsertRowid;
}

// Helper: insert a set
function insertSet(db, { session_id, exercise_id, reps, weight_kg }) {
  const r = db.prepare(
    'INSERT INTO workout_exercise_sets (session_id, exercise_id, reps, weight_kg) VALUES (?, ?, ?, ?)'
  ).run(session_id, exercise_id, reps ?? null, weight_kg ?? null);
  return r.lastInsertRowid;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

describe('computeWorkoutStats', () => {
  it('1. Empty DB returns all zeros', () => {
    const db = makeDb();
    const stats = computeWorkoutStats(db, { from: '2025-01-01', to: '2025-12-31', today: '2025-06-01' });
    expect(stats.days).toEqual([]);
    expect(stats.current_streak).toBe(0);
    expect(stats.best_streak).toBe(0);
    expect(stats.week_sessions).toBe(0);
    expect(stats.last_week_sessions).toBe(0);
    expect(stats.week_min).toBe(0);
    expect(stats.last_week_min).toBe(0);
    expect(stats.total_min_30d).toBe(0);
    expect(stats.sessions_30d).toBe(0);
    expect(stats.by_exercise).toEqual([]);
  });

  it('2. Session this week + session last week → current_streak === 2', () => {
    const db = makeDb();
    // today = 2025-06-05 (Thursday), last week = 2025-05-28
    insertSession(db, { date: '2025-06-05' });
    insertSession(db, { date: '2025-05-28' });
    const stats = computeWorkoutStats(db, { from: '2025-05-01', to: '2025-06-30', today: '2025-06-05' });
    expect(stats.current_streak).toBe(2);
  });

  it('3. Session this week only → current_streak === 1, best_streak === 1', () => {
    const db = makeDb();
    insertSession(db, { date: '2025-06-05' });
    const stats = computeWorkoutStats(db, { from: '2025-05-01', to: '2025-06-30', today: '2025-06-05' });
    expect(stats.current_streak).toBe(1);
    expect(stats.best_streak).toBe(1);
  });

  it('4. week_sessions and week_min sum correctly', () => {
    const db = makeDb();
    // last 7 days relative to today = 2025-06-05: 2025-05-30 to 2025-06-05
    insertSession(db, { date: '2025-06-03', duration_min: 40, calories_burned: 200 });
    insertSession(db, { date: '2025-06-01', duration_min: 30, calories_burned: 150 });
    // days 8-14 ago: 2025-05-22 to 2025-05-28
    insertSession(db, { date: '2025-05-25', duration_min: 50, calories_burned: 250 });
    const stats = computeWorkoutStats(db, { from: '2025-05-01', to: '2025-06-30', today: '2025-06-05' });
    expect(stats.week_sessions).toBe(2);
    expect(stats.week_min).toBe(70);
    expect(stats.last_week_sessions).toBe(1);
    expect(stats.last_week_min).toBe(50);
  });

  it('5. by_exercise volume aggregation: 2 sets → total_volume_kg === 980, null weight skipped', () => {
    const db = makeDb();
    const sid = insertSession(db, { date: '2025-06-03' });
    const eid = insertExercise(db, { name: 'Squat' });
    // 10 reps × 50 kg = 500
    insertSet(db, { session_id: sid, exercise_id: eid, reps: 10, weight_kg: 50 });
    // 8 reps × 60 kg = 480
    insertSet(db, { session_id: sid, exercise_id: eid, reps: 8, weight_kg: 60 });
    // null weight — should be skipped
    insertSet(db, { session_id: sid, exercise_id: eid, reps: 5, weight_kg: null });
    const stats = computeWorkoutStats(db, { from: '2025-05-01', to: '2025-06-30', today: '2025-06-05' });
    expect(stats.by_exercise.length).toBe(1);
    expect(stats.by_exercise[0].total_volume_kg).toBe(980);
    expect(stats.by_exercise[0].name).toBe('Squat');
    expect(stats.by_exercise[0].total_sets).toBe(3); // all sets counted, even null-weight
  });

  it('6. best_est_1rm_kg Epley formula: 60kg × (1 + 8/30) ≈ 76', () => {
    const db = makeDb();
    const sid = insertSession(db, { date: '2025-06-03' });
    const eid = insertExercise(db, { name: 'Bench Press' });
    insertSet(db, { session_id: sid, exercise_id: eid, reps: 8, weight_kg: 60 });
    const stats = computeWorkoutStats(db, { from: '2025-05-01', to: '2025-06-30', today: '2025-06-05' });
    expect(stats.by_exercise[0].best_est_1rm_kg).toBeGreaterThanOrEqual(76);
  });
});
