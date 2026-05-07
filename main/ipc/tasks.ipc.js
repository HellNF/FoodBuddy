const { ipcMain } = require('electron');
const { getDb } = require('../db');
const { pushUndo } = require('./undo.ipc');

const today = () => new Date().toISOString().slice(0, 10);

function prevDate(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function registerTasksIpc() {
  ipcMain.handle('tasks:get', (_, { date }) => {
    const d = date || today();
    return getDb()
      .prepare('SELECT * FROM tasks WHERE date = ? ORDER BY order_idx ASC')
      .all(d);
  });

  ipcMain.handle('tasks:add', (_, { date, title, priority, estimate_min, project }) => {
    const db = getDb();
    const d = date || today();
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(order_idx), -1) AS mx FROM tasks WHERE date = ?')
      .get(d);
    const order_idx = maxRow.mx + 1;
    const result = db
      .prepare(
        'INSERT INTO tasks (date, title, done, priority, estimate_min, project, order_idx) VALUES (?, ?, 0, ?, ?, ?, ?)'
      )
      .run(d, title, priority ?? 0, estimate_min ?? null, project ?? null, order_idx);
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('tasks:toggle', (_, { id }) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!row) return { ok: false };
    const newDone = row.done === 0 ? 1 : 0;
    const nowIso = new Date().toISOString();
    pushUndo('tasks:toggle', { id, old_done: row.done, old_done_at: row.done_at });
    db.prepare('UPDATE tasks SET done = ?, done_at = ? WHERE id = ?').run(
      newDone,
      newDone === 1 ? nowIso : null,
      id
    );
    return { ok: true, done: newDone };
  });

  ipcMain.handle('tasks:update', (_, { id, title, priority, estimate_min, project }) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!row) return { ok: false };
    pushUndo('tasks:update', {
      id,
      old_title: row.title,
      old_priority: row.priority,
      old_estimate_min: row.estimate_min,
      old_project: row.project,
    });
    db.prepare(
      'UPDATE tasks SET title = ?, priority = ?, estimate_min = ?, project = ? WHERE id = ?'
    ).run(
      title !== undefined ? title : row.title,
      priority !== undefined ? priority : row.priority,
      estimate_min !== undefined ? estimate_min : row.estimate_min,
      project !== undefined ? project : row.project,
      id
    );
    return { ok: true };
  });

  ipcMain.handle('tasks:reorder', (_, { ids }) => {
    const db = getDb();
    const stmt = db.prepare('UPDATE tasks SET order_idx = ? WHERE id = ?');
    const update = db.transaction((list) => {
      list.forEach((taskId, idx) => stmt.run(idx, taskId));
    });
    update(ids);
    return { ok: true };
  });

  ipcMain.handle('tasks:delete', (_, { id }) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (row) pushUndo('tasks:delete', { row });
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return { ok: true };
  });

  ipcMain.handle('tasks:rolloverFromYesterday', (_, { date }) => {
    const db = getDb();
    const d = date || today();
    const yesterday = prevDate(d);
    const undoneTasks = db
      .prepare("SELECT * FROM tasks WHERE date = ? AND done = 0")
      .all(yesterday);
    if (undoneTasks.length === 0) return { count: 0 };
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(order_idx), -1) AS mx FROM tasks WHERE date = ?')
      .get(d);
    let order_idx = maxRow.mx + 1;
    const insert = db.prepare(
      'INSERT INTO tasks (date, title, done, priority, estimate_min, project, order_idx) VALUES (?, ?, 0, ?, ?, ?, ?)'
    );
    const insertAll = db.transaction((tasks) => {
      tasks.forEach((t) => {
        insert.run(d, t.title, t.priority, t.estimate_min, t.project, order_idx++);
      });
    });
    insertAll(undoneTasks);
    return { count: undoneTasks.length };
  });

  ipcMain.handle('tasks:completionRate', (_, { date }) => {
    const db = getDb();
    const d = date || today();
    const row = db
      .prepare(
        'SELECT COUNT(*) AS total, SUM(done) AS done FROM tasks WHERE date = ?'
      )
      .get(d);
    const total = row.total ?? 0;
    const done = row.done ?? 0;
    return { total, done, rate: total > 0 ? done / total : 0 };
  });
}

module.exports = registerTasksIpc;
