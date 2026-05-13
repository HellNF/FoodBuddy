// Meal-logging OS reminders (Electron Notification API).
// Fires once per meal per day at the configured local time, but only if that
// meal has no 'logged' entries in the log table for today.
// Limitation: notifications only work while the app is running. Missed
// reminders (app closed at fire time) are not backfilled on next launch —
// except for the tick that runs immediately at startup, which covers the
// case where the app is launched exactly at a configured minute.

'use strict';

const { Notification } = require('electron');
const { getDb } = require('../db');

// ── i18n strings (renderer i18n bundle not available in main process) ─────────

const STRINGS = {
  en: {
    Breakfast:      { title: 'Log your breakfast', body: "You haven't logged breakfast yet today." },
    Lunch:          { title: 'Log your lunch',     body: "You haven't logged lunch yet today." },
    Dinner:         { title: 'Log your dinner',    body: "You haven't logged dinner yet today." },
    AfternoonSnack: { title: 'Log your snack',     body: "You haven't logged a snack yet today." },
  },
  it: {
    Breakfast:      { title: 'Registra la colazione', body: 'Non hai ancora registrato la colazione oggi.' },
    Lunch:          { title: 'Registra il pranzo',    body: 'Non hai ancora registrato il pranzo oggi.' },
    Dinner:         { title: 'Registra la cena',      body: 'Non hai ancora registrato la cena oggi.' },
    AfternoonSnack: { title: 'Registra lo spuntino',  body: 'Non hai ancora registrato uno spuntino oggi.' },
  },
};

// ── Meal descriptors ──────────────────────────────────────────────────────────

const MEALS = [
  { enableKey: 'notif_meal_breakfast', timeKey: 'notif_meal_breakfast_time', col: 'Breakfast',      defaultTime: '08:00' },
  { enableKey: 'notif_meal_lunch',     timeKey: 'notif_meal_lunch_time',     col: 'Lunch',          defaultTime: '13:00' },
  { enableKey: 'notif_meal_dinner',    timeKey: 'notif_meal_dinner_time',    col: 'Dinner',         defaultTime: '20:00' },
  { enableKey: 'notif_meal_snack',     timeKey: 'notif_meal_snack_time',     col: 'AfternoonSnack', defaultTime: '16:00' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getSettingStr(db, key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

// ── State ─────────────────────────────────────────────────────────────────────

let timer = null;
const lastFired = {}; // col → "YYYY-MM-DD|col" — guards against double-fire within a minute

// ── Core tick ─────────────────────────────────────────────────────────────────

function tick(getMainWindow) {
  try {
    const db = getDb();

    if (getSettingStr(db, 'notif_meal_reminders', '0') !== '1') return;

    const today = todayISO();
    const now = nowHHMM();
    const lang = getSettingStr(db, 'language', 'en');
    const strings = STRINGS[lang] ?? STRINGS.en;

    for (const m of MEALS) {
      if (getSettingStr(db, m.enableKey, '1') !== '1') continue;

      const configuredTime = getSettingStr(db, m.timeKey, m.defaultTime);
      if (!/^\d{2}:\d{2}$/.test(configuredTime)) continue;
      if (configuredTime !== now) continue;

      const firedKey = `${today}|${m.col}`;
      if (lastFired[m.col] === firedKey) continue; // already fired this minute

      const alreadyLogged = db.prepare(
        "SELECT COUNT(*) AS n FROM log WHERE date = ? AND meal = ? AND status = 'logged'"
      ).get(today, m.col).n;

      if (alreadyLogged > 0) {
        lastFired[m.col] = firedKey;
        continue;
      }

      if (Notification.isSupported()) {
        const { title, body } = strings[m.col];
        const notif = new Notification({ title, body });
        notif.on('click', () => {
          const w = getMainWindow();
          if (w) {
            if (w.isMinimized()) w.restore();
            w.show();
            w.focus();
            w.webContents.send('shortcut:quickAdd');
          }
        });
        notif.show();
      }

      lastFired[m.col] = firedKey;
    }
  } catch (err) {
    console.error('[meal_reminders] tick error:', err);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function startMealReminders(getMainWindow) {
  if (timer) return;
  tick(getMainWindow); // fire once immediately (covers launch-at-reminder-minute case)
  timer = setInterval(() => tick(getMainWindow), 30_000);
}

function stopMealReminders() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { startMealReminders, stopMealReminders };
