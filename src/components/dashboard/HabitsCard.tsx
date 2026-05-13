import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { useT } from '../../i18n/useT';
import { useNavigate } from '../../hooks/useNavigate';
import { cardOuter, eyebrow } from '../../lib/fbUI';
import { today as todayStr } from '../../lib/dateUtil';
import type { Habit, HabitWeekStat, WidgetSize } from '../../types';

function Ring({ size = 80, pct = 70, color = 'var(--fb-accent)' }: { size?: number; pct?: number; color?: string }) {
  const r = (size - 10) / 2; const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--fb-border)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

export default function HabitsCard({ size = 'M' }: { size?: WidgetSize }) {
  const { t } = useT();
  const { navigate } = useNavigate();
  const today = todayStr();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkedToday, setCheckedToday] = useState<Set<number>>(new Set());
  const [weekStats, setWeekStats] = useState<HabitWeekStat[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [list, stats] = await Promise.all([
        api.habits.list() as Promise<Habit[]>,
        api.habits.getWeekStats(today) as Promise<HabitWeekStat[]>,
      ]);
      setHabits(list);
      setWeekStats(stats);
      const checked = new Set<number>();
      stats.forEach(s => {
        const c = s.checks.find(c => c.date === today);
        if (c?.done) checked.add(s.habit_id);
      });
      setCheckedToday(checked);
      setLoaded(true);
    } catch { setLoaded(true); }
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleToggle(habit: Habit) {
    const isChecked = checkedToday.has(habit.id);
    setCheckedToday(prev => {
      const n = new Set(prev);
      if (isChecked) n.delete(habit.id); else n.add(habit.id);
      return n;
    });
    try {
      if (isChecked) await api.habits.uncheck(habit.id, today);
      else await api.habits.check(habit.id, today);
    } catch {
      setCheckedToday(prev => {
        const n = new Set(prev);
        if (isChecked) n.add(habit.id); else n.delete(habit.id);
        return n;
      });
    }
  }

  const completed = checkedToday.size;
  const total = habits.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  // ── XS ────────────────────────────────────────────────────────────────────
  if (size === 'XS') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 12, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ ...eyebrow, fontSize: 8.5 }}>{t('habits.eyebrow')}</span>
        <div style={{ position: 'relative' }}>
          <Ring size={70} pct={pct} color="var(--fb-accent)" />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 20, color: 'var(--fb-accent)' }}>{completed}</span>
            <span style={{ fontSize: 8, color: 'var(--fb-text-3)', marginTop: -2 }}>/ {total}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {habits.slice(0, 3).map(h => {
            const ck = checkedToday.has(h.id);
            return <span key={h.id} style={{
              width: 10, height: 10, borderRadius: 99,
              border: `1.5px solid ${ck ? h.color : 'var(--fb-border-strong, var(--fb-border))'}`,
              background: ck ? h.color : 'transparent',
            }} />;
          })}
        </div>
      </div>
    );
  }

  // ── S ─────────────────────────────────────────────────────────────────────
  if (size === 'S') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 12, display: 'grid', gridTemplateColumns: '78px 1fr', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Ring size={78} pct={pct} color="var(--fb-accent)" />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, color: 'var(--fb-accent)' }}>{completed}</span>
            <span style={{ fontSize: 8, color: 'var(--fb-text-3)', marginTop: -2 }}>/ {total}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <span style={{ ...eyebrow, fontSize: 9 }}>{t('habits.eyebrow')}</span>
          {habits.slice(0, 3).map(h => {
            const ck = checkedToday.has(h.id);
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => handleToggle(h)} style={{
                  width: 14, height: 14, borderRadius: 4, padding: 0,
                  border: `1.5px solid ${ck ? h.color : 'var(--fb-border-strong, var(--fb-border))'}`,
                  background: ck ? h.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 9, flexShrink: 0, cursor: 'pointer',
                }}>{ck ? '✓' : ''}</button>
                <span style={{ fontSize: 11.5 }}>{h.icon}</span>
                <span style={{ fontSize: 11, color: ck ? 'var(--fb-text-3)' : 'var(--fb-text)', textDecoration: ck ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const weekGrid = ['L','M','M','G','V','S','D'];

  // ── M ─────────────────────────────────────────────────────────────────────
  if (size === 'M') {
    function habitWeekDone(h: Habit, dayIdx: number): boolean {
      const s = weekStats.find(s => s.habit_id === h.id);
      if (!s) return false;
      const date = new Date(); date.setDate(date.getDate() - (6 - dayIdx));
      const ds = date.toISOString().slice(0, 10);
      return !!s.checks.find(c => c.date === ds && c.done);
    }
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 18, gap: 14, justifyContent: 'flex-start', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Ring size={130} pct={pct} color="var(--fb-accent)" />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 40, color: 'var(--fb-accent)' }}>{completed}</span>
              <span style={{ fontSize: 10, color: 'var(--fb-text-3)', marginTop: -2 }}>/ {total}</span>
              <span style={{ fontSize: 9, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginTop: 3 }}>{Math.round(pct)}% oggi</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={eyebrow}>{t('habits.eyebrow')}</span>
            <div style={{ fontSize: 10.5, color: 'var(--fb-text-3)' }}>{t('habits.completedToday').replace('{n}', String(completed))}</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 10, borderTop: '1px solid var(--fb-divider)', overflow: 'hidden' }}>
          {habits.slice(0, 4).map(h => {
            const ck = checkedToday.has(h.id);
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => handleToggle(h)} style={{
                  width: 20, height: 20, borderRadius: 99, padding: 0,
                  border: `2px solid ${ck ? h.color : 'var(--fb-border)'}`,
                  background: ck ? h.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, flexShrink: 0, cursor: 'pointer',
                }}>{ck ? '✓' : ''}</button>
                <span style={{ fontSize: 13 }}>{h.icon}</span>
                <span style={{ flex: 1, fontSize: 12, color: ck ? 'var(--fb-text-3)' : 'var(--fb-text)', textDecoration: ck ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  {weekGrid.map((d, i) => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: 2,
                      background: habitWeekDone(h, i) ? h.color : 'var(--fb-border-strong, var(--fb-border))',
                      opacity: i === 6 ? 1 : 0.55,
                    }} title={d} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── L ─────────────────────────────────────────────────────────────────────
  const WEEKS = 20;
  function habitIntensity(habitId: number, w: number, d: number): 0|1|2|3|4 {
    const stat = weekStats.find(s => s.habit_id === habitId);
    if (!stat) return 0;
    // Approx — pick a check from history
    const idx = (w * 7 + d) % stat.checks.length;
    return stat.checks[idx]?.done ? 4 : 0;
  }
  // Aggregate per cell — sum of done habits in that day
  function cellIntensity(w: number, d: number): 0|1|2|3|4 {
    let sum = 0;
    for (const h of habits) sum += habitIntensity(h.id, w, d);
    const max = habits.length * 4;
    if (max === 0) return 0;
    const v = sum / max;
    if (v <= 0) return 0;
    if (v <= 0.25) return 1;
    if (v <= 0.5) return 2;
    if (v <= 0.75) return 3;
    return 4;
  }
  return (
    <div style={{ ...cardOuter, height: '100%', padding: 20, display: 'grid', gridTemplateColumns: '180px 200px 1fr', gap: 20, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        <span style={eyebrow}>{t('habits.eyebrow')} · oggi</span>
        <div style={{ position: 'relative' }}>
          <Ring size={150} pct={pct} color="var(--fb-accent)" />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 44, color: 'var(--fb-accent)' }}>{completed}</span>
            <span style={{ fontSize: 12, color: 'var(--fb-text-3)' }}>/ {total}</span>
            <span style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginTop: 4 }}>{Math.round(pct)}% done</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Today</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
          {habits.slice(0, 6).map(h => {
            const ck = checkedToday.has(h.id);
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => handleToggle(h)} style={{
                  width: 16, height: 16, borderRadius: 99, padding: 0,
                  border: `2px solid ${ck ? h.color : 'var(--fb-border)'}`,
                  background: ck ? h.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 9, flexShrink: 0, cursor: 'pointer',
                }}>{ck ? '✓' : ''}</button>
                <span style={{ fontSize: 11.5, width: 14, textAlign: 'center' }}>{h.icon}</span>
                <span style={{ flex: 1, fontSize: 11, color: ck ? 'var(--fb-text-3)' : 'var(--fb-text)', textDecoration: ck ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18, borderLeft: '1px solid var(--fb-divider)', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Activity · {WEEKS} weeks</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'var(--fb-text-3)' }}>
            <span>Less</span>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{
                width: 11, height: 11, borderRadius: 2,
                background: i === 0 ? 'var(--fb-bg-2)' : `color-mix(in srgb, var(--fb-accent) ${i*22}%, transparent)`,
              }} />
            ))}
            <span>More</span>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center', minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 9, color: 'var(--fb-text-3)', lineHeight: 1 }}>
            {['Lu','','Me','','Ve','','Do'].map((d, i) => (
              <span key={i} style={{ height: 18, display: 'flex', alignItems: 'center' }}>{d}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3, flex: 1, height: '100%' }}>
            {Array.from({ length: WEEKS }, (_, w) => (
              <div key={w} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                {Array.from({ length: 7 }, (_, d) => {
                  const i = cellIntensity(w, d);
                  const colors = [
                    'var(--fb-bg-2)',
                    'color-mix(in srgb, var(--fb-accent) 22%, transparent)',
                    'color-mix(in srgb, var(--fb-accent) 44%, transparent)',
                    'color-mix(in srgb, var(--fb-accent) 70%, transparent)',
                    'var(--fb-accent)',
                  ];
                  return <div key={d} style={{ width: '100%', height: 18, borderRadius: 3, background: colors[i] }} />;
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
