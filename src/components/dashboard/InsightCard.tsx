import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useT } from '../../i18n/useT';
import { useNavigate } from '../../hooks/useNavigate';
import { fbCard, fbBtnGhost } from '../../lib/fbStyles';
import type { InsightsResult, Insight } from '../../types';

function pickOfDay(list: Insight[]): Insight | null {
  if (!list.length) return null;
  const top = list.slice(0, 5);
  const ed = Math.floor(Date.now() / 86400000);
  return top[((ed % top.length) + top.length) % top.length];
}
const DOT: Record<string, string> = { strong: '#16a34a', notice: '#d97706', info: '#9ca3af' };

export default function InsightCard() {
  const { t } = useT();
  const { navigate } = useNavigate();
  const [data, setData] = useState<InsightsResult | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api.insights.get().then(setData).catch(() => setErr(true)); }, []);

  const insight = data ? pickOfDay(data.insights) : null;
  const lowData = !data || data.dataQuality.tierUnlocked === 0 || !insight;

  return (
    <div style={{ ...fbCard, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{t('insights.card.title')}</strong>
        <button style={{ ...fbBtnGhost, padding: '3px 8px', fontSize: 11 }} onClick={() => navigate('insights')}>{t('insights.card.seeAll')}</button>
      </div>
      {err && <div style={{ opacity: .6, fontSize: 13 }}>{t('insights.card.error')}</div>}
      {!err && lowData && <div style={{ opacity: .7, fontSize: 13 }}>{t('insights.card.lowData')}</div>}
      {!err && !lowData && insight && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: DOT[insight.severity], display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 14, lineHeight: 1.4 }}>{insight.text}</span>
          </div>
          {insight.actionHint && <div style={{ fontSize: 12, opacity: .7, paddingLeft: 14 }}>💡 {insight.actionHint}</div>}
        </div>
      )}
    </div>
  );
}
