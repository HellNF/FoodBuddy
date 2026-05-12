'use strict';

const { ipcMain } = require('electron');
const { getDb } = require('../db');
const { getDefaultPantryId } = require('../lib/pantryFefo');

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getSettingStr(db, key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function getSettingNum(db, key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? (parseFloat(row.value) || fallback) : fallback;
}

// Returns the current meal slot based on configured meal times.
// Picks the last configured time that is <= now; defaults to Breakfast before the first.
function currentMealSlot(db) {
  const SLOTS = [
    { key: 'notif_meal_breakfast_time', col: 'Breakfast',      def: '08:00' },
    { key: 'notif_meal_lunch_time',     col: 'Lunch',          def: '13:00' },
    { key: 'notif_meal_snack_time',     col: 'AfternoonSnack', def: '16:00' },
    { key: 'notif_meal_dinner_time',    col: 'Dinner',         def: '20:00' },
  ];
  const now = nowHHMM();
  // Load and sort by configured time
  const resolved = SLOTS.map(s => ({ col: s.col, time: getSettingStr(db, s.key, s.def) }))
    .sort((a, b) => a.time.localeCompare(b.time));
  let active = resolved[0].col;
  for (const { col, time } of resolved) {
    if (time <= now) active = col;
  }
  return active;
}

function registerMealSuggestionsIpc() {
  ipcMain.handle('meals:getSuggestions', () => {
    try {
      const db = getDb();
      const today = todayISO();

      // Remaining kcal for today
      const consumed = db.prepare(`
        SELECT COALESCE(SUM(f.calories * l.grams / 100.0), 0) AS kcal
        FROM log l JOIN foods f ON f.id = l.food_id
        WHERE l.date = ? AND l.status = 'logged'
      `).get(today).kcal;
      const target = getSettingNum(db, 'cal_rec', 2250);
      const remainingKcal = Math.round(target - consumed);
      const mealSlot = currentMealSlot(db);

      if (remainingKcal <= 50) {
        return { suggestions: [], remainingKcal, mealSlot };
      }

      // Candidate foods — pantry (FEFO)
      const pantryId = getDefaultPantryId(db);
      const pantryRows = db.prepare(`
        SELECT p.food_id, f.id, f.name, f.calories, f.piece_grams, f.is_bulk,
               MIN(p.expiry_date) AS expiry
        FROM pantry p JOIN foods f ON f.id = p.food_id
        WHERE p.pantry_id = ? AND f.is_placeholder = 0 AND f.calories > 0
        GROUP BY p.food_id
        ORDER BY (expiry IS NULL), expiry ASC
      `).all(pantryId);

      // Candidate foods — frequent
      const frequentRows = db.prepare(`
        SELECT f.id, f.name, f.calories, f.piece_grams, f.is_bulk, COUNT(l.id) AS use_count
        FROM foods f JOIN log l ON l.food_id = f.id
        WHERE f.is_placeholder = 0 AND f.calories > 0
        GROUP BY f.id ORDER BY use_count DESC LIMIT 12
      `).all();

      // Merge: pantry wins on duplicate food_id
      const candidateMap = new Map();
      for (const r of frequentRows) {
        candidateMap.set(r.id, { ...r, source: 'frequent', expiry: null, use_count: r.use_count });
      }
      for (const r of pantryRows) {
        candidateMap.set(r.food_id, { id: r.food_id, name: r.name, calories: r.calories,
          piece_grams: r.piece_grams, is_bulk: r.is_bulk,
          source: 'pantry', expiry: r.expiry,
          use_count: candidateMap.get(r.food_id)?.use_count ?? 0 });
      }
      const candidates = [...candidateMap.values()];
      if (candidates.length === 0) {
        return { suggestions: [], remainingKcal, mealSlot };
      }

      // Slot affinity: how many times each food was logged in this meal slot (last 60 days)
      const slotRows = db.prepare(`
        SELECT food_id, COUNT(*) AS c FROM log
        WHERE meal = ? AND date >= date('now','-60 day') AND status = 'logged'
        GROUP BY food_id
      `).all(mealSlot);
      const slotMap = new Map(slotRows.map(r => [r.food_id, r.c]));

      // Min package grams per food (batch query)
      const ids = candidates.map(c => c.id);
      const pkgRows = ids.length
        ? db.prepare(`SELECT food_id, MIN(grams) AS min_g FROM food_packages WHERE food_id IN (${ids.map(() => '?').join(',')}) GROUP BY food_id`).all(...ids)
        : [];
      const pkgMap = new Map(pkgRows.map(r => [r.food_id, r.min_g]));

      // Today string for expiry comparison
      const todayStr = today;

      // Score and build result
      const scored = candidates.map(c => {
        const minPkg = pkgMap.get(c.id);
        const suggestedGrams = (c.is_bulk !== 1 && minPkg != null) ? minPkg : (c.piece_grams || 100);
        const portionKcal = Math.round(c.calories * suggestedGrams / 100);
        const slotCount = slotMap.get(c.id) ?? 0;

        // Expiry urgency
        let expiryBonus = 0;
        if (c.expiry) {
          const diffMs = new Date(c.expiry) - new Date(todayStr);
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays <= 3) expiryBonus = 2;
        }

        const score =
          (c.source === 'pantry' ? 3 : 0) +
          2 * Math.min(slotCount, 3) +
          Math.min((c.use_count || 0) / 5, 3) +
          expiryBonus +
          (portionKcal > remainingKcal * 1.5 ? -2 : 0);

        return {
          food_id: c.id, name: c.name, calories: c.calories,
          suggestedGrams, portionKcal,
          source: c.source, expiry: c.expiry ?? null,
          _score: score,
        };
      });

      scored.sort((a, b) => b._score - a._score);
      const suggestions = scored.slice(0, 5).map(({ _score, ...rest }) => rest);

      return { remainingKcal, mealSlot, suggestions };
    } catch (err) {
      console.error('[meal_suggestions] getSuggestions error:', err);
      return { suggestions: [], remainingKcal: 0, mealSlot: 'AfternoonSnack' };
    }
  });
}

module.exports = registerMealSuggestionsIpc;
