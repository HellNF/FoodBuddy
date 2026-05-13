import { useT } from '../../i18n/useT';
import { fbCard } from '../../lib/fbStyles';
import type { SupplementDay } from '../../types';

interface SupplementsWidgetProps {
  supplements: SupplementDay[];
  onTake: (id: number) => void;
}

const TIME_ORDER: Record<string, number> = {
  breakfast: 0, morning_snack: 1, lunch: 2, afternoon_snack: 3, dinner: 4, evening_snack: 5,
};

export default function SupplementsWidget({ supplements, onTake }: SupplementsWidgetProps) {
  const { t } = useT();
  const taken = supplements.filter(s => s.taken >= s.qty).length;
  const total = supplements.length;
  const pct = total > 0 ? (taken / total) * 100 : 0;

  const sorted = [...supplements].sort((a, b) => {
    const ta = TIME_ORDER[a.time_of_day ?? ''] ?? 99;
    const tb = TIME_ORDER[b.time_of_day ?? ''] ?? 99;
    return ta - tb;
  });

  return (
    <div style={{ ...fbCard, height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--fb-text-3)' }}>💊 {t('suppl.dashTitle')}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 28, color: 'var(--fb-accent)' }}>{taken}</span>
            <span style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>/ {total} oggi</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18, color: pct === 100 ? 'var(--fb-green)' : 'var(--fb-text-2)' }}>{Math.round(pct)}%</span>
          <span style={{ fontSize: 9, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>completato</span>
        </div>
      </div>

      {total > 0 && (
        <div style={{ height: 4, background: 'var(--fb-bg-2)', borderRadius: 99 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--fb-accent)', borderRadius: 99, transition: 'width .6s cubic-bezier(0.23,1,0.32,1)' }} />
        </div>
      )}

      {total === 0 ? (
        <span style={{ fontSize: 11.5, color: 'var(--fb-text-3)', fontStyle: 'italic' }}>{t('dash.noSupplPlanned')}</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sorted.slice(0, 6).map(s => {
            const done = s.taken >= s.qty;
            const timeLabel = s.time_of_day === 'breakfast' ? t('suppl.morning')
                            : s.time_of_day === 'evening_snack' ? t('suppl.evening')
                            : s.time_of_day === 'afternoon_snack' ? t('suppl.afternoon')
                            : s.time_of_day ?? '';
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => !done && onTake(s.id)}
                  style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0, padding: 0,
                    border: `1.5px solid ${done ? 'var(--fb-green)' : 'var(--fb-border-strong)'}`,
                    background: done ? 'var(--fb-green)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: done ? 'default' : 'pointer', color: 'var(--fb-bg)',
                  }}>
                  {done && (
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span style={{ flex: 1, fontSize: 12, color: done ? 'var(--fb-text-3)' : 'var(--fb-text)', textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                {s.qty > 1 && (
                  <span style={{ fontSize: 9.5, color: 'var(--fb-text-3)', fontWeight: 600 }} className="tnum">{s.taken}/{s.qty}</span>
                )}
                {timeLabel && (
                  <span style={{ fontSize: 9, color: 'var(--fb-text-3)', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'var(--fb-bg-2)' }}>{timeLabel}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
