const { ipcMain } = require('electron');
const { getDb } = require('../db');
const { pushUndo } = require('./undo.ipc');
const { updateSectionStreak } = require('./streak-utils');
const { addPointsInternal } = require('./gamification.ipc');

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Calculate sleep duration in minutes.
 * Bedtime may be the previous night (e.g. 23:00 → 07:00 = 8h).
 * If bedtime hour > 12 and wake hour <= 12, add 24*60 to the diff.
 */
function calcDurationMin(bedtime, wake_time) {
  if (!bedtime || !wake_time) return null;
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wake_time.split(':').map(Number);
  let bedMins  = bh * 60 + bm;
  let wakeMins = wh * 60 + wm;
  if (bh >= 12 && wh <= 12) {
    wakeMins += 24 * 60;
  }
  const diff = wakeMins - bedMins;
  return diff > 0 ? diff : null;
}

function offsetDate(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const SLEEP_TARGET_MIN = 480;

/**
 * Compute sleep statistics over a date window.
 * @param {import('better-sqlite3').Database} db
 * @param {{ from: string, to: string, today: string }} opts
 */
function computeSleepStats(db, { from, to, today: todayStr }) {
  // --- 1. Fetch all rows in [from, to] ---
  const rows = db.prepare(
    'SELECT date, duration_min, quality, factors FROM sleep_log WHERE date >= ? AND date <= ? ORDER BY date ASC'
  ).all(from, to);

  const days = rows.map(r => ({
    date: r.date,
    duration_min: r.duration_min ?? null,
    quality: r.quality ?? null,
  }));

  // Build a Set for O(1) date lookups
  const dateSet = new Set(rows.map(r => r.date));

  // --- 2. logged_streak: walk backwards from today (or yesterday) ---
  let logged_streak = 0;
  let startDay = todayStr;
  if (!dateSet.has(startDay)) {
    startDay = offsetDate(todayStr, -1);
    if (!dateSet.has(startDay)) {
      startDay = null;
    }
  }
  if (startDay) {
    let cursor = startDay;
    while (dateSet.has(cursor)) {
      logged_streak++;
      cursor = offsetDate(cursor, -1);
    }
  }

  // --- 3. best_logged_streak: longest consecutive run in [from, to] ---
  let best_logged_streak = 0;
  let currentRun = 0;
  let prevDate = null;
  for (const r of rows) {
    if (prevDate === null) {
      currentRun = 1;
    } else {
      const expected = offsetDate(prevDate, 1);
      if (r.date === expected) {
        currentRun++;
      } else {
        currentRun = 1;
      }
    }
    if (currentRun > best_logged_streak) best_logged_streak = currentRun;
    prevDate = r.date;
  }

  // --- 4. days_logged_30d: rows within last 30 days from today ---
  const thirtyDaysAgo = offsetDate(todayStr, -29); // today inclusive = 30 days
  const days_logged_30d = rows.filter(r => r.date >= thirtyDaysAgo && r.date <= todayStr).length;

  // --- 5. Averages ---
  const durRows = rows.filter(r => r.duration_min != null);
  const avg_duration_min = durRows.length
    ? durRows.reduce((s, r) => s + r.duration_min, 0) / durRows.length
    : null;

  const qualRows = rows.filter(r => r.quality != null);
  const avg_quality = qualRows.length
    ? qualRows.reduce((s, r) => s + r.quality, 0) / qualRows.length
    : null;

  // week_avg_min: last 7 days from today (today - 6 to today)
  const weekStart = offsetDate(todayStr, -6);
  const weekRows = rows.filter(r => r.date >= weekStart && r.date <= todayStr && r.duration_min != null);
  const week_avg_min = weekRows.length
    ? weekRows.reduce((s, r) => s + r.duration_min, 0) / weekRows.length
    : null;

  // last_week_avg_min: the 7 days before that (today - 13 to today - 7)
  const lastWeekEnd = offsetDate(todayStr, -7);
  const lastWeekStart = offsetDate(todayStr, -13);
  const lastWeekRows = rows.filter(r => r.date >= lastWeekStart && r.date <= lastWeekEnd && r.duration_min != null);
  const last_week_avg_min = lastWeekRows.length
    ? lastWeekRows.reduce((s, r) => s + r.duration_min, 0) / lastWeekRows.length
    : null;

  // --- 6. debt_min_7d: last 7 logged days ---
  const last7LoggedRows = rows
    .filter(r => r.duration_min != null)
    .slice(-7);
  const debt_min_7d = last7LoggedRows.reduce((s, r) => s + Math.max(0, SLEEP_TARGET_MIN - r.duration_min), 0);

  // --- 7. factor_counts ---
  const factorMap = new Map();
  for (const r of rows) {
    if (!r.factors) continue;
    let parsed;
    try {
      parsed = JSON.parse(r.factors);
    } catch (_) {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    for (const f of parsed) {
      factorMap.set(f, (factorMap.get(f) || 0) + 1);
    }
  }
  const factor_counts = Array.from(factorMap.entries())
    .map(([factor, count]) => ({ factor, count }))
    .sort((a, b) => b.count - a.count);

  // --- 8. best_night ---
  const durRowsSorted = rows.filter(r => r.duration_min != null);
  let best_night = null;
  if (durRowsSorted.length) {
    const best = durRowsSorted.reduce((best, r) => r.duration_min > best.duration_min ? r : best);
    best_night = { date: best.date, duration_min: best.duration_min };
  }

  return {
    days,
    logged_streak,
    best_logged_streak,
    days_logged_30d,
    avg_duration_min,
    avg_quality,
    week_avg_min,
    last_week_avg_min,
    debt_min_7d,
    factor_counts,
    best_night,
  };
}

function registerSleepIpc() {
  ipcMain.handle('sleep:get', (_, { date }) => {
    const d = date || today();
    const row = getDb().prepare('SELECT * FROM sleep_log WHERE date = ?').get(d);
    return row || null;
  });

  ipcMain.handle('sleep:upsert', (_, { date, bedtime, wake_time, quality, factors, note }) => {
    const d = date || today();
    const duration_min = calcDurationMin(bedtime, wake_time);
    const db = getDb();

    // Save old row for undo
    const old = db.prepare('SELECT * FROM sleep_log WHERE date = ?').get(d);

    db.prepare(`
      INSERT OR REPLACE INTO sleep_log (date, bedtime, wake_time, duration_min, quality, factors, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(
        (SELECT created_at FROM sleep_log WHERE date = ?),
        datetime('now')
      ))
    `).run(d, bedtime || null, wake_time || null, duration_min, quality || null,
           factors != null ? JSON.stringify(factors) : null, note || null, d);

    pushUndo('sleep:upsert', { date: d, old: old || null });

    try {
      const { streak, isNew, milestone, milestonePoints } = updateSectionStreak(db, 'sleep', d);
      if (isNew) {
        addPointsInternal(db, 'section_streak', 'streak_daily_sleep', 5, { section: 'sleep', streak });
        if (milestone) {
          addPointsInternal(db, 'section_streak', `streak_${milestone}_sleep`, milestonePoints, { section: 'sleep', streak });
        }
      }
    } catch (_) {}

    return { ok: true };
  });

  ipcMain.handle('sleep:range', (_, { from, to }) => {
    return getDb().prepare(
      'SELECT * FROM sleep_log WHERE date >= ? AND date <= ? ORDER BY date ASC'
    ).all(from, to);
  });

  ipcMain.handle('sleep:delete', (_, { date }) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM sleep_log WHERE date = ?').get(date);
    if (row) pushUndo('sleep:delete', { row });
    db.prepare('DELETE FROM sleep_log WHERE date = ?').run(date);
    return { ok: true };
  });

  ipcMain.handle('sleep:getStats', (_, a) =>
    computeSleepStats(getDb(), {
      from: a.from,
      to: a.to,
      today: a.today || new Date().toISOString().slice(0, 10),
    })
  );
}

module.exports = registerSleepIpc;
module.exports.computeSleepStats = computeSleepStats;
