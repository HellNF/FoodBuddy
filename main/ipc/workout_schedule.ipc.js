const { ipcMain } = require('electron');
const { getDb } = require('../db');
const { syncWorkoutSessionToExerciseLog, deleteWorkoutSessionExerciseLog } = require('./workout-log-sync');

function estimatePlanDurationMin(planExercises) {
  let total = 0;
  for (const pe of planExercises) {
    if (pe.target_duration_min != null) {
      total += pe.target_duration_min;
    } else {
      const sets = pe.target_sets || 3;
      const restSec = pe.rest_sec ?? 60;
      // ~30s working time per set + rest
      total += (sets * (30 + restSec)) / 60;
    }
  }
  return Math.max(1, Math.round(total));
}

/**
 * Auto-create a workout_session from a plan for a given date, populating sets
 * with target_sets × target_reps/target_weight rows. Mirrors the session-end
 * flow so syncWorkoutSessionToExerciseLog populates the legacy `exercises`
 * table (muscle activity + fatigue counts it).
 */
function createSessionFromPlan(db, planId, date) {
  const planExercises = db.prepare(`
    SELECT * FROM workout_plan_exercises
    WHERE plan_id = ? ORDER BY sort_order ASC, id ASC
  `).all(planId);

  const durationMin = estimatePlanDurationMin(planExercises);
  const startedAt = `${date}T12:00:00.000Z`;
  const endedAt   = `${date}T12:${String(Math.min(59, durationMin)).padStart(2, '0')}:00.000Z`;

  const ins = db.prepare(`
    INSERT INTO workout_sessions (date, plan_id, started_at, ended_at, duration_min, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(date, planId, startedAt, endedAt, durationMin, 'Auto-loggato da pianificazione');
  const sessionId = ins.lastInsertRowid;

  const insSet = db.prepare(`
    INSERT INTO workout_exercise_sets
      (session_id, exercise_id, set_idx, reps, weight_kg, distance_km, duration_sec, rest_sec)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const pe of planExercises) {
    const sets = pe.target_duration_min != null ? 1 : (pe.target_sets || 3);
    const durSec = pe.target_duration_min != null ? Math.round(pe.target_duration_min * 60) : null;
    for (let i = 0; i < sets; i++) {
      insSet.run(
        sessionId,
        pe.exercise_type_id,
        i,
        pe.target_reps ?? null,
        pe.target_weight_kg ?? null,
        null,
        durSec,
        pe.rest_sec ?? null,
      );
    }
  }

  syncWorkoutSessionToExerciseLog(db, sessionId);
  return sessionId;
}

function deleteAutoSession(db, sessionId) {
  if (!sessionId) return;
  deleteWorkoutSessionExerciseLog(db, sessionId);
  db.prepare('DELETE FROM workout_exercise_sets WHERE session_id = ?').run(sessionId);
  db.prepare('DELETE FROM workout_sessions WHERE id = ?').run(sessionId);
}

function registerWorkoutScheduleIpc() {
  ipcMain.handle('workoutSchedule:getWeek', (_, { weekStart }) => {
    const db = getDb();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const date = d.toISOString().slice(0, 10);
      const entries = db.prepare(
        `SELECT ws.*, wp.name AS plan_name
         FROM workout_schedule ws
         LEFT JOIN workout_plans wp ON wp.id = ws.plan_id
         WHERE ws.date = ? ORDER BY ws.id`
      ).all(date);
      const exercisesLogged = db.prepare('SELECT COUNT(*) AS n FROM exercises WHERE date=?').get(date)?.n || 0;
      days.push({ date, entries, exercises_logged: exercisesLogged });
    }
    return days;
  });

  ipcMain.handle('workoutSchedule:getDay', (_, { date }) => {
    const db = getDb();
    const entries = db.prepare(
      `SELECT ws.*, wp.name AS plan_name
       FROM workout_schedule ws
       LEFT JOIN workout_plans wp ON wp.id = ws.plan_id
       WHERE ws.date = ? ORDER BY ws.id`
    ).all(date);
    return entries;
  });

  ipcMain.handle('workoutSchedule:assign', (_, { date, plan_id }) => {
    const { lastInsertRowid } = getDb().prepare(
      'INSERT INTO workout_schedule (date, plan_id, status) VALUES (?, ?, \'planned\')'
    ).run(date, plan_id);
    return { id: lastInsertRowid, ok: true };
  });

  ipcMain.handle('workoutSchedule:setRest', (_, { date }) => {
    const { lastInsertRowid } = getDb().prepare(
      'INSERT INTO workout_schedule (date, plan_id, status) VALUES (?, NULL, \'rest\')'
    ).run(date);
    return { id: lastInsertRowid, ok: true };
  });

  ipcMain.handle('workoutSchedule:clear', (_, { id }) => {
    const db = getDb();
    const sched = db.prepare('SELECT workout_session_id FROM workout_schedule WHERE id=?').get(id);
    if (sched?.workout_session_id) deleteAutoSession(db, sched.workout_session_id);
    db.prepare('DELETE FROM workout_schedule WHERE id=?').run(id);
    return { ok: true };
  });

  ipcMain.handle('workoutSchedule:setStatus', (_, { id, status }) => {
    const db = getDb();
    const sched = db.prepare('SELECT * FROM workout_schedule WHERE id=?').get(id);
    if (!sched) return { ok: false };

    return db.transaction(() => {
      // Auto-log: tick → done, plan attached, no session yet
      if (status === 'done' && sched.plan_id && !sched.workout_session_id) {
        const sessionId = createSessionFromPlan(db, sched.plan_id, sched.date);
        db.prepare('UPDATE workout_schedule SET status=?, workout_session_id=? WHERE id=?')
          .run(status, sessionId, id);
        return { ok: true, session_id: sessionId };
      }

      // Auto-clean: leaving done with an auto-session attached → remove it
      if (status !== 'done' && sched.workout_session_id) {
        deleteAutoSession(db, sched.workout_session_id);
        db.prepare('UPDATE workout_schedule SET status=?, workout_session_id=NULL WHERE id=?')
          .run(status, id);
        return { ok: true };
      }

      db.prepare('UPDATE workout_schedule SET status=? WHERE id=?').run(status, id);
      return { ok: true };
    })();
  });

  ipcMain.handle('workoutSchedule:move', (_, { id, toDate }) => {
    getDb().prepare('UPDATE workout_schedule SET date=? WHERE id=?').run(toDate, id);
    return { ok: true };
  });

  ipcMain.handle('workoutSchedule:swap', (_, { idA, idB }) => {
    const db = getDb();
    return db.transaction(() => {
      const a = db.prepare('SELECT date FROM workout_schedule WHERE id=?').get(idA);
      const b = db.prepare('SELECT date FROM workout_schedule WHERE id=?').get(idB);
      if (!a || !b) return { ok: false };
      db.prepare('UPDATE workout_schedule SET date=? WHERE id=?').run(b.date, idA);
      db.prepare('UPDATE workout_schedule SET date=? WHERE id=?').run(a.date, idB);
      return { ok: true };
    })();
  });
}

module.exports = registerWorkoutScheduleIpc;
