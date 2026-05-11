// SP1 intentional deferrals:
// - Raw scatter points not returned by backend → contrast shown as 2-bar chart (highMean vs lowMean)
// - Milestone insights not surfaced (no milestone generation in SP1)
// - dataVersion memo cache skipped (computation is cheap enough for now)
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
} from 'recharts';
import { api } from '../api';
import { useT } from '../i18n/useT';
import { fbCard, fbEyebrow } from '../lib/fbStyles';
import type { InsightsResult, Insight, InsightContrast } from '../types';
import { InsightLine } from '../components/InsightLine';

// ── Module label map ──────────────────────────────────────────────────────────

const MODULE_KEYS: Record<string, string> = {
  food:     'insights.module.food',
  weight:   'insights.module.weight',
  workouts: 'insights.module.workouts',
  energy:   'insights.module.energy',
  water:    'insights.module.water',
};

// ── Confidence badge ──────────────────────────────────────────────────────────

const CONF_COLORS: Record<string, string> = {
  low:    'var(--fb-text-3)',
  medium: '#d97706',
  high:   '#16a34a',
};

function ConfidenceBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const { t } = useT();
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase',
      color: CONF_COLORS[level] ?? 'var(--fb-text-3)',
      border: `1px solid ${CONF_COLORS[level] ?? 'var(--fb-border)'}`,
      borderRadius: 4, padding: '1px 5px', flexShrink: 0,
    }}>
      {t(`insights.confidence.${level}`)}
    </span>
  );
}

// ── Contrast mini-chart ────────────────────────────────────────────────────────

function ContrastChart({ contrast }: { contrast: InsightContrast }) {
  const data = [
    { name: contrast.cutoffLabel, value: contrast.highMean != null ? Number(contrast.highMean.toFixed(2)) : 0 },
    { name: 'altri', value: contrast.lowMean != null ? Number(contrast.lowMean.toFixed(2)) : 0 },
  ];
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} width={30} />
        <Tooltip formatter={(v: number) => v.toFixed(2)} />
        <Bar dataKey="value" fill="#6366f1" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Single insight row ────────────────────────────────────────────────────────

function InsightRow({ insight }: { insight: Insight }) {
  const contrast = insight.type === 'association'
    ? (insight.evidence.contrast ?? null)
    : null;

  return (
    <div style={{
      ...fbCard,
      display: 'flex', flexDirection: 'column', gap: 8,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <InsightLine insight={insight} />
        </div>
        <ConfidenceBadge level={insight.confidence} />
      </div>
      {contrast && (
        <div style={{ paddingLeft: 16 }}>
          <ContrastChart contrast={contrast} />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { t } = useT();
  const [data, setData]       = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(false);

  useEffect(() => {
    api.insights.get()
      .then(r => { setData(r); setLoading(false); })
      .catch(() => { setErr(true); setLoading(false); });
  }, []);

  // Group insights by first relatedModules entry
  const groups: Array<{ moduleKey: string; items: Insight[] }> = [];
  if (data) {
    const seen = new Map<string, Insight[]>();
    for (const ins of data.insights) {
      const mod = ins.relatedModules[0] ?? 'other';
      if (!seen.has(mod)) seen.set(mod, []);
      seen.get(mod)!.push(ins);
    }
    for (const [mod, items] of seen.entries()) {
      groups.push({ moduleKey: mod, items });
    }
  }

  const dq = data?.dataQuality;

  return (
    <div style={{
      maxWidth: 720, margin: '0 auto', padding: '32px 24px 48px',
      fontFamily: 'var(--font-body)', color: 'var(--fb-text)',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ ...fbEyebrow, marginBottom: 6 }}>INSIGHT</div>
        <h1 style={{
          margin: 0, fontSize: 26, fontWeight: 700,
          fontFamily: 'var(--font-display)', color: 'var(--fb-text)',
        }}>
          {t('insights.page.title')}
        </h1>
      </div>

      {/* Data quality strip */}
      {dq && (
        <div style={{
          background: 'var(--fb-bg-2)',
          border: '1px solid var(--fb-border)',
          borderRadius: 10, padding: '10px 14px',
          fontSize: 12, color: 'var(--fb-text-2)',
          marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span>
            {t('insights.page.dataStrip')
              .replace('{n}', String(dq.windowDays))
              .replace('{m}', String(dq.daysWithAnyData))
              .replace('{k}', String(dq.reliableFoodDays))}
          </span>
          {dq.tierUnlocked < 3 && (
            <span style={{ color: 'var(--fb-accent)', fontWeight: 500 }}>
              {t('insights.page.tierHint')}
            </span>
          )}
        </div>
      )}

      {/* ── Chart Strip ───────────────────────────────────────────────────── */}
      {!loading && !err && data && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}>

          {/* 1. Coverage by signal */}
          {dq?.perSignalCoverage && Object.keys(dq.perSignalCoverage).length > 0 && (() => {
            const coverageData = Object.entries(dq.perSignalCoverage!)
              .map(([k, v]) => ({ module: t(MODULE_KEYS[k] ?? k), value: Math.round(v * 100) }))
              .sort((a, b) => b.value - a.value);
            return (
              <div style={{ ...fbCard }}>
                <div style={{ ...fbEyebrow, marginBottom: 8 }}>{t('insights.charts.coverageTitle')}</div>
                {coverageData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={coverageData} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                      <YAxis type="category" dataKey="module" tick={{ fontSize: 10 }} width={60} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="value" fill="#6366f1" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--fb-text-3)', padding: '16px 0', textAlign: 'center' }}>
                    {t('insights.charts.empty')}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 2. Type mix donut */}
          {data.insights.length > 0 && (() => {
            const TYPE_COLORS: Record<string, string> = {
              association: '#6366f1', trend: '#10b981', anomaly: '#f59e0b',
              factor: '#ec4899', milestone: '#8b5cf6',
            };
            const counts: Record<string, number> = {};
            for (const ins of data.insights) {
              counts[ins.type] = (counts[ins.type] ?? 0) + 1;
            }
            const pieData = Object.entries(counts).map(([type, value]) => ({
              name: t(`insights.type.${type}`),
              value,
              color: TYPE_COLORS[type] ?? '#9ca3af',
            }));
            const total = data.insights.length;
            return (
              <div style={{ ...fbCard }}>
                <div style={{ ...fbEyebrow, marginBottom: 8 }}>{t('insights.charts.mixTitle')}</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={(props: { name: string; value: number }) => `${props.name} (${props.value})`}
                      labelLine={false}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--fb-text-3)', marginTop: -8 }}>
                  {total} {total === 1 ? 'insight' : 'insights'}
                </div>
              </div>
            );
          })()}

          {/* 3. Association strength scatter */}
          {(() => {
            const assocInsights = data.insights.filter(ins =>
              ins.type === 'association' &&
              ins.evidence.n != null &&
              (ins.evidence.rho != null || ins.evidence.r != null)
            );
            if (assocInsights.length < 2) return null;
            const scatterData = assocInsights.map(ins => ({
              x: ins.evidence.n ?? 0,
              y: Math.abs((ins.evidence.rho ?? ins.evidence.r ?? 0) as number),
              z: ins.score,
              name: ins.text,
            }));
            return (
              <div style={{ ...fbCard }}>
                <div style={{ ...fbEyebrow, marginBottom: 8 }}>{t('insights.charts.strengthTitle')}</div>
                <ResponsiveContainer width="100%" height={220}>
                  <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <XAxis dataKey="x" type="number" name="n" tick={{ fontSize: 10 }} label={{ value: 'n', position: 'insideBottomRight', offset: -4, fontSize: 10 }} />
                    <YAxis dataKey="y" type="number" name="|r|" domain={[0, 1]} tick={{ fontSize: 10 }} />
                    <ZAxis dataKey="z" range={[40, 200]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0]?.payload as { name: string; [k: string]: unknown };
                      return (
                        <div style={{ background: 'var(--fb-card)', border: '1px solid var(--fb-border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, maxWidth: 200 }}>
                          {d?.name}
                        </div>
                      );
                    }} />
                    <ReferenceLine y={0.3} stroke="var(--fb-text-3)" strokeDasharray="4 2" label={{ value: t('insights.charts.strengthThreshold'), position: 'insideTopRight', fontSize: 9, fill: 'var(--fb-text-3)' }} />
                    <Scatter data={scatterData} fill="#6366f1" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ opacity: 0.5, fontSize: 14 }}>
          {t('onboarding.loading')}
        </div>
      )}

      {/* Error */}
      {!loading && err && (
        <div style={{ opacity: 0.6, fontSize: 14 }}>{t('insights.card.error')}</div>
      )}

      {/* Empty state */}
      {!loading && !err && data && data.insights.length === 0 && (
        <div style={{
          ...fbCard,
          padding: 32, textAlign: 'center',
          fontSize: 15, color: 'var(--fb-text-2)', lineHeight: 1.6,
        }}>
          {t('insights.page.empty')}
        </div>
      )}

      {/* Grouped insights */}
      {!loading && !err && groups.map(({ moduleKey, items }) => {
        const labelKey = MODULE_KEYS[moduleKey] ?? 'insights.module.other';
        return (
          <div key={moduleKey} style={{ marginBottom: 28 }}>
            <div style={{
              ...fbEyebrow, marginBottom: 10,
              borderBottom: '1px solid var(--fb-divider)', paddingBottom: 6,
            }}>
              {t(labelKey)}
            </div>
            {items.map(ins => <InsightRow key={ins.id} insight={ins} />)}
          </div>
        );
      })}

      {/* Footnote */}
      {!loading && !err && data && data.insights.length > 0 && (
        <div style={{
          marginTop: 32, fontSize: 11, color: 'var(--fb-text-3)',
          lineHeight: 1.5, fontStyle: 'italic',
        }}>
          {t('insights.page.footnote')}
        </div>
      )}
    </div>
  );
}
