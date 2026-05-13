import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useT } from '../../i18n/useT';
import { fbCard } from '../../lib/fbStyles';
import type { MealSuggestion, MealSuggestionsResult, WidgetSize, Settings, LogEntry } from '../../types';

const MEAL_LABEL_KEYS: Record<string, string> = {
  Breakfast:      'meal.breakfast',
  Lunch:          'meal.lunch',
  Dinner:         'meal.dinner',
  AfternoonSnack: 'meal.afternoonSnack',
};

interface Props {
  data: MealSuggestionsResult | null;
  onLog: (s: MealSuggestion, mealSlot: string) => void;
  onNavigateFoods: () => void;
  size?: WidgetSize;
}

function isExpiringSoon(expiry: string | null): boolean {
  if (!expiry) return false;
  const diffMs = new Date(expiry).getTime() - Date.now();
  return diffMs >= 0 && diffMs <= 3 * 24 * 60 * 60 * 1000;
}

function todayStr(): string { return new Date().toISOString().slice(0, 10); }

function suggestionEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('yogurt')) return '🥣';
  if (n.includes('pane') || n.includes('toast')) return '🍞';
  if (n.includes('hummus') || n.includes('cec')) return '🥕';
  if (n.includes('frutta') || n.includes('nut') || n.includes('mandorl')) return '🥜';
  if (n.includes('avocado')) return '🥑';
  if (n.includes('pollo') || n.includes('chicken')) return '🍗';
  if (n.includes('uova') || n.includes('egg')) return '🥚';
  if (n.includes('riso') || n.includes('rice')) return '🍚';
  if (n.includes('pasta')) return '🍝';
  if (n.includes('pizza')) return '🍕';
  if (n.includes('insalata') || n.includes('salad')) return '🥗';
  return '🍽️';
}

export default function MealSuggestionCard({ data, onLog, onNavigateFoods, size = 'M' }: Props) {
  const { t } = useT();
  const [macroGap, setMacroGap] = useState<{ protein: number; carbs: number; fat: number } | null>(null);

  useEffect(() => {
    if (size === 'XS') return;
    Promise.all([api.settings.get(), api.log.getDay(todayStr())])
      .then(([settings, entries]) => {
        const list = entries as LogEntry[];
        const sumP = list.reduce((s, e) => s + (e.protein ?? 0), 0);
        const sumC = list.reduce((s, e) => s + (e.carbs ?? 0), 0);
        const sumF = list.reduce((s, e) => s + (e.fat ?? 0), 0);
        const st = settings as Settings;
        setMacroGap({
          protein: Math.max(0, (st.protein_rec ?? 0) - sumP),
          carbs:   Math.max(0, (st.carbs_rec ?? 0) - sumC),
          fat:     Math.max(0, (st.fat_rec ?? 0) - sumF),
        });
      })
      .catch(() => {});
  }, [size]);

  if (data == null) return null;

  const mealLabel = t(MEAL_LABEL_KEYS[data.mealSlot] ?? 'meal.afternoonSnack');
  const remaining = data.remainingKcal;
  const suggestions = data.suggestions;

  // ── XS ────────────────────────────────────────────────────────────────────
  if (size === 'XS') {
    return (
      <div style={{ ...fbCard, height: '100%', padding: 12, gap: 4, alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--fb-text-3)' }}>Eat next</span>
        <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 28, color: 'var(--fb-orange)' }}>{remaining}</div>
        <span style={{ fontSize: 10, color: 'var(--fb-text-3)' }}>kcal rimanenti</span>
        <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
          {suggestions.slice(0, 3).map(s => (
            <span key={s.food_id} style={{ fontSize: 14 }}>{suggestionEmoji(s.name)}</span>
          ))}
        </div>
      </div>
    );
  }

  const gaps = macroGap ? [
    { key: 'P', label: 'Protein', val: macroGap.protein, color: 'var(--fb-red)' },
    { key: 'C', label: 'Carbs',   val: macroGap.carbs,   color: 'var(--fb-amber)' },
    { key: 'F', label: 'Fat',     val: macroGap.fat,     color: 'var(--fb-green)' },
  ] : [];

  // ── S ─────────────────────────────────────────────────────────────────────
  if (size === 'S') {
    const top = suggestions[0];
    return (
      <div style={{ ...fbCard, height: '100%', padding: 12, gap: 8, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--fb-text-3)' }}>Eat next · {mealLabel}</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--fb-orange)' }}>{remaining}<span style={{ fontSize: 9, color: 'var(--fb-text-3)' }}> kcal</span></span>
        </div>
        {gaps.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {gaps.map(g => (
              <div key={g.key} style={{ flex: 1, padding: '4px 6px', background: 'var(--fb-bg-2)', borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: g.color, letterSpacing: 0.4 }}>{g.key}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13, color: g.val > 0 ? g.color : 'var(--fb-text-3)' }}>
                  {g.val > 0 ? '+' : ''}{g.val.toFixed(0)}g
                </div>
              </div>
            ))}
          </div>
        )}
        {top && (
          <button onClick={() => onLog(top, data.mealSlot)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
            background: 'color-mix(in srgb, var(--fb-accent) 8%, var(--fb-bg-2))',
            border: '1px solid var(--fb-accent)', borderRadius: 8, cursor: 'pointer',
            width: '100%', textAlign: 'left',
          }}>
            <span style={{ fontSize: 18 }}>{suggestionEmoji(top.name)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fb-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top.name}</div>
              <div style={{ fontSize: 9.5, color: 'var(--fb-text-3)' }} className="tnum">{top.suggestedGrams}g · {top.portionKcal} kcal</div>
            </div>
          </button>
        )}
      </div>
    );
  }

  // ── M ─────────────────────────────────────────────────────────────────────
  if (size === 'M') {
    return (
      <div style={{ ...fbCard, height: '100%', padding: 16, gap: 11, justifyContent: 'flex-start', overflow: 'hidden' }}>
        <div>
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--fb-text-3)' }}>Smart coach · {mealLabel}</span>
          <div style={{ fontSize: 10.5, color: 'var(--fb-text-3)', marginTop: 2 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, color: 'var(--fb-orange)' }}>{remaining}</span>
            <span style={{ marginLeft: 4 }}>kcal {gaps.length ? '· macro residui' : 'rimanenti'}</span>
          </div>
        </div>

        {gaps.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
            {gaps.map(g => {
              const target = g.key === 'P' ? 169 : g.key === 'C' ? 210 : 65;
              const filled = target - g.val;
              const pct = Math.max(0, Math.min(100, (filled / target) * 100));
              return (
                <div key={g.key} style={{ background: 'var(--fb-bg-2)', border: '1px solid var(--fb-border)', borderRadius: 8, padding: '6px 9px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: g.color, letterSpacing: 0.6, textTransform: 'uppercase' }}>{g.label}</span>
                    <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15, color: g.val > 0 ? g.color : 'var(--fb-text-3)' }}>{g.val > 0 ? '+' : ''}{g.val.toFixed(0)}<span style={{ fontSize: 9 }}>g</span></span>
                  </div>
                  <div style={{ height: 4, background: 'var(--fb-bg)', borderRadius: 99, marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: g.color, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
            <span>Suggested · ranked</span>
            <span>{suggestions.length} opzioni</span>
          </div>
          {suggestions.slice(0, 3).map((s, i) => (
            <button key={s.food_id} onClick={() => onLog(s, data.mealSlot)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
              background: i === 0 ? 'color-mix(in srgb, var(--fb-accent) 7%, var(--fb-bg-2))' : 'var(--fb-bg-2)',
              border: `1px solid ${i === 0 ? 'var(--fb-accent)' : 'var(--fb-border)'}`,
              borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <span style={{ fontSize: 18 }}>{suggestionEmoji(s.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fb-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                  <span style={{ fontSize: 9.5, color: 'var(--fb-text-3)' }} className="tnum">{s.suggestedGrams}g · {s.portionKcal} kcal</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                {s.source === 'pantry' && <span style={{ fontSize: 7.5, padding: '1px 5px', borderRadius: 99, background: 'var(--fb-accent-soft)', color: 'var(--fb-accent)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>pantry</span>}
                {isExpiringSoon(s.expiry) && <span style={{ fontSize: 7.5, padding: '1px 5px', borderRadius: 99, background: 'color-mix(in srgb, var(--fb-red) 12%, transparent)', color: 'var(--fb-red)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>exp</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── L ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...fbCard, height: '100%', padding: 20, display: 'grid', gridTemplateColumns: '240px 1fr 240px', gap: 22, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--fb-text-3)' }}>Smart coach · {mealLabel}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 40, color: 'var(--fb-orange)' }}>{remaining}</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--fb-text-2)' }}>kcal residue</span>
          </div>
        </div>

        {gaps.length > 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Macro gap</div>
            {gaps.map(g => {
              const target = g.key === 'P' ? 169 : g.key === 'C' ? 210 : 65;
              const filled = target - g.val;
              const pct = Math.max(0, Math.min(100, (filled / target) * 100));
              return (
                <div key={g.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: g.color }}>{g.label}</span>
                    <span className="tnum" style={{ fontSize: 11, fontWeight: 700, color: g.val > 0 ? g.color : 'var(--fb-text-3)' }}>
                      {g.val > 0 ? `+${g.val.toFixed(0)}g needed` : '✓ done'}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--fb-bg-2)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: g.color, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 18, borderLeft: '1px solid var(--fb-divider)', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
          <span>Suggested · ranked</span>
          <span>{suggestions.length} opzioni</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
          {suggestions.slice(0, 4).map((s, i) => (
            <button key={s.food_id} onClick={() => onLog(s, data.mealSlot)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 11px',
              background: i === 0 ? 'color-mix(in srgb, var(--fb-accent) 7%, var(--fb-bg-2))' : 'var(--fb-bg-2)',
              border: `1px solid ${i === 0 ? 'var(--fb-accent)' : 'var(--fb-border)'}`,
              borderRadius: 9, cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <span style={{ fontSize: 22 }}>{suggestionEmoji(s.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fb-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  {s.source === 'pantry' && <span style={{ fontSize: 7.5, padding: '1px 5px', borderRadius: 99, background: 'var(--fb-accent-soft)', color: 'var(--fb-accent)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>pantry</span>}
                  {isExpiringSoon(s.expiry) && <span style={{ fontSize: 7.5, padding: '1px 5px', borderRadius: 99, background: 'color-mix(in srgb, var(--fb-red) 14%, transparent)', color: 'var(--fb-red)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>expiring</span>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--fb-text-3)' }} className="tnum">{s.suggestedGrams}g · {s.portionKcal} kcal</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18, borderLeft: '1px solid var(--fb-divider)' }}>
        <div style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--fb-accent) 10%, var(--fb-bg-2))', border: '1px solid var(--fb-accent)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'var(--fb-accent)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
            <span>💡</span><span>Coach tip</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--fb-text)', lineHeight: 1.4, marginTop: 4 }}>
            {gaps.length > 0 && gaps.find(g => g.val > 0)
              ? <>Ti mancano <strong>{gaps.find(g => g.val > 0)?.val.toFixed(0)}g {gaps.find(g => g.val > 0)?.label.toLowerCase()}</strong>. Consigli ottimizzati per riempire il gap.</>
              : 'Sei in target sui macro principali. Mantieni così.'}
          </div>
        </div>
        <button onClick={onNavigateFoods} style={{
          alignSelf: 'flex-start', marginTop: 'auto',
          background: 'transparent', border: '1px solid var(--fb-border)',
          color: 'var(--fb-text-2)', padding: '5px 10px', borderRadius: 6,
          fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}>
          {t('nav.foods')} →
        </button>
      </div>
    </div>
  );
}
