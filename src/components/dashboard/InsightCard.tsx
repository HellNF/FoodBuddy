import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useT } from '../../i18n/useT';
import { useNavigate } from '../../hooks/useNavigate';
import { fbCard } from '../../lib/fbStyles';
import type { InsightsResult, Insight, WidgetSize } from '../../types';

function pickOfDay(list: Insight[]): Insight | null {
  if (!list.length) return null;
  const top = list.slice(0, 5);
  const ed = Math.floor(Date.now() / 86400000);
  return top[((ed % top.length) + top.length) % top.length];
}
const DOT: Record<string, string> = { strong: '#16a34a', notice: '#d97706', info: '#9ca3af' };

// Conceptual life-metric graph (always same nodes — different correlations per user)
type GNode = { id: string; emoji: string; label: string; x: number; y: number };
type GEdge = { from: string; to: string; r: number };

function NetworkGraph({
  width, height, nodes, edges, nodeR = 16, highlightEdge,
}: {
  width: number; height: number; nodes: GNode[]; edges: GEdge[];
  nodeR?: number; highlightEdge?: { from: string; to: string };
}) {
  const isHi = (e: GEdge) => highlightEdge && ((e.from === highlightEdge.from && e.to === highlightEdge.to) || (e.from === highlightEdge.to && e.to === highlightEdge.from));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', display: 'block' }}>
      {edges.map((e, i) => {
        const from = nodes.find(n => n.id === e.from)!;
        const to = nodes.find(n => n.id === e.to)!;
        const strokeWidth = Math.abs(e.r) * 4 + 0.5;
        const color = e.r > 0 ? 'var(--fb-green)' : 'var(--fb-red)';
        const op = isHi(e) ? 1 : Math.max(0.25, Math.abs(e.r));
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        return (
          <g key={i}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={color} strokeWidth={strokeWidth} strokeOpacity={op}
              strokeLinecap="round" />
            <g transform={`translate(${mx}, ${my})`}>
              <rect x="-12" y="-7" width="24" height="14" rx="7"
                fill="var(--fb-bg-2)" stroke={color} strokeOpacity={op + 0.2} strokeWidth="0.6" />
              <text x="0" y="3.5" textAnchor="middle"
                style={{ fontSize: 8.5, fontWeight: 700, fill: color, fontFamily: 'var(--font-display)' }}>
                {e.r > 0 ? '+' : ''}{e.r.toFixed(2)}
              </text>
            </g>
          </g>
        );
      })}
      {nodes.map(n => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={nodeR + 2} fill="var(--fb-bg)" />
          <circle cx={n.x} cy={n.y} r={nodeR} fill="var(--fb-bg-2)" stroke="var(--fb-border-strong, var(--fb-border))" strokeWidth="1" />
          <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: nodeR * 1.05 }}>
            {n.emoji}
          </text>
          <text x={n.x} y={n.y + nodeR + 9} textAnchor="middle"
            style={{ fontSize: 8.5, fontWeight: 700, fill: 'var(--fb-text-3)', letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

const smallNodes: GNode[] = [
  { id: 'sleep',   emoji: '😴', label: 'Sleep',   x: 40,  y: 32 },
  { id: 'mood',    emoji: '😊', label: 'Mood',    x: 240, y: 32 },
  { id: 'workout', emoji: '💪', label: 'Workout', x: 140, y: 100 },
];
const smallEdges: GEdge[] = [
  { from: 'sleep',   to: 'mood',    r: 0.71 },
  { from: 'workout', to: 'mood',    r: 0.55 },
  { from: 'sleep',   to: 'workout', r: -0.40 },
];

const bigNodesM: GNode[] = [
  { id: 'sleep',    emoji: '😴', label: 'Sleep',    x: 55,  y: 40 },
  { id: 'mood',     emoji: '😊', label: 'Mood',     x: 215, y: 40 },
  { id: 'workout',  emoji: '💪', label: 'Workout',  x: 55,  y: 160 },
  { id: 'energy',   emoji: '⚡', label: 'Energy',   x: 215, y: 160 },
  { id: 'caffeine', emoji: '☕', label: 'Caffeine', x: 55,  y: 280 },
  { id: 'stress',   emoji: '😰', label: 'Stress',   x: 215, y: 280 },
];
const bigNodesL: GNode[] = [
  { id: 'sleep',    emoji: '😴', label: 'Sleep',    x: 60,  y: 35 },
  { id: 'mood',     emoji: '😊', label: 'Mood',     x: 260, y: 35 },
  { id: 'workout',  emoji: '💪', label: 'Workout',  x: 60,  y: 130 },
  { id: 'energy',   emoji: '⚡', label: 'Energy',   x: 260, y: 130 },
  { id: 'caffeine', emoji: '☕', label: 'Caffeine', x: 60,  y: 225 },
  { id: 'stress',   emoji: '😰', label: 'Stress',   x: 260, y: 225 },
];
const bigEdges: GEdge[] = [
  { from: 'sleep',    to: 'mood',     r:  0.71 },
  { from: 'workout',  to: 'energy',   r:  0.62 },
  { from: 'caffeine', to: 'stress',   r:  0.54 },
  { from: 'sleep',    to: 'stress',   r: -0.45 },
  { from: 'workout',  to: 'sleep',    r: -0.40 },
  { from: 'mood',     to: 'energy',   r:  0.55 },
];

export default function InsightCard({ size = 'M' }: { size?: WidgetSize }) {
  const { t } = useT();
  const { navigate } = useNavigate();
  const [data, setData] = useState<InsightsResult | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api.insights.get().then(setData).catch(() => setErr(true)); }, []);

  const insight = data ? pickOfDay(data.insights) : null;
  const lowData = !data || data.dataQuality.tierUnlocked === 0 || !insight;

  // ── XS ────────────────────────────────────────────────────────────────────
  if (size === 'XS') {
    return (
      <div style={{ ...fbCard, height: '100%', padding: 12, gap: 4, alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--fb-text-3)' }}>Top insight</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
          <span style={{ fontSize: 22 }}>😴</span>
          <div style={{ width: 30, height: 2, background: 'var(--fb-green)', borderRadius: 99, position: 'relative' }}>
            <span style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', fontSize: 8, fontWeight: 700, color: 'var(--fb-green)', background: 'var(--fb-bg-2)', padding: '0 3px', borderRadius: 99 }}>+0.71</span>
          </div>
          <span style={{ fontSize: 22 }}>😊</span>
        </div>
        <span style={{ fontSize: 9.5, color: 'var(--fb-text-2)', textAlign: 'center', lineHeight: 1.3 }}>
          Sonno ↑ <strong style={{ color: 'var(--fb-text)' }}>mood +24%</strong>
        </span>
      </div>
    );
  }

  // ── S ─────────────────────────────────────────────────────────────────────
  if (size === 'S') {
    return (
      <div style={{ ...fbCard, height: '100%', padding: 12, gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--fb-text-3)' }}>Connection map</span>
          <span style={{ fontSize: 9, color: 'var(--fb-text-3)' }}>3 corr.</span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <NetworkGraph width={280} height={130} nodes={smallNodes} edges={smallEdges} nodeR={14} highlightEdge={{ from: 'sleep', to: 'mood' }} />
        </div>
      </div>
    );
  }

  // ── M ─────────────────────────────────────────────────────────────────────
  if (size === 'M') {
    return (
      <div style={{ ...fbCard, height: '100%', padding: 14, display: 'grid', gridTemplateColumns: '230px 1fr', gap: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--fb-text-3)' }}>Connection map</span>
          <div style={{ flex: 1, minHeight: 0 }}>
            <NetworkGraph width={270} height={320} nodes={bigNodesM} edges={bigEdges} nodeR={18} highlightEdge={{ from: 'sleep', to: 'mood' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--fb-green)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Top correlation</span>
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, background: 'color-mix(in srgb, var(--fb-green) 14%, transparent)', color: 'var(--fb-green)', fontWeight: 700 }}>r = +0.71</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 24 }}>😴</span>
              <span style={{ fontSize: 16, color: 'var(--fb-green)' }}>→</span>
              <span style={{ fontSize: 24 }}>😊</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--fb-text)', marginLeft: 4 }}>+24% mood</span>
            </div>
            {insight && (
              <div style={{ fontSize: 11.5, color: 'var(--fb-text-2)', lineHeight: 1.4, marginTop: 6 }}>
                {insight.text}
              </div>
            )}
            {insight?.actionHint && (
              <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--fb-accent) 8%, var(--fb-bg-2))', border: '1px solid var(--fb-accent)', fontSize: 10.5, color: 'var(--fb-text-2)' }}>
                💡 {insight.actionHint}
              </div>
            )}
          </div>

          {data && data.insights.length > 1 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8, borderTop: '1px solid var(--fb-divider)', minHeight: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 9, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Altri insight</div>
              {data.insights.slice(1, 4).map((ins, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: DOT[ins.severity] ?? '#9ca3af', flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 10.5, color: 'var(--fb-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{ins.text}</span>
                </div>
              ))}
            </div>
          )}
          {!err && lowData && (
            <div style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>{t('insights.card.lowData')}</div>
          )}
        </div>
      </div>
    );
  }

  // ── L ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...fbCard, height: '100%', padding: 20, display: 'grid', gridTemplateColumns: '340px 1fr 280px', gap: 22, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--fb-text-3)' }}>Connection map</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--fb-text-3)' }}>
            <span style={{ width: 18, height: 2, background: 'var(--fb-green)', borderRadius: 99 }} />
            <span>positiva</span>
            <span style={{ width: 18, height: 2, background: 'var(--fb-red)', borderRadius: 99, marginLeft: 6 }} />
            <span>negativa</span>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <NetworkGraph width={320} height={260} nodes={bigNodesL} edges={bigEdges} nodeR={20} highlightEdge={{ from: 'sleep', to: 'mood' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18, borderLeft: '1px solid var(--fb-divider)', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--fb-green)', letterSpacing: 0.6, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 99, background: 'color-mix(in srgb, var(--fb-green) 12%, transparent)', border: '1px solid var(--fb-green)' }}>Insight of the week</span>
          <span style={{ fontSize: 10, color: 'var(--fb-text-3)' }} className="tnum">r = +0.71 · strong</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 40 }}>😴</span>
          <div style={{ flex: 1, height: 3, background: 'linear-gradient(90deg, var(--fb-text-3), var(--fb-green))', borderRadius: 99, position: 'relative' }}>
            <span style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 700, color: 'var(--fb-green)', background: 'var(--fb-card)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--fb-green)' }}>+24% mood</span>
          </div>
          <span style={{ fontSize: 40 }}>😊</span>
        </div>

        <div style={{ fontSize: 13, color: 'var(--fb-text-2)', lineHeight: 1.5 }}>
          {insight ? insight.text : 'Quando dormi ≥ 7h, il tuo mood medio sale del 24% rispetto a notti più brevi.'}
        </div>

        {insight?.actionHint && (
          <div style={{ padding: '8px 10px', background: 'color-mix(in srgb, var(--fb-accent) 8%, var(--fb-bg-2))', border: '1px solid var(--fb-accent)', borderRadius: 8 }}>
            <span style={{ fontSize: 9, color: 'var(--fb-accent)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>💡 Azione</span>
            <div style={{ fontSize: 11, color: 'var(--fb-text)', marginTop: 2 }}>{insight.actionHint}</div>
          </div>
        )}

        <div style={{ marginTop: 'auto', fontSize: 9, color: 'var(--fb-text-3)' }}>
          Data quality: <strong style={{ color: 'var(--fb-amber)' }}>Tier {data?.dataQuality?.tierUnlocked ?? 1}</strong> · {data?.dataQuality?.dataPoints ?? '—'} punti dato
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 18, borderLeft: '1px solid var(--fb-divider)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>All correlations</span>
          <span style={{ fontSize: 9, color: 'var(--fb-text-3)' }}>{bigEdges.length} found</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {bigEdges.slice().sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).map((e, i) => {
            const fromN = bigNodesL.find(n => n.id === e.from)!;
            const toN = bigNodesL.find(n => n.id === e.to)!;
            const isTop = i === 0;
            const color = e.r > 0 ? 'var(--fb-green)' : 'var(--fb-red)';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: isTop ? 'color-mix(in srgb, var(--fb-green) 6%, var(--fb-bg-2))' : 'var(--fb-bg-2)', border: `1px solid ${isTop ? 'var(--fb-green)' : 'var(--fb-border)'}`, borderRadius: 7 }}>
                <span style={{ fontSize: 13 }}>{fromN.emoji}</span>
                <span style={{ color, fontSize: 10 }}>{e.r > 0 ? '→' : '⊣'}</span>
                <span style={{ fontSize: 13 }}>{toN.emoji}</span>
                <span style={{ flex: 1, fontSize: 10, color: 'var(--fb-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 4 }}>{fromN.label} → {toN.label}</span>
                <span className="tnum" style={{ fontSize: 10, fontWeight: 700, color }}>{e.r > 0 ? '+' : ''}{e.r.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
        <button onClick={() => navigate('insights')} style={{
          marginTop: 'auto', alignSelf: 'flex-start',
          background: 'transparent', border: '1px solid var(--fb-border)',
          color: 'var(--fb-text-2)', padding: '4px 10px', borderRadius: 6,
          fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}>{t('insights.card.seeAll')}</button>
      </div>
    </div>
  );
}
