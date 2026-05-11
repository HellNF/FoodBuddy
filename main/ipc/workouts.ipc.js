const { ipcMain } = require('electron');
const { getDb } = require('../db');
const { pushUndo } = require('./undo.ipc');
const { updateSectionStreak } = require('./streak-utils');
const { addPointsInternal } = require('./gamification.ipc');
const { syncWorkoutSessionToExerciseLog, deleteWorkoutSessionExerciseLog } = require('./workout-log-sync');

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Update active_kcal in daily_energy for a given date.
 * Uses UPSERT so we don't overwrite other columns.
 */
function updateDailyEnergyWorkout(db, date, calories_burned) {
  db.prepare(`
    INSERT INTO daily_energy (date, resting_kcal, active_kcal, extra_kcal, steps)
    VALUES (?, 0, ?, 0, 0)
    ON CONFLICT(date) DO UPDATE SET
      active_kcal = excluded.active_kcal
  `).run(date, calories_burned);
}

function getSessionWithSets(db, id) {
  const session = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(id);
  if (!session) return null;
  const sets = db.prepare('SELECT * FROM workout_exercise_sets WHERE session_id = ? ORDER BY set_idx ASC').all(id);
  return { ...session, sets };
}

// ── ISO week helpers ──────────────────────────────────────────────────────────

function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function offsetDate(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function adjacentWeek(weekStr, n) {
  const [yearStr, wStr] = weekStr.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(wStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7 + n * 7);
  return getISOWeek(targetMonday.toISOString().slice(0, 10));
}

// ── computeWorkoutStats ───────────────────────────────────────────────────────

function computeWorkoutStats(db, { from, to, today: todayStr }) {
  // 1. days array
  const days = db.prepare(`
    SELECT date,
      COALESCE(SUM(duration_min), 0)    AS duration_min,
      COALESCE(SUM(calories_burned), 0) AS calories_burned,
      COUNT(*)                           AS sessions
    FROM workout_sessions
    WHERE date >= ? AND date <= ?
    GROUP BY date
    ORDER BY date ASC
  `).all(from, to);

  // 2. streak (weekly)
  const weekSet = new Set(days.map(d => getISOWeek(d.date)));
  const todayWeek = getISOWeek(todayStr);

  let current_streak = 0;
  let w = todayWeek;
  while (weekSet.has(w)) { current_streak++; w = adjacentWeek(w, -1); }

  const sortedWeeks = [...weekSet].sort();
  let best_streak = 0, run = 0;
  for (let i = 0; i < sortedWeeks.length; i++) {
    if (i === 0 || adjacentWeek(sortedWeeks[i - 1], 1) === sortedWeeks[i]) {
      run++;
    } else {
      run = 1;
    }
    best_streak = Math.max(best_streak, run);
  }

  // 3. rolling 7-day windows
  const d7start = offsetDate(todayStr, -6);   // last 7 days: [today-6 .. today]
  const d14start = offsetDate(todayStr, -13); // days 8-14:   [today-13 .. today-7]
  const d14end = offsetDate(todayStr, -7);

  let week_sessions = 0, last_week_sessions = 0;
  let week_min = 0, last_week_min = 0;
  let total_min_30d = 0, sessions_30d = 0;

  for (const row of days) {
    total_min_30d += row.duration_min;
    sessions_30d += row.sessions;
    if (row.date >= d7start && row.date <= todayStr) {
      week_sessions += row.sessions;
      week_min += row.duration_min;
    }
    if (row.date >= d14start && row.date <= d14end) {
      last_week_sessions += row.sessions;
      last_week_min += row.duration_min;
    }
  }

  // 4. by_exercise
  const by_exercise = db.prepare(`
    SELECT e.id AS exercise_id, e.name,
           COUNT(DISTINCT s.id) AS sessions,
           COUNT(wes.id) AS total_sets,
           COALESCE(SUM(CASE WHEN wes.reps IS NOT NULL AND wes.weight_kg IS NOT NULL THEN wes.reps * wes.weight_kg ELSE 0 END), 0) AS total_volume_kg,
           COALESCE(MAX(wes.weight_kg), 0) AS best_weight_kg,
           COALESCE(MAX(CASE WHEN wes.reps IS NOT NULL AND wes.weight_kg IS NOT NULL THEN wes.weight_kg * (1 + wes.reps / 30.0) ELSE NULL END), 0) AS best_est_1rm_kg
    FROM workout_sessions s
    JOIN workout_exercise_sets wes ON wes.session_id = s.id
    JOIN exercise_types e ON e.id = wes.exercise_id
    WHERE s.date >= ? AND s.date <= ?
    GROUP BY e.id, e.name
    ORDER BY total_volume_kg DESC
    LIMIT 8
  `).all(from, to);

  return {
    days,
    current_streak,
    best_streak,
    week_sessions,
    last_week_sessions,
    week_min,
    last_week_min,
    total_min_30d,
    sessions_30d,
    by_exercise,
  };
}

function registerWorkoutsIpc() {
  // ── workouts:startSession ─────────────────────────────────────────────────
  ipcMain.handle('workouts:startSession', (_, { date, plan_id, note } = {}) => {
    const db = getDb();
    const d = date || today();
    const result = db.prepare(`
      INSERT INTO workout_sessions (date, plan_id, started_at, ended_at, note)
      VALUES (?, ?, datetime('now'), NULL, ?)
    `).run(d, plan_id ?? null, note ?? null);
    const row = db.prepare('SELECT id, started_at FROM workout_sessions WHERE id = ?').get(result.lastInsertRowid);
    return { id: row.id, started_at: row.started_at };
  });

  // ── workouts:endSession ───────────────────────────────────────────────────
  ipcMain.handle('workouts:endSession', (_, { id, duration_min, calories_burned, perceived_effort, note } = {}) => {
    const db = getDb();
    const before = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(id);
    if (!before) return { ok: false };
    const syncedExercise = db.prepare('SELECT * FROM exercises WHERE workout_session_id = ?').get(id);
    const syncedSets = syncedExercise
      ? db.prepare('SELECT * FROM exercise_sets WHERE exercise_id = ? ORDER BY set_number ASC, id ASC').all(syncedExercise.id)
      : [];

    pushUndo('workouts:endSession', {
      id,
      old_ended_at:       before.ended_at,
      old_duration_min:   before.duration_min,
      old_calories_burned:before.calories_burned,
      old_perceived_effort:before.perceived_effort,
      old_note:           before.note,
      date:               before.date,
      old_exercise_row:   syncedExercise || null,
      old_exercise_sets:  syncedSets,
    });

    db.prepare(`
      UPDATE workout_sessions
      SET ended_at = datetime('now'),
          duration_min     = ?,
          calories_burned  = ?,
          perceived_effort = ?,
          note             = ?
      WHERE id = ?
    `).run(
      duration_min     ?? null,
      calories_burned  ?? null,
      perceived_effort ?? null,
      note             ?? before.note,
      id
    );

    syncWorkoutSessionToExerciseLog(db, id);

    // Update daily_energy active_kcal if calories provided
    if (calories_burned != null) {
      updateDailyEnergyWorkout(db, before.date, calories_burned);
    }

    const minDur = duration_min ?? 0;
    if (minDur >= 20) {
      try {
        const { streak, isNew, milestone, milestonePoints } = updateSectionStreak(db, 'workout', before.date);
        if (isNew) {
          addPointsInternal(db, 'section_streak', 'streak_daily_workout', 5, { section: 'workout', streak });
          if (milestone) {
            addPointsInternal(db, 'section_streak', `streak_${milestone}_workout`, milestonePoints, { section: 'workout', streak });
          }
        }
      } catch (_) {}
    }

    return getSessionWithSets(db, id);
  });

  // ── workouts:addSet ───────────────────────────────────────────────────────
  ipcMain.handle('workouts:addSet', (_, { session_id, exercise_id, set_idx, reps, weight_kg, distance_km, duration_sec, rest_sec } = {}) => {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO workout_exercise_sets
        (session_id, exercise_id, set_idx, reps, weight_kg, distance_km, duration_sec, rest_sec)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session_id,
      exercise_id  ?? null,
      set_idx      ?? 0,
      reps         ?? null,
      weight_kg    ?? null,
      distance_km  ?? null,
      duration_sec ?? null,
      rest_sec     ?? null
    );
    return { id: result.lastInsertRowid };
  });

  // ── workouts:removeSet ────────────────────────────────────────────────────
  ipcMain.handle('workouts:removeSet', (_, { id } = {}) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM workout_exercise_sets WHERE id = ?').get(id);
    if (row) pushUndo('workouts:removeSet', { row });
    db.prepare('DELETE FROM workout_exercise_sets WHERE id = ?').run(id);
    return { ok: true };
  });

  // ── workouts:getSession ───────────────────────────────────────────────────
  ipcMain.handle('workouts:getSession', (_, { id } = {}) => {
    const db = getDb();
    return getSessionWithSets(db, id);
  });

  // ── workouts:getDaySessions ───────────────────────────────────────────────
  ipcMain.handle('workouts:getDaySessions', (_, { date } = {}) => {
    const db = getDb();
    const d = date || today();
    const sessions = db.prepare('SELECT * FROM workout_sessions WHERE date = ? ORDER BY started_at ASC').all(d);
    return sessions.map(s => {
      const sets = db.prepare('SELECT * FROM workout_exercise_sets WHERE session_id = ? ORDER BY set_idx ASC').all(s.id);
      return { ...s, sets };
    });
  });

  // ── workouts:getActiveSession ─────────────────────────────────────────────
  ipcMain.handle('workouts:getActiveSession', () => {
    const db = getDb();
    const session = db.prepare('SELECT * FROM workout_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1').get();
    if (!session) return null;
    const sets = db.prepare('SELECT * FROM workout_exercise_sets WHERE session_id = ? ORDER BY set_idx ASC').all(session.id);
    return { ...session, sets };
  });

  // ── workouts:getWeekStats ─────────────────────────────────────────────────
  ipcMain.handle('workouts:getWeekStats', (_, { from, to } = {}) => {
    const db = getDb();
    return db.prepare(`
      SELECT
        date,
        COALESCE(SUM(duration_min), 0)    AS duration_min,
        COALESCE(SUM(calories_burned), 0) AS calories_burned,
        COUNT(*)                           AS sessions
      FROM workout_sessions
      WHERE date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(from, to);
  });

  // ── workouts:getStats ─────────────────────────────────────────────────────
  ipcMain.handle('workouts:getStats', (_, a) =>
    computeWorkoutStats(getDb(), {
      from: a.from,
      to: a.to,
      today: a.today || new Date().toISOString().slice(0, 10),
    })
  );

  // ── workouts:deleteSession ────────────────────────────────────────────────
  ipcMain.handle('workouts:deleteSession', (_, { id } = {}) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(id);
    if (!row) return { ok: false };
    const sets = db.prepare('SELECT * FROM workout_exercise_sets WHERE session_id = ?').all(id);
    const exerciseRow = db.prepare('SELECT * FROM exercises WHERE workout_session_id = ?').get(id);
    const exerciseSets = exerciseRow
      ? db.prepare('SELECT * FROM exercise_sets WHERE exercise_id = ? ORDER BY set_number ASC, id ASC').all(exerciseRow.id)
      : [];
    pushUndo('workouts:deleteSession', { row, sets, exerciseRow: exerciseRow || null, exerciseSets });
    deleteWorkoutSessionExerciseLog(db, id);
    db.prepare('DELETE FROM workout_sessions WHERE id = ?').run(id);
    return { ok: true };
  });
}

module.exports = registerWorkoutsIpc;
module.exports.computeWorkoutStats = computeWorkoutStats;
