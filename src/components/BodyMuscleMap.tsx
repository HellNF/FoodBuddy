import { useState, useMemo } from 'react';
import { useT } from '../i18n/useT';
import { fbCard } from '../lib/fbStyles';
import type { MuscleActivity } from '../types';

interface Props {
  activity: MuscleActivity[];
  sex: 'male' | 'female' | 'unspecified';
  windowDays: number;
}

// Per-sex layout params: shoulder expand from center, hip expand from center
const SEX = {
  male:        { sExp: 36, hExp: 22 },
  female:      { sExp: 28, hExp: 30 },
  unspecified: { sExp: 32, hExp: 26 },
};

// These tokens are visualized in the SVG figures
const DRAWN_FRONT = new Set(['chest', 'shoulders', 'biceps', 'forearms', 'abs', 'obliques', 'quadriceps', 'calves']);
const DRAWN_BACK  = new Set(['traps', 'back', 'triceps', 'forearms', 'glutes', 'hamstrings', 'calves']);
const DRAWN_ALL   = new Set([...DRAWN_FRONT, ...DRAWN_BACK]);

export default function BodyMuscleMap({ activity, sex, windowDays }: Props) {
  const { t } = useT();
  const [hovered, setHovered] = useState<string | null>(null);

  const params = SEX[sex];

  // Build intensity map (normalised 0–1)
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

  const fullBodyGlow = (actMap['full_body']?.score ?? 0) > 0;

  function fillOpacity(muscle: string): number {
    const base = fullBodyGlow ? 0.15 : 0;
    const i = intensityMap[muscle] ?? 0;
    return i > 0 ? 0.25 + 0.75 * i : base;
  }

  function muscleProps(muscle: string) {
    const op = fillOpacity(muscle);
    return {
      fill: op > 0 ? 'var(--fb-amber)' : 'var(--fb-border)',
      fillOpacity: op > 0 ? op : 0.8,
      stroke: hovered === muscle ? 'var(--fb-amber)' : 'var(--fb-border-strong)',
      strokeWidth: hovered === muscle ? 1.5 : 0.8,
      style: { cursor: 'pointer', transition: 'fill-opacity 0.3s, stroke 0.2s' },
      onMouseEnter: () => setHovered(muscle),
      onMouseLeave: () => setHovered(null),
    };
  }

  function TooltipContent({ muscle }: { muscle: string }) {
    const a = actMap[muscle];
    const label = t(`muscle.${muscle}` as never);
    if (!a || a.sets === 0) return <>{label}<br /><span style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>{t('workouts.muscleMap.notTrained')}</span></>;
    const daysSince = a.last_date ? Math.round((Date.now() - new Date(a.last_date).getTime()) / 86400000) : null;
    return (
      <>
        <strong>{label}</strong><br />
        <span style={{ fontSize: 11 }}>{t('workouts.muscleMap.setsCount').replace('{n}', String(a.sets))}</span>
        {daysSince != null && <><br /><span style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>{t('workouts.muscleMap.lastTrained').replace('{n}', String(daysSince))}</span></>}
      </>
    );
  }

  // Tokens not drawn in SVG (except full_body which gets glow treatment)
  const chipTokens = activity.filter(a => a.muscle !== 'full_body' && !DRAWN_ALL.has(a.muscle));

  const CX = 60;
  const { sExp, hExp } = params;

  // Derived shoulder & hip positions
  const armL = CX - sExp - 2;       // left outer edge of arm
  const armR = CX + sExp + 2 - 15;  // right inner start
  const shoulderCxL = CX - sExp + 2;
  const shoulderCxR = CX + sExp - 2;
  const quadL = CX - hExp - 1;
  const quadR = CX + hExp + 1 - 22;
  const calfL = quadL + 2;
  const calfR = quadR + 2;

  function FrontSVG() {
    return (
      <svg viewBox="0 0 120 270" width={110} height={220} aria-label={t('workouts.muscleMap.front')}>
        {/* Body outline (non-interactive) */}
        <ellipse cx={CX} cy={22} rx={13} ry={14} fill="var(--fb-card)" stroke="var(--fb-border-strong)" strokeWidth={0.8} />
        {/* Neck */}
        <rect x={CX - 6} y={34} width={12} height={12} fill="var(--fb-card)" stroke="var(--fb-border-strong)" strokeWidth={0.8} />

        {/* Shoulders */}
        <ellipse cx={shoulderCxL} cy={62} rx={14} ry={11} {...muscleProps('shoulders')} />
        <ellipse cx={shoulderCxR} cy={62} rx={14} ry={11} {...muscleProps('shoulders')} />

        {/* Chest */}
        <rect x={CX - sExp + 14} y={46} width={(sExp - 14) * 2} height={32} rx={4} {...muscleProps('chest')} />

        {/* Biceps */}
        <rect x={armL} y={49} width={15} height={38} rx={5} {...muscleProps('biceps')} />
        <rect x={armR} y={49} width={15} height={38} rx={5} {...muscleProps('biceps')} />

        {/* Forearms */}
        <rect x={armL - 2} y={89} width={14} height={36} rx={4} {...muscleProps('forearms')} />
        <rect x={armR + 2} y={89} width={14} height={36} rx={4} {...muscleProps('forearms')} />

        {/* Abs */}
        <rect x={CX - 15} y={80} width={30} height={42} rx={4} {...muscleProps('abs')} />

        {/* Obliques */}
        <polygon points={`${CX - sExp + 14},80 ${CX - 15},80 ${CX - 15},122 ${CX - sExp + 8},118`} {...muscleProps('obliques')} />
        <polygon points={`${CX + sExp - 14},80 ${CX + 15},80 ${CX + 15},122 ${CX + sExp - 8},118`} {...muscleProps('obliques')} />

        {/* Hip gap */}
        <rect x={CX - hExp + 2} y={124} width={(hExp - 2) * 2} height={18} rx={3} fill="var(--fb-card)" stroke="var(--fb-border-strong)" strokeWidth={0.8} />

        {/* Quadriceps */}
        <rect x={quadL} y={144} width={22} height={58} rx={5} {...muscleProps('quadriceps')} />
        <rect x={quadR} y={144} width={22} height={58} rx={5} {...muscleProps('quadriceps')} />

        {/* Calves */}
        <rect x={calfL} y={205} width={17} height={48} rx={5} {...muscleProps('calves')} />
        <rect x={calfR} y={205} width={17} height={48} rx={5} {...muscleProps('calves')} />
      </svg>
    );
  }

  function BackSVG() {
    const trapW = sExp + 8;
    return (
      <svg viewBox="0 0 120 270" width={110} height={220} aria-label={t('workouts.muscleMap.back')}>
        {/* Head back */}
        <ellipse cx={CX} cy={22} rx={13} ry={14} fill="var(--fb-card)" stroke="var(--fb-border-strong)" strokeWidth={0.8} />
        <rect x={CX - 6} y={34} width={12} height={12} fill="var(--fb-card)" stroke="var(--fb-border-strong)" strokeWidth={0.8} />

        {/* Traps */}
        <polygon
          points={`${CX - trapW + 16},36 ${CX + trapW - 16},36 ${CX + trapW},64 ${CX - trapW},64`}
          {...muscleProps('traps')}
        />

        {/* Back / lats */}
        <polygon
          points={`${CX - sExp},64 ${CX + sExp},64 ${CX + hExp + 2},116 ${CX - hExp - 2},116`}
          {...muscleProps('back')}
        />

        {/* Triceps */}
        <rect x={armL} y={49} width={15} height={38} rx={5} {...muscleProps('triceps')} />
        <rect x={armR} y={49} width={15} height={38} rx={5} {...muscleProps('triceps')} />

        {/* Forearms */}
        <rect x={armL - 2} y={89} width={14} height={36} rx={4} {...muscleProps('forearms')} />
        <rect x={armR + 2} y={89} width={14} height={36} rx={4} {...muscleProps('forearms')} />

        {/* Glutes */}
        <rect x={CX - hExp - 2} y={118} width={hExp + 1} height={34} rx={5} {...muscleProps('glutes')} />
        <rect x={CX + 1} y={118} width={hExp + 1} height={34} rx={5} {...muscleProps('glutes')} />

        {/* Hamstrings */}
        <rect x={quadL} y={155} width={22} height={52} rx={5} {...muscleProps('hamstrings')} />
        <rect x={quadR} y={155} width={22} height={52} rx={5} {...muscleProps('hamstrings')} />

        {/* Calves */}
        <rect x={calfL} y={210} width={17} height={44} rx={5} {...muscleProps('calves')} />
        <rect x={calfR} y={210} width={17} height={44} rx={5} {...muscleProps('calves')} />
      </svg>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--fb-card)', border: '1px solid var(--fb-border)',
          borderRadius: 8, padding: '6px 10px', zIndex: 10,
          fontSize: 12, color: 'var(--fb-text)', lineHeight: 1.6,
          pointerEvents: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        }}>
          <TooltipContent muscle={hovered} />
        </div>
      )}

      {/* Subtitle */}
      <p style={{ fontSize: 12, color: 'var(--fb-text-3)', margin: '0 0 12px', textAlign: 'center' }}>
        {t('workouts.muscleMap.subtitle').replace('{n}', String(windowDays))}
      </p>

      {/* Figures */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fb-text-3)', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {t('workouts.muscleMap.front')}
          </span>
          <FrontSVG />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fb-text-3)', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {t('workouts.muscleMap.back')}
          </span>
          <BackSVG />
        </div>
      </div>

      {/* Chip legend for tokens not drawn in figures */}
      {chipTokens.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, justifyContent: 'center' }}>
          {chipTokens.map(a => {
            const op = fillOpacity(a.muscle);
            return (
              <span
                key={a.muscle}
                style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 99,
                  background: op > 0 ? `color-mix(in srgb, var(--fb-amber) ${Math.round(op * 100)}%, var(--fb-card))` : 'var(--fb-card)',
                  border: `1px solid ${op > 0 ? 'var(--fb-amber)' : 'var(--fb-border)'}`,
                  color: op > 0 ? 'var(--fb-amber)' : 'var(--fb-text-3)',
                }}
              >
                {t(`muscle.${a.muscle}` as never)} {a.sets > 0 ? `· ${a.sets}` : ''}
              </span>
            );
          })}
        </div>
      )}

      {/* full_body glow notice */}
      {fullBodyGlow && (
        <p style={{ fontSize: 11, color: 'var(--fb-amber)', textAlign: 'center', marginTop: 8, opacity: 0.8 }}>
          ✦ {t('muscle.full_body')}
        </p>
      )}
    </div>
  );
}
