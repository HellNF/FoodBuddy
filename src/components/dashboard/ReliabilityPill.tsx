import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useT } from '../../i18n/useT';
import type { DayReliabilityLevel } from '../../types';

const ORDER: (DayReliabilityLevel | null)[] = ['precise', 'approx', 'none', null]; // null = clear override

export default function ReliabilityPill({ date, initialLevel }: { date: string; initialLevel?: DayReliabilityLevel }) {
  const { t } = useT();
  const [level, setLevel] = useState<DayReliabilityLevel | undefined>(initialLevel);
  useEffect(() => setLevel(initialLevel), [initialLevel, date]);

  const label: Record<DayReliabilityLevel, string> = {
    precise: t('insights.reliability.precise'),
    approx:  t('insights.reliability.approx'),
    none:    t('insights.reliability.none'),
  };
  const next = () => {
    const cur = ORDER.indexOf(level ?? null);
    const nx = ORDER[(cur + 1) % ORDER.length];
    if (nx == null) { api.insights.clearDayReliability(date).catch(() => {}); setLevel(undefined); }
    else { api.insights.setDayReliability(date, nx).catch(() => {}); setLevel(nx); }
  };
  const shown = level ?? 'precise';
  const color = shown === 'precise' ? 'var(--fb-ok, #16a34a)' : shown === 'approx' ? 'var(--fb-warn, #d97706)' : 'var(--fb-muted, #9ca3af)';
  return (
    <button onClick={next} title={t('insights.reliability.tooltip')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 8px',
        borderRadius: 999, border: `1px solid ${color}`, color, background: 'transparent', cursor: 'pointer' }}>
      📊 {label[shown]}{level === undefined ? ` · ${t('insights.reliability.auto')}` : ''} ▾
    </button>
  );
}
