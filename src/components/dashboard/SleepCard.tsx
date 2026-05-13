import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useT } from '../../i18n/useT';
import { useNavigate } from '../../hooks/useNavigate';
import { cardOuter, eyebrow } from '../../lib/fbUI';
import type { SleepEntry, WidgetSize } from '../../types';

function formatDuration(min: number | null): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function todayStr(): string { return new Date().toISOString().slice(0, 10); }

function Spark({ points, color, height, target }: { points: number[]; color: string; height: number; target?: number }) {
  const max = Math.max(...points, target ?? 0, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, width: '100%', position: 'relative' }}>
      {target && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: `${(1 - target/max) * 100}%`, borderTop: '1px dashed var(--fb-amber)', opacity: 0.5 }} />
      )}
      {points.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: v > 0 ? Math.max(4, (v / max) * height) : 3,
          borderRadius: 2,
          background: v > 0 ? color : 'var(--fb-border-strong, var(--fb-border))',
          opacity: i === points.length - 1 ? 1 : 0.6,
        }} />
      ))}
    </div>
  );
}

export default function SleepCard({ size = 'M' }: { size?: WidgetSize }) {
  const { t } = useT();
  const { navigate } = useNavigate();
  const [entry, setEntry] = useState<SleepEntry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [weekData, setWeekData] = useState<number[]>(Array(7).fill(0));

  useEffect(() => {
    api.sleep.get(todayStr())
      .then(row => { setEntry(row as SleepEntry | null); setLoaded(true); })
      .catch(() => setLoaded(true));
    const promises = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      promises.push(api.sleep.get(d.toISOString().slice(0, 10)).catch(() => null));
    }
    Promise.all(promises).then(rows => {
      setWeekData(rows.map(r => (r as SleepEntry | null)?.duration_min ?? 0));
    });
  }, []);

  const duration = formatDuration(entry?.duration_min ?? null);
  const quality  = entry?.quality ?? 0;
  const targetMin = 480;
  const actualMin = entry?.duration_min ?? 0;
  const debtMin = Math.max(0, targetMin - actualMin);
  const weekAvg = weekData.filter(v => v > 0).length > 0
    ? Math.round(weekData.filter(v => v > 0).reduce((a, b) => a + b, 0) / weekData.filter(v => v > 0).length)
    : 0;
  const weekDebt = weekData.reduce((a, v) => a + Math.max(0, targetMin - v), 0);

  // ── XS ────────────────────────────────────────────────────────────────────
  if (size === 'XS') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 12, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span style={{ ...eyebrow, fontSize: 8.5 }}>🌙 {t('sleep.eyebrow')}</span>
        <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 40, color: loaded ? 'var(--fb-text)' : 'var(--fb-text-3)' }}>{loaded ? duration : '…'}</div>
        {quality > 0 && (
          <div style={{ display: 'flex', gap: 3 }}>
            {[1,2,3,4,5].map(n => (
              <span key={n} style={{
                width: 6, height: 6, borderRadius: 99,
                background: n <= quality ? 'var(--fb-accent)' : 'var(--fb-border-strong, var(--fb-border))',
              }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── S ─────────────────────────────────────────────────────────────────────
  if (size === 'S') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 14, gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={eyebrow}>🌙 {t('sleep.eyebrow')}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 32, color: 'var(--fb-text)' }}>{loaded ? duration : '…'}</span>
              {entry?.bedtime && entry?.wake_time && (
                <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 10.5, color: 'var(--fb-text-3)' }}>
                  {entry.bedtime} → {entry.wake_time}
                </span>
              )}
            </div>
          </div>
          {quality > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: 9, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Quality</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {[1,2,3,4,5].map(n => (
                  <span key={n} style={{
                    width: 7, height: 7, borderRadius: 99,
                    background: n <= quality ? 'var(--fb-accent)' : 'var(--fb-border-strong, var(--fb-border))',
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
            <span>7-day avg</span>
            <span className="tnum">{formatDuration(weekAvg)}</span>
          </div>
          <Spark points={weekData} color="var(--fb-accent)" height={22} />
        </div>
      </div>
    );
  }

  // ── M ─────────────────────────────────────────────────────────────────────
  if (size === 'M') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 18, gap: 12, justifyContent: 'flex-start', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={eyebrow}>🌙 {t('sleep.eyebrow')} · ieri notte</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 54, color: 'var(--fb-text)' }}>{loaded ? duration : '…'}</span>
              {entry?.bedtime && entry?.wake_time && (
                <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--fb-text-2)' }}>
                  {entry.bedtime} → {entry.wake_time}
                </span>
              )}
            </div>
            {debtMin > 0 && (
              <div style={{ fontSize: 11, color: 'var(--fb-amber)', fontWeight: 600, marginTop: 2 }}>Debt -{Math.floor(debtMin/60)}h {debtMin%60}m vs target 8h</div>
            )}
          </div>
          {quality > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              <span style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Quality</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1,2,3,4,5].map(n => (
                  <span key={n} style={{ width: 9, height: 9, borderRadius: 99, background: n <= quality ? 'var(--fb-accent)' : 'var(--fb-border-strong, var(--fb-border))' }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: 'var(--fb-text)', fontWeight: 600 }} className="tnum">{quality}/5</span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, paddingTop: 8, borderTop: '1px solid var(--fb-divider)' }}>
          {[
            { l: 'Bed',   v: entry?.bedtime ?? '—' },
            { l: 'Wake',  v: entry?.wake_time ?? '—' },
            { l: 'Avg 7g', v: formatDuration(weekAvg) },
            { l: 'Debt', v: weekDebt > 0 ? `-${Math.floor(weekDebt/60)}h` : '0h' },
          ].map(s => (
            <div key={s.l} style={{ background: 'var(--fb-bg-2)', border: '1px solid var(--fb-border)', borderRadius: 7, padding: '6px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--fb-text-3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>{s.l}</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15, color: 'var(--fb-text)' }}>{s.v}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8, borderTop: '1px solid var(--fb-divider)', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
            <span>Last 7 days</span>
            <span className="tnum">avg {formatDuration(weekAvg)} · target 8h</span>
          </div>
          <Spark points={weekData} color="var(--fb-accent)" height={50} target={targetMin} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: 'var(--fb-text-3)' }}>
            {['Lu','Ma','Me','Gi','Ve','Sa','Do'].map(d => <span key={d}>{d}</span>)}
          </div>
        </div>
      </div>
    );
  }

  // ── L ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...cardOuter, height: '100%', padding: 20, display: 'grid', gridTemplateColumns: '240px 1fr 200px 240px', gap: 22, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <span style={eyebrow}>🌙 {t('sleep.eyebrow')} · ieri</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 72, color: 'var(--fb-text)' }}>{loaded ? duration : '…'}</span>
          </div>
          {entry?.bedtime && entry?.wake_time && (
            <div style={{ fontSize: 12, color: 'var(--fb-text-3)', marginTop: 2 }}>
              {entry.bedtime} → {entry.wake_time}
            </div>
          )}
          {debtMin > 0 && (
            <div style={{ fontSize: 11, color: 'var(--fb-amber)', fontWeight: 600, marginTop: 2 }}>Debt -{Math.floor(debtMin/60)}h {debtMin%60}m</div>
          )}
        </div>
        {quality > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 10 }}>
            <span style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Quality {quality}/5</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1,2,3,4,5].map(n => (
                <span key={n} style={{ flex: 1, height: 8, borderRadius: 99, background: n <= quality ? 'var(--fb-accent)' : 'var(--fb-border-strong, var(--fb-border))' }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
          <span>Last 7 days</span>
          <span className="tnum">avg {formatDuration(weekAvg)} · target 8h</span>
        </div>
        <div style={{ flex: 1 }}>
          <Spark points={weekData} color="var(--fb-accent)" height={130} target={targetMin} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--fb-text-3)' }}>
          {['Lu','Ma','Me','Gi','Ve','Sa','Do'].map(d => <span key={d} style={{ flex: 1, textAlign: 'center' }}>{d}</span>)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 16, borderLeft: '1px solid var(--fb-divider)' }}>
        <div style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Settimana</div>
        {[
          { l: 'Avg',  v: formatDuration(weekAvg), c: 'var(--fb-text)' },
          { l: 'Best', v: formatDuration(Math.max(...weekData)), c: 'var(--fb-green)' },
          { l: 'Worst', v: formatDuration(Math.min(...weekData.filter(v => v > 0))), c: 'var(--fb-red)' },
          { l: 'Debt tot', v: `-${Math.floor(weekDebt/60)}h ${weekDebt%60}m`, c: 'var(--fb-amber)' },
        ].map(s => (
          <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--fb-text-3)' }}>{s.l}</span>
            <span className="tnum" style={{ color: s.c, fontWeight: 600 }}>{s.v}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 16, borderLeft: '1px solid var(--fb-divider)' }}>
        <div style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Timeline</div>
        <div style={{ position: 'relative', flex: 1, background: 'linear-gradient(180deg, var(--fb-bg-2) 0%, color-mix(in srgb, var(--fb-accent) 8%, var(--fb-bg-2)) 50%, var(--fb-bg-2) 100%)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ fontSize: 14 }}>🌙</span><span style={{ color: 'var(--fb-text-3)' }}>Bed</span>
            <span style={{ marginLeft: 'auto', color: 'var(--fb-text)', fontWeight: 600 }} className="tnum">{entry?.bedtime ?? '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ fontSize: 14 }}>💤</span><span style={{ color: 'var(--fb-text-3)' }}>Sonno</span>
            <span style={{ marginLeft: 'auto', color: 'var(--fb-accent)', fontWeight: 700 }} className="tnum">{duration}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ fontSize: 14 }}>☀️</span><span style={{ color: 'var(--fb-text-3)' }}>Wake</span>
            <span style={{ marginLeft: 'auto', color: 'var(--fb-text)', fontWeight: 600 }} className="tnum">{entry?.wake_time ?? '—'}</span>
          </div>
        </div>
        <button type="button" onClick={() => navigate('sleep')}
          style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px solid var(--fb-border)', color: 'var(--fb-text-2)', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          {t('sleep.logSleep')}
        </button>
      </div>
    </div>
  );
}
