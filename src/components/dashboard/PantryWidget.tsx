import { useT } from '../../i18n/useT';
import { fbCard } from '../../lib/fbStyles';

interface PantryWidgetProps {
  enabled: boolean;
  lowItems: { name: string; qty: number; unit: string }[];
}

export default function PantryWidget({ enabled, lowItems }: PantryWidgetProps) {
  const { t } = useT();
  const lowCount = lowItems.length;

  return (
    <div style={{ ...fbCard, height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--fb-text-3)' }}>🥫 {t('nav.pantry')}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 28, color: lowCount > 0 ? 'var(--fb-amber)' : 'var(--fb-text)' }}>
              {lowCount}
            </span>
            <span style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>{lowCount === 1 ? 'item in basso' : 'items in basso'}</span>
          </div>
        </div>
        {lowCount > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--fb-amber)', background: 'color-mix(in srgb, var(--fb-amber) 14%, transparent)', padding: '3px 8px', borderRadius: 99, border: '1px solid var(--fb-amber)' }}>⚠ Low</span>
        )}
      </div>

      {!enabled ? (
        <span style={{ fontSize: 11.5, color: 'var(--fb-text-3)', fontStyle: 'italic' }}>{t('dash.pantryDisabled')}</span>
      ) : lowCount === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'color-mix(in srgb, var(--fb-green) 8%, var(--fb-bg-2))', border: '1px solid color-mix(in srgb, var(--fb-green) 30%, var(--fb-border))', borderRadius: 8 }}>
          <span style={{ fontSize: 14 }}>✓</span>
          <span style={{ fontSize: 11.5, color: 'var(--fb-green)', fontWeight: 600 }}>{t('dash.pantryEmpty')}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {lowItems.slice(0, 6).map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'var(--fb-bg-2)', borderRadius: 6 }}>
              <span style={{ fontSize: 11.5, flex: 1, color: 'var(--fb-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <span className="tnum" style={{ fontSize: 11, color: 'var(--fb-amber)', fontWeight: 700 }}>{p.qty} {p.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
