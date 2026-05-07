const { ipcMain } = require('electron');
const { getDb } = require('../db');
const { pushUndo } = require('./undo.ipc');

function registerMoodIpc() {
  ipcMain.handle('mood:get', (_, { date }) => {
    const row = getDb().prepare('SELECT * FROM mood_log WHERE date = ?').get(date);
    return row || null;
  });

  ipcMain.handle('mood:upsert', (_, { date, mood, energy, stress, note }) => {
    const db = getDb();

    // Save old row for undo
    const old = db.prepare('SELECT * FROM mood_log WHERE date = ?').get(date);

    db.prepare(`
      INSERT OR REPLACE INTO mood_log (date, mood, energy, stress, note, created_at)
      VALUES (?, ?, ?, ?, ?, COALESCE(
        (SELECT created_at FROM mood_log WHERE date = ?),
        datetime('now')
      ))
    `).run(date, mood ?? null, energy ?? null, stress ?? null, note ?? null, date);

    pushUndo('mood:upsert', { date, old: old || null });

    return db.prepare('SELECT * FROM mood_log WHERE date = ?').get(date);
  });

  ipcMain.handle('mood:range', (_, { from, to }) => {
    return getDb().prepare(
      'SELECT * FROM mood_log WHERE date >= ? AND date <= ? ORDER BY date ASC'
    ).all(from, to);
  });

  ipcMain.handle('mood:delete', (_, { date }) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM mood_log WHERE date = ?').get(date);
    if (row) pushUndo('mood:delete', { row });
    db.prepare('DELETE FROM mood_log WHERE date = ?').run(date);
    return { ok: true };
  });
}

module.exports = registerMoodIpc;
