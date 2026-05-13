import { useState, useMemo, useCallback } from 'react';
import Model, { type IExerciseData, type IMuscleStats, type Muscle } from 'react-body-highlighter';
import { useT } from '../i18n/useT';
import type { MuscleActivity } from '../types';

type ViewMode = 'activity' | 'recovery';

interface Props {
  activity: MuscleActivity[];
  sex: 'male' | 'female' | 'unspecified';
  windowDays: number;
}

const TOKEN_TO_LIB: Record<string, Muscle[]> = {
  chest:       ['chest'],
  back:        ['upper-back', 'lower-back'],
  shoulders:   ['front-deltoids', 'back-deltoids'],
  biceps:      ['biceps'],
  triceps:     ['triceps'],
  forearms:    ['forearm'],
  quadriceps:  ['quadriceps'],
  hamstrings:  ['hamstring'],
  glutes:      ['gluteal'],
  calves:      ['calves'],
  abs:         ['abs'],
  obliques:    ['obliques'],
  traps:       ['trapezius'],
  adductors:   ['adductor', 'abductors'],
};

const LIB_TO_TOKEN: Record<string, string> = {};
for (const [token, libs] of Object.entries(TOKEN_TO_LIB)) {
  for (const l of libs) LIB_TO_TOKEN[l] = token;
}

const ALL_LIB_MUSCLES = Array.from(new Set(Object.values(TOKEN_TO_LIB).flat()));

// Activity mode: light → intense amber
const ACTIVITY_COLORS = ['#f4dcaa', '#edc070', '#e2a23c', '#d97706'];
// Recovery mode: light yellow (4d) → red (today/yesterday)
const RECOVERY_COLORS = ['#fef3c7', '#fde68a', '#fbbf24', '#ef4444'];

const BODY_COLOR = 'var(--fb-border-strong)';

// Front-dominant muscles (left panel)
const LEFT_MUSCLES = ['chest', 'shoulders', 'biceps', 'abs', 'quadriceps', 'obliques'];
// Back-dominant muscles (right panel)
const RIGHT_MUSCLES = ['back', 'triceps', 'glutes', 'hamstrings', 'calves', 'traps', 'forearms', 'adductors'];

function intensityBucket(i: number): number {
  if (i <= 0) return 0;
  if (i <= 0.25) return 1;
  if (i <= 0.5) return 2;
  if (i <= 0.75) return 3;
  return 4;
}

function recoveryBucket(daysSince: number | null): number {
  if (daysSince === null) return 0;
  if (daysSince <= 1) return 4;  // red — needs rest
  if (daysSince === 2) return 3; // orange
  if (daysSince === 3) return 2; // yellow
  if (daysSince === 4) return 1; // light yellow
  return 0;                      // 5+ days — recovered
}

function dotColor(bucket: number, mode: ViewMode): string {
  if (bucket === 0) return 'var(--fb-border-strong)';
  const colors = mode === 'activity' ? ACTIVITY_COLORS : RECOVERY_COLORS;
  return colors[bucket - 1];
}

export default function BodyMuscleMap({ activity, sex, windowDays }: Props) {
  const { t } = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('activity');

  const today = new Date().toISOString().slice(0, 10);

  const intensityMap = useMemo(() => {
    const maxScore = Math.max(...activity.map(a => a.score), 0);
    const map: Record<string, number> = {};
    for (const a of activity) map[a.muscle] = maxScore > 0 ? a.score / maxScore : 0;
    return map;
  }, [activity]);

  const actMap = useMemo(() => {
    const m: Record<string, MuscleActivity> = {};
    for (const a of activity) m[a.muscle] = a;
    return m;
  }, [activity]);

  const daysAgoMap = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const a of activity) {
      if (a.last_date) {
        const diff = new Date(today).getTime() - new Date(a.last_date).getTime();
        m[a.muscle] = Math.round(diff / 86400000);
      } else {
        m[a.muscle] = null;
      }
    }
    return m;
  }, [activity, today]);

  const fullBodyGlow = (actMap['full_body']?.score ?? 0) > 0;

  const data = useMemo<IExerciseData[]>(() => {
    const out: IExerciseData[] = [];
    const used = new Set<Muscle>();

    for (const a of activity) {
      if (a.muscle === 'full_body') continue;
      const libs = TOKEN_TO_LIB[a.muscle];
      if (!libs) continue;

      const bucket = mode === 'activity'
        ? intensityBucket(intensityMap[a.muscle] ?? 0)
        : recoveryBucket(daysAgoMap[a.muscle] ?? null);

      if (bucket === 0) continue;
      out.push({ name: a.muscle, muscles: libs, frequency: bucket });
      for (const l of libs) used.add(l);
    }

    if (mode === 'activity' && fullBodyGlow) {
      const missing = ALL_LIB_MUSCLES.filter(m => !used.has(m));
      if (missing.length) out.push({ name: 'full_body', muscles: missing, frequency: 1 });
    }
    return out;
  }, [activity, intensityMap, daysAgoMap, mode, fullBodyGlow]);

  const handleClick = useCallback(({ muscle }: IMuscleStats) => {
    const token = LIB_TO_TOKEN[muscle];
    setSelected(prev => (token && prev !== token ? token : null));
  }, []);

  const highlightedColors = mode === 'activity' ? ACTIVITY_COLORS : RECOVERY_COLORS;

  function muscleBucket(token: string): number {
    return mode === 'activity'
      ? intensityBucket(intensityMap[token] ?? 0)
      : recoveryBucket(daysAgoMap[token] ?? null);
  }

  function muscleSecondaryLabel(token: string): string {
    const a = actMap[token];
    if (mode === 'activity') {
      if (!a || a.sets === 0) return t('workouts.muscleMap.notTrained');
      return t('workouts.muscleMap.setsCount').replace('{n}', String(a.sets));
    }
    // recovery mode
    const d = daysAgoMap[token] ?? null;
    if (d === null) return t('workouts.muscleMap.recovered');
    if (d === 0) return t('workouts.muscleMap.trainedToday');
    return t('workouts.muscleMap.lastTrained').replace('{n}', String(d));
  }

  function MuscleRow({ token }: { token: string }) {
    const bucket = muscleBucket(token);
    const color = dotColor(bucket, mode);
    const isSelected = selected === token;
    const label = t(`muscle.${token}` as never);
    const secondary = muscleSecondaryLabel(token);
    return (
      <div
        onClick={() => setSelected(prev => prev === token ? null : token)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          padding: '3px 4px', borderRadius: 6,
          background: isSelected ? 'color-mix(in srgb, var(--fb-accent) 8%, transparent)' : 'transparent',
          transition: 'background .15s',
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: color,
          border: bucket === 0 ? '1px solid var(--fb-border)' : 'none',
          transition: 'background .2s',
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fb-text)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </div>
          <div style={{ fontSize: 9, color: bucket === 0 ? 'var(--fb-text-3)' : 'var(--fb-text-2)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
            {secondary}
          </div>
        </div>
      </div>
    );
  }

  function Tooltip() {
    if (!selected) return null;
    const a = actMap[selected];
    const label = t(`muscle.${selected}` as never);
    const d = daysAgoMap[selected] ?? null;
    return (
      <div style={{
        position: 'absolute', top: -4, left: '50%', transform: 'translate(-50%,-100%)',
        background: 'var(--fb-card)', border: '1px solid var(--fb-border)',
        borderRadius: 8, padding: '6px 10px', zIndex: 10,
        fontSize: 12, color: 'var(--fb-text)', lineHeight: 1.6,
        whiteSpace: 'nowrap', boxShadow: '0 2px 14px rgba(0,0,0,0.2)',
        pointerEvents: 'none',
      }}>
        <strong>{label}</strong>
        {a && a.sets > 0 ? (
          <>
            <br /><span style={{ fontSize: 11 }}>{t('workouts.muscleMap.setsCount').replace('{n}', String(a.sets))}</span>
            {d !== null && <><br /><span style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>
              {d === 0 ? t('workouts.muscleMap.trainedToday') : t('workouts.muscleMap.lastTrained').replace('{n}', String(d))}
            </span></>}
          </>
        ) : (
          <><br /><span style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>{t('workouts.muscleMap.notTrained')}</span></>
        )}
      </div>
    );
  }

  const chipTokens = activity.filter(a => a.muscle !== 'full_body' && !TOKEN_TO_LIB[a.muscle]);
  const figureStyle = { width: '100%', height: 'auto', maxWidth: 140 } as const;

  const accentColor = mode === 'activity' ? 'var(--fb-amber)' : '#ef4444';

  return (
    <div style={{ position: 'relative' }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 12 }}>
        {(['activity', 'recovery'] as ViewMode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setSelected(null); }}
            style={{
              padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1.5px solid var(--fb-border)',
              background: mode === m ? (m === 'activity' ? 'color-mix(in srgb, var(--fb-amber) 15%, var(--fb-card))' : 'color-mix(in srgb, #ef4444 12%, var(--fb-card))') : 'transparent',
              color: mode === m ? (m === 'activity' ? 'var(--fb-amber)' : '#ef4444') : 'var(--fb-text-3)',
              borderRadius: m === 'activity' ? '8px 0 0 8px' : '0 8px 8px 0',
              borderRight: m === 'activity' ? 'none' : undefined,
              transition: 'all .15s',
              fontFamily: 'var(--font-body)',
            }}
          >
            {t(m === 'activity' ? 'workouts.muscleMap.modeActivity' : 'workouts.muscleMap.modeRecovery')}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11, color: 'var(--fb-text-3)', margin: '0 0 12px', textAlign: 'center' }}>
        {mode === 'activity'
          ? t('workouts.muscleMap.subtitle').replace('{n}', String(windowDays))
          : t('workouts.muscleMap.modeRecovery')}
      </p>

      {/* 3-column layout */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>

        {/* Left panel: anterior muscles */}
        <div style={{ flex: '0 0 82px', display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 20 }}>
          {LEFT_MUSCLES.map(token => <MuscleRow key={token} token={token} />)}
        </div>

        {/* Body figures */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fb-text-3)', letterSpacing: 1, textTransform: 'uppercase' }}>
                {t('workouts.muscleMap.front')}
              </span>
              <Model
                data={data}
                type="anterior"
                bodyColor={BODY_COLOR}
                highlightedColors={highlightedColors}
                onClick={handleClick}
                svgStyle={figureStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fb-text-3)', letterSpacing: 1, textTransform: 'uppercase' }}>
                {t('workouts.muscleMap.back')}
              </span>
              <Model
                data={data}
                type="posterior"
                bodyColor={BODY_COLOR}
                highlightedColors={highlightedColors}
                onClick={handleClick}
                svgStyle={figureStyle}
              />
            </div>
          </div>
          <Tooltip />
        </div>

        {/* Right panel: posterior muscles */}
        <div style={{ flex: '0 0 82px', display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 20 }}>
          {RIGHT_MUSCLES.map(token => <MuscleRow key={token} token={token} />)}
        </div>
      </div>

      {/* Extra chip tokens (muscles not mappable to SVG) */}
      {chipTokens.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, justifyContent: 'center' }}>
          {chipTokens.map(a => {
            const bucket = muscleBucket(a.muscle);
            const on = bucket > 0;
            return (
              <span key={a.muscle} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 99,
                background: on ? `color-mix(in srgb, ${accentColor} ${Math.round(20 + (bucket / 4) * 70)}%, var(--fb-card))` : 'var(--fb-card)',
                border: `1px solid ${on ? accentColor : 'var(--fb-border)'}`,
                color: on ? accentColor : 'var(--fb-text-3)',
              }}>
                {t(`muscle.${a.muscle}` as never)} {a.sets > 0 ? `· ${a.sets}` : ''}
              </span>
            );
          })}
        </div>
      )}

      {/* Recovery legend */}
      {mode === 'recovery' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--fb-text-3)' }}>{t('workouts.muscleMap.recovered')}</span>
          {RECOVERY_COLORS.map((c, i) => (
            <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
          ))}
          <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>●</span>
          <span style={{ fontSize: 10, color: 'var(--fb-text-3)' }}>affaticato</span>
        </div>
      )}

      {/* Activity legend */}
      {mode === 'activity' && (
        <p style={{ fontSize: 10, color: 'var(--fb-text-3)', textAlign: 'center', marginTop: 10, opacity: 0.7 }}>
          {t('workouts.muscleMap.tapHint')}
        </p>
      )}

      {fullBodyGlow && mode === 'activity' && (
        <p style={{ fontSize: 11, color: 'var(--fb-amber)', textAlign: 'center', marginTop: 4, opacity: 0.85 }}>
          ✦ {t('muscle.full_body')}
        </p>
      )}
    </div>
  );
}
