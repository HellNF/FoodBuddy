import { useT } from '../../i18n/useT';
import { fbCard, fbChipMuted } from '../../lib/fbStyles';
import type { MealSuggestion, MealSuggestionsResult } from '../../types';

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
}

function isExpiringSoon(expiry: string | null): boolean {
  if (!expiry) return false;
  const diffMs = new Date(expiry).getTime() - Date.now();
  return diffMs >= 0 && diffMs <= 3 * 24 * 60 * 60 * 1000;
}

export default function MealSuggestionCard({ data, onLog, onNavigateFoods }: Props) {
  const { t } = useT();

  if (data == null) return null;

  const mealLabel = t(MEAL_LABEL_KEYS[data.mealSlot] ?? 'meal.afternoonSnack');

  // On target or sforato
  if (data.remainingKcal <= 50 || data.suggestions.length === 0) {
    return (
      <section style={{ ...fbCard, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--fb-text-1)', fontWeight: 600 }}>
            {t('mealSuggest.title')}
          </span>
        </div>
        {data.suggestions.length === 0 && data.remainingKcal > 50 ? (
          <span style={{ fontSize: 12, color: 'var(--fb-text-3)' }}>
            {t('mealSuggest.empty')}{' '}
            <button onClick={onNavigateFoods} style={{ background: 'none', border: 0, color: 'var(--fb-accent)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              {t('nav.foods')}
            </button>
          </span>
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--fb-success, #4caf50)' }}>
            ✓ {t('mealSuggest.allSet')}
          </span>
        )}
      </section>
    );
  }

  return (
    <section style={{ ...fbCard, padding: '12px 16px' }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--fb-text-1)', fontWeight: 600 }}>
          {t('mealSuggest.title')}
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--fb-text-3)', marginLeft: 8 }}>
          {t('mealSuggest.subtitle', { kcal: data.remainingKcal, meal: mealLabel })}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {data.suggestions.map(s => (
          <button
            key={s.food_id}
            onClick={() => onLog(s, data.mealSlot)}
            style={{ ...fbChipMuted, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '6px 10px', height: 'auto' }}
          >
            <span style={{ fontSize: 12.5 }}>{s.name}</span>
            <span style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>
              {s.suggestedGrams}g · {s.portionKcal} kcal
              {s.source === 'pantry' && (
                <span style={{ marginLeft: 4 }}>📦 {t('mealSuggest.fromPantry')}</span>
              )}
              {isExpiringSoon(s.expiry) && (
                <span style={{ marginLeft: 4, color: 'var(--fb-warn, #ff9800)' }}>⚠ {t('mealSuggest.expiringSoon')}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
