import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useT } from '../../i18n/useT';
import { useNavigate } from '../../hooks/useNavigate';
import { cardOuter, eyebrow } from '../../lib/fbUI';
import type { MoodEntry } from '../../types';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const BAR_MAX_HEIGHT = 40; // px

interface MiniBarProps {
  value: number | null;
  color: string;
  label: string;
}

function MiniBar({ value, color, label }: MiniBarProps) {
  const height = value != null ? Math.round((value / 5) * BAR_MAX_HEIGHT) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 20, height: BAR_MAX_HEIGHT,
        display: 'flex', alignItems: 'flex-end',
        background: 'var(--fb-bg)',
        borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          width: '100%', height: height,
          background: color, borderRadius: 4,
          transition: 'height .4s cubic-bezier(0.16,1,0.3,1)',
        }} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--fb-text-3)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
}

export default function MoodCard() {
  const { t } = useT();
  const { navigate } = useNavigate();
  const [entry, setEntry] = useState<MoodEntry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.mood.get(todayStr())
      .then(row => {
        setEntry(row as MoodEntry | null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <div style={cardOuter}>
      {/* Header */}
      <div style={eyebrow}>{t('journal.moodEyebrow')}</div>

      {/* Body */}
      {loaded && entry ? (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', paddingBottom: 2 }}>
          <MiniBar value={entry.mood}   color="var(--fb-accent)" label={`😊 ${entry.mood ?? '—'}`} />
          <MiniBar value={entry.energy} color="#10b981"          label={`⚡ ${entry.energy ?? '—'}`} />
          <MiniBar value={entry.stress} color="#ef4444"          label={`😰 ${entry.stress ?? '—'}`} />
        </div>
      ) : (
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 36, fontWeight: 400,
          letterSpacing: -1.5,
          color: loaded ? 'var(--fb-text-3)' : 'var(--fb-text-3)',
          lineHeight: 1,
        }}>
          {loaded ? '—' : '…'}
        </div>
      )}

      {/* CTA */}
      <div style={{ marginTop: 4 }}>
        <button
          type="button"
          onClick={() => navigate('journal')}
          style={{
            display: 'inline-flex', alignItems: 'center',
            background: 'transparent',
            border: '1px solid var(--fb-border)',
            color: 'var(--fb-text-2)',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 11.5,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            flexShrink: 0,
          }}
        >
          {t('journal.update')}
        </button>
      </div>
    </div>
  );
}
