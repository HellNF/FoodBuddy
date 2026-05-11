const { ipcMain } = require('electron');
const { getDb } = require('../db');
const { pushUndo } = require('./undo.ipc');
const { updateSectionStreak } = require('./streak-utils');
const { addPointsInternal } = require('./gamification.ipc');

const today = () => new Date().toISOString().slice(0, 10);

function offsetDate(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function computeFocusStats(db, { from, to, today: todayStr }) {
  // days: qualified completed sessions aggregated by date
  const days = db.prepare(`
    SELECT date, SUM(duration_min) AS total_min, COUNT(*) AS sessions
    FROM focus_sessions
    WHERE completed = 1 AND date >= ? AND date <= ?
    GROUP BY date
    ORDER BY date
  `).all(from, to);

  // Build a lookup map for quick access
  const dayMap = new Map(days.map(d => [d.date, d.total_min]));

  // current_streak: walk backwards from today
  let current_streak = 0;
  let cursor = todayStr;
  // If today doesn't qualify, try yesterday first
  if (!dayMap.has(cursor) || dayMap.get(cursor) < 10) {
    cursor = offsetDate(todayStr, -1);
  }
  while (dayMap.has(cursor) && dayMap.get(cursor) >= 10) {
    current_streak++;
    cursor = offsetDate(cursor, -1);
  }

  // best_streak: longest consecutive qualifying days in window
  const qualifyingDays = days.filter(d => d.total_min >= 10).map(d => d.date).sort();
  let best_streak = 0;
  let run = 0;
  for (let i = 0; i < qualifyingDays.length; i++) {
    if (i === 0) {
      run = 1;
    } else {
      const expected = offsetDate(qualifyingDays[i - 1], 1);
      run = qualifyingDays[i] === expected ? run + 1 : 1;
    }
    if (run > best_streak) best_streak = run;
  }

  // week_min: last 7 days (today-6 to today)
  const weekStart = offsetDate(todayStr, -6);
  const week_min = days
    .filter(d => d.date >= weekStart && d.date <= todayStr)
    .reduce((acc, d) => acc + d.total_min, 0);

  // last_week_min: days 8-14 ago (today-13 to today-7)
  const lastWeekStart = offsetDate(todayStr, -13);
  const lastWeekEnd = offsetDate(todayStr, -7);
  const last_week_min = days
    .filter(d => d.date >= lastWeekStart && d.date <= lastWeekEnd)
    .reduce((acc, d) => acc + d.total_min, 0);

  // total_min_30d
  const total_min_30d = days.reduce((acc, d) => acc + d.total_min, 0);

  // avg_min_per_active_day
  const activeDays = days.filter(d => d.total_min > 0).length;
  const avg_min_per_active_day = activeDays > 0 ? total_min_30d / activeDays : 0;

  // by_project
  const by_project = db.prepare(`
    SELECT COALESCE(NULLIF(project, ''), '__none__') AS project,
           SUM(duration_min) AS total_min,
           COUNT(*) AS sessions
    FROM focus_sessions
    WHERE completed = 1 AND date >= ? AND date <= ?
    GROUP BY project
    ORDER BY total_min DESC
    LIMIT 6
  `).all(from, to);

  return {
    days,
    current_streak,
    best_streak,
    week_min,
    last_week_min,
    total_min_30d,
    avg_min_per_active_day,
    by_project,
  };
}

function registerFocusIpc() {
  // ── Start a session ─────────────────────────────────────────────────────────
  ipcMain.handle('focus:startSession', (_, { type = 'pomodoro', project = null, note = null } = {}) => {
    const db = getDb();
    const d = today();
    const result = db.prepare(`
      INSERT INTO focus_sessions (date, started_at, ended_at, duration_min, type, project, note, completed)
      VALUES (?, datetime('now'), NULL, 0, ?, ?, ?, 0)
    `).run(d, type, project, note);
    const row = db.prepare('SELECT id, started_at FROM focus_sessions WHERE id = ?').get(result.lastInsertRowid);
    return row;
  });

  // ── Stop a session ──────────────────────────────────────────────────────────
  ipcMain.handle('focus:stopSession', (_, { id, duration_min }) => {
    const db = getDb();
    db.prepare(`
      UPDATE focus_sessions
      SET ended_at = datetime('now'), duration_min = ?, completed = 1
      WHERE id = ?
    `).run(duration_min, id);
    const session = db.prepare('SELECT * FROM focus_sessions WHERE id = ?').get(id);

    if (duration_min >= 10) {
      try {
        const d = session?.date || today();
        const { streak, isNew, milestone, milestonePoints } = updateSectionStreak(db, 'focus', d);
        if (isNew) {
          addPointsInternal(db, 'section_streak', 'streak_daily_focus', 5, { section: 'focus', streak });
          if (milestone) {
            addPointsInternal(db, 'section_streak', `streak_${milestone}_focus`, milestonePoints, { section: 'focus', streak });
          }
        }
      } catch (_) {}
    }

    return session;
  });

  // ── Log manual session ──────────────────────────────────────────────────────
  ipcMain.handle('focus:logManual', (_, { date, duration_min, project = null, note = null }) => {
    const db = getDb();
    const d = date || today();
    const result = db.prepare(`
      INSERT INTO focus_sessions (date, started_at, ended_at, duration_min, type, project, note, completed)
      VALUES (?, ?, datetime(?), ?, 'manual', ?, ?, 1)
    `).run(d, d + 'T00:00:00', d + 'T00:00:00', duration_min, project, note);
    const id = result.lastInsertRowid;
    pushUndo('focus:logManual', { id });

    if (duration_min >= 10) {
      try {
        const { streak, isNew, milestone, milestonePoints } = updateSectionStreak(db, 'focus', d);
        if (isNew) {
          addPointsInternal(db, 'section_streak', 'streak_daily_focus', 5, { section: 'focus', streak });
          if (milestone) {
            addPointsInternal(db, 'section_streak', `streak_${milestone}_focus`, milestonePoints, { section: 'focus', streak });
          }
        }
      } catch (_) {}
    }

    return { id };
  });

  // ── Delete session ──────────────────────────────────────────────────────────
  ipcMain.handle('focus:deleteSession', (_, { id }) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM focus_sessions WHERE id = ?').get(id);
    if (row) pushUndo('focus:deleteSession', { row });
    db.prepare('DELETE FROM focus_sessions WHERE id = ?').run(id);
    return { ok: true };
  });

  // ── Day stats ───────────────────────────────────────────────────────────────
  ipcMain.handle('focus:getDayStats', (_, { date }) => {
    const db = getDb();
    const d = date || today();
    const sessions = db.prepare('SELECT * FROM focus_sessions WHERE date = ? ORDER BY started_at ASC').all(d);
    const completed = sessions.filter(s => s.completed === 1);
    const total_min = completed.reduce((acc, s) => acc + (s.duration_min || 0), 0);
    return {
      sessions,
      total_min,
      total_sessions: sessions.length,
      completed_sessions: completed.length,
    };
  });

  // ── Week stats ──────────────────────────────────────────────────────────────
  ipcMain.handle('focus:getWeekStats', (_, { from, to }) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        date,
        SUM(CASE WHEN completed = 1 THEN duration_min ELSE 0 END) AS total_min,
        COUNT(*) AS sessions
      FROM focus_sessions
      WHERE date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(from, to);
    return rows;
  });

  // ── Get active session ──────────────────────────────────────────────────────
  ipcMain.handle('focus:getActiveSession', () => {
    const db = getDb();
    return db.prepare("SELECT * FROM focus_sessions WHERE completed = 0 AND ended_at IS NULL LIMIT 1").get() || null;
  });

  // ── Aggregate stats ─────────────────────────────────────────────────────────
  ipcMain.handle('focus:getStats', (_, a) =>
    computeFocusStats(getDb(), { from: a.from, to: a.to, today: a.today || new Date().toISOString().slice(0, 10) })
  );
}

module.exports = registerFocusIpc;
module.exports.computeFocusStats = computeFocusStats;
