'use strict';

function isRecent(achievedDate, todayDate) {
  const t = new Date(todayDate + 'T00:00:00Z').getTime();
  const a = new Date(achievedDate + 'T00:00:00Z').getTime();
  return (t - a) / 86400000 <= 3;
}

function checkConsecutiveStreak(facts, valueFn, target) {
  let streak = 0;
  let achievedAt = null;
  for (const f of facts) {
    if (valueFn(f)) {
      streak++;
      if (streak >= target) achievedAt = f.date;
    } else {
      streak = 0;
    }
  }
  return { achievedAt, streak };
}

function findMilestones(facts, settings) {
  if (!facts || facts.length === 0) return [];
  const sleepTarget = settings.sleepTargetMin ?? 480;
  const today = facts[facts.length - 1].date;
  const out = [];

  // Habit streaks: 7, 14, 30
  for (const target of [7, 14, 30]) {
    const { achievedAt, streak } = checkConsecutiveStreak(
      facts,
      f => f.habitPct != null && f.habitPct >= 0.5,
      target
    );
    if (achievedAt && isRecent(achievedAt, today)) {
      out.push({ kind: 'milestone', id: `habit_streak_${target}`, achievedDate: achievedAt, streakLength: streak, value: null });
    }
  }

  // Log streaks: 7, 14
  for (const target of [7, 14]) {
    const { achievedAt, streak } = checkConsecutiveStreak(
      facts,
      f => f.kcalIn != null && f.kcalIn > 0,
      target
    );
    if (achievedAt && isRecent(achievedAt, today)) {
      out.push({ kind: 'milestone', id: `log_streak_${target}`, achievedDate: achievedAt, streakLength: streak, value: null });
    }
  }

  // Weight new low (needs >= 14 weight entries)
  const weightFacts = facts.filter(f => f.weight != null);
  if (weightFacts.length >= 14) {
    const last = weightFacts[weightFacts.length - 1];
    const prevMin = Math.min(...weightFacts.slice(0, -1).map(f => f.weight));
    if (last.weight < prevMin && isRecent(last.date, today)) {
      out.push({ kind: 'milestone', id: 'weight_new_low', achievedDate: last.date, streakLength: null, value: last.weight });
    }
  }

  // Perfect day (yesterday)
  if (facts.length >= 2) {
    const yesterday = facts[facts.length - 2];
    const isPerfect =
      yesterday.habitPct != null && yesterday.habitPct >= 0.8 &&
      yesterday.kcalIn != null && yesterday.kcalIn > 0 &&
      yesterday.sleepMin != null && yesterday.sleepMin >= sleepTarget;
    if (isPerfect && isRecent(yesterday.date, today)) {
      out.push({ kind: 'milestone', id: 'perfect_day', achievedDate: yesterday.date, streakLength: null, value: null });
    }
  }

  return out;
}

module.exports = { findMilestones };
