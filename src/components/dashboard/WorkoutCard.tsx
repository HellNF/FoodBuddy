import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useT } from '../../i18n/useT';
import { useNavigate } from '../../hooks/useNavigate';
import { cardOuter, eyebrow } from '../../lib/fbUI';
import Model, { type IExerciseData, type Muscle } from 'react-body-highlighter';
import type { WorkoutSession, MuscleActivity, WidgetSize } from '../../types';

function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function nDaysAgoStr(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function formatDuration(min: number | null): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const TOKEN_TO_LIB: Record<string, Muscle[]> = {
  chest: ['chest'], back: ['upper-back', 'lower-back'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  biceps: ['biceps'], triceps: ['triceps'], forearms: ['forearm'],
  quadriceps: ['quadriceps'], hamstrings: ['hamstring'], glutes: ['gluteal'],
  calves: ['calves'], abs: ['abs'], obliques: ['obliques'],
  traps: ['trapezius'], adductors: ['adductor', 'abductors'],
};

const HIGHLIGHT_COLORS = ['#f4dcaa', '#edc070', '#e2a23c', '#d97706'];

function intensityBucket(i: number): 0|1|2|3|4 {
  if (i <= 0) return 0;
  if (i <= 0.25) return 1;
  if (i <= 0.5) return 2;
  if (i <= 0.75) return 3;
  return 4;
}

function BodyMap({ width, view, activity }: { width: number; view: 'front'|'back'; activity: MuscleActivity[] }) {
  const max = Math.max(...activity.map(a => a.score), 0);
  const data: IExerciseData[] = [];
  for (const a of activity) {
    if (a.muscle === 'full_body') continue;
    const libs = TOKEN_TO_LIB[a.muscle];
    if (!libs) continue;
    const intensity = max > 0 ? a.score / max : 0;
    const bucket = intensityBucket(intensity);
    if (bucket === 0) continue;
    data.push({ name: a.muscle, muscles: libs, frequency: bucket });
  }
  return (
    <Model
      data={data}
      type={view === 'front' ? 'anterior' : 'posterior'}
      bodyColor="var(--fb-border-strong)"
      highlightedColors={HIGHLIGHT_COLORS}
      svgStyle={{ width, height: 'auto', display: 'block' }}
    />
  );
}

function AreaChart({ points, color, height }: { points: number[]; color: string; height: number }) {
  const max = Math.max(...points, 1);
  const w = 100;
  const stepX = points.length > 1 ? w / (points.length - 1) : w;
  const linePath = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${100 - (v / max) * 100}`).join(' ');
  const areaPath = `${linePath} L ${w} 100 L 0 100 Z`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <defs>
        <linearGradient id="wo-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#wo-grad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function WorkoutCard({ size = 'M' }: { size?: WidgetSize }) {
  const { t } = useT();
  const { navigate } = useNavigate();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [muscleActivity, setMuscleActivity] = useState<MuscleActivity[]>([]);
  const [weekVolume, setWeekVolume] = useState<number[]>(Array(7).fill(0));

  useEffect(() => {
    api.workouts.getDaySessions(todayStr()).then(rows => setSessions(rows as WorkoutSession[])).catch(() => {});
    if (size === 'S' || size === 'M' || size === 'L') {
      api.workouts.getMuscleActivity(nDaysAgoStr(6), todayStr())
        .then(a => setMuscleActivity(a as MuscleActivity[])).catch(() => {});
    }
    if (size === 'M' || size === 'L') {
      // week duration
      Promise.all(
        Array.from({ length: 7 }, (_, i) =>
          api.workouts.getDaySessions(nDaysAgoStr(6 - i)).catch(() => [])
        )
      ).then(rows => {
        setWeekVolume(rows.map(ss => (ss as WorkoutSession[]).filter(s => s.ended_at).reduce((sum, s) => sum + (s.duration_min ?? 0), 0)));
      });
    }
  }, [size]);

  const completed = sessions.filter(s => s.ended_at != null);
  const totalDuration = completed.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);
  const totalCalories = completed.reduce((sum, s) => sum + (s.calories_burned ?? 0), 0);
  const lastEffort = completed.length > 0 ? completed[completed.length - 1].perceived_effort : null;
  const hasSessions = completed.length > 0;

  // ── XS ────────────────────────────────────────────────────────────────────
  if (size === 'XS') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 12, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span style={{ ...eyebrow, fontSize: 8.5 }}>💪 {t('workouts.eyebrow')}</span>
        <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 32, color: 'var(--fb-text)' }}>{hasSessions ? formatDuration(totalDuration) : '—'}</div>
        {totalCalories > 0 && <div style={{ fontSize: 9, color: 'var(--fb-text-3)' }}>{totalCalories} kcal</div>}
      </div>
    );
  }

  // ── S ─────────────────────────────────────────────────────────────────────
  if (size === 'S') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 12, display: 'grid', gridTemplateColumns: '1fr 60px', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={eyebrow}>💪 {t('workouts.eyebrow')}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 32, color: 'var(--fb-text)' }}>{hasSessions ? formatDuration(totalDuration) : '—'}</span>
              {totalCalories > 0 && <span style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>· {totalCalories} kcal</span>}
            </div>
            {lastEffort != null && <div style={{ fontSize: 10, color: 'var(--fb-text-3)', marginTop: 2 }}>Effort {lastEffort}/10</div>}
          </div>
          {lastEffort != null && (
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < lastEffort ? 'var(--fb-accent)' : 'var(--fb-border-strong, var(--fb-border))' }} />
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BodyMap width={56} view="front" activity={muscleActivity} />
        </div>
      </div>
    );
  }

  // ── M ─────────────────────────────────────────────────────────────────────
  if (size === 'M') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 16, display: 'grid', gridTemplateColumns: '110px 1fr', gap: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '4px 0' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--fb-text-3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Front</span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <BodyMap width={100} view="front" activity={muscleActivity} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div>
            <span style={eyebrow}>💪 {t('workouts.eyebrow')} · oggi</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 40, color: 'var(--fb-text)' }}>{hasSessions ? formatDuration(totalDuration) : '—'}</span>
              {totalCalories > 0 && <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--fb-text-2)' }}>{totalCalories} kcal</span>}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--fb-text-3)' }}>{completed.length} sessione{completed.length === 1 ? '' : 'i'}</div>
          </div>

          {lastEffort != null && (
            <div>
              <div style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 3 }}>Effort {lastEffort}/10</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} style={{ flex: 1, height: 5, borderRadius: 2, background: i < lastEffort ? 'var(--fb-accent)' : 'var(--fb-border-strong, var(--fb-border))' }} />
                ))}
              </div>
            </div>
          )}

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
              <span>Last 7 days</span>
              <span className="tnum">{weekVolume.reduce((a,b)=>a+b,0)}m tot</span>
            </div>
            <AreaChart points={weekVolume} color="var(--fb-accent)" height={60} />
          </div>
        </div>
      </div>
    );
  }

  // ── L ─────────────────────────────────────────────────────────────────────
  const topMuscles = muscleActivity.slice(0, 5).map(a => ({
    name: a.muscle,
    level: intensityBucket(a.score / Math.max(...muscleActivity.map(x => x.score), 1)),
  }));

  return (
    <div style={{ ...cardOuter, height: '100%', padding: 20, display: 'grid', gridTemplateColumns: '180px 220px 1fr 240px', gap: 22, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around', gap: 4, paddingTop: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--fb-text-3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Front</span>
          <BodyMap width={80} view="front" activity={muscleActivity} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--fb-text-3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Back</span>
          <BodyMap width={80} view="back" activity={muscleActivity} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingLeft: 12, borderLeft: '1px solid var(--fb-divider)' }}>
        <div>
          <span style={eyebrow}>💪 {t('workouts.eyebrow')} · oggi</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 56, color: 'var(--fb-text)' }}>{hasSessions ? formatDuration(totalDuration) : '—'}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fb-text-3)' }}>{totalCalories} kcal · {completed.length} sessione{completed.length === 1 ? '' : 'i'}</div>
        </div>
        {lastEffort != null && (
          <div>
            <div style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 4 }}>Effort {lastEffort}/10</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} style={{ flex: 1, height: 7, borderRadius: 2, background: i < lastEffort ? 'var(--fb-accent)' : 'var(--fb-border-strong, var(--fb-border))' }} />
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { l: 'Sett',   v: `${weekVolume.filter(v => v > 0).length}` },
            { l: 'Tot 7g', v: `${weekVolume.reduce((a,b)=>a+b,0)}m` },
          ].map(s => (
            <div key={s.l} style={{ background: 'var(--fb-bg-2)', border: '1px solid var(--fb-border)', borderRadius: 6, padding: '5px 8px' }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--fb-text-3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>{s.l}</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--fb-text)' }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 14, borderLeft: '1px solid var(--fb-divider)', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
          <span>Volume · 7 days</span>
          <span className="tnum">{weekVolume.reduce((a,b)=>a+b,0)}m</span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AreaChart points={weekVolume} color="var(--fb-accent)" height={160} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--fb-text-3)' }}>
          {['Lu','Ma','Me','Gi','Ve','Sa','Do'].map(d => <span key={d} style={{ flex: 1, textAlign: 'center' }}>{d}</span>)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 14, borderLeft: '1px solid var(--fb-divider)' }}>
        <div>
          <div style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 6 }}>Top muscoli 7gg</div>
          {topMuscles.length > 0 ? topMuscles.map(m => (
            <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <span style={{ flex: 1, fontSize: 11, color: 'var(--fb-text-2)', textTransform: 'capitalize' }}>{m.name}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1, 2, 3, 4].map(i => (
                  <span key={i} style={{ width: 6, height: 6, borderRadius: 2, background: i <= m.level ? 'var(--fb-accent)' : 'var(--fb-border-strong, var(--fb-border))' }} />
                ))}
              </div>
            </div>
          )) : (
            <span style={{ fontSize: 10.5, color: 'var(--fb-text-3)', fontStyle: 'italic' }}>Nessun dato</span>
          )}
        </div>
        <button onClick={() => navigate('exercise')}
          style={{ marginTop: 'auto', alignSelf: 'flex-start', background: 'transparent', border: '1px solid var(--fb-border)', color: 'var(--fb-text-2)', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          {t('workouts.start')}
        </button>
      </div>
    </div>
  );
}
