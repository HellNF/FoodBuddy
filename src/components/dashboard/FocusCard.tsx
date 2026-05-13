import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { useT } from '../../i18n/useT';
import { useNavigate } from '../../hooks/useNavigate';
import { cardOuter, eyebrow } from '../../lib/fbUI';
import { fbBtnGhost } from '../../lib/fbStyles';
import type { FocusSession, FocusWeekPoint, WidgetSize } from '../../types';

function formatDurationShort(min: number): string {
  if (min === 0) return '0 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function nDaysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function Ring({ size = 80, pct = 70, color = 'var(--fb-accent)' }: { size?: number; pct?: number; color?: string }) {
  const r = (size - 10) / 2; const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--fb-border)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

function AreaChart({ points, color, height, target }: { points: number[]; color: string; height: number; target?: number }) {
  const max = Math.max(...points, target ?? 0, 1);
  const w = 100;
  const stepX = points.length > 1 ? w / (points.length - 1) : w;
  const linePath = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${100 - (v / max) * 100}`).join(' ');
  const areaPath = `${linePath} L ${w} 100 L 0 100 Z`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <defs>
        <linearGradient id={`focus-grad-${color.replace(/[^\w]/g,'')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {target != null && (
        <line x1="0" y1={100 - (target / max) * 100} x2="100" y2={100 - (target / max) * 100}
          stroke="var(--fb-amber)" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.6" vectorEffect="non-scaling-stroke" />
      )}
      <path d={areaPath} fill={`url(#focus-grad-${color.replace(/[^\w]/g,'')})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function FocusCard({ size = 'M' }: { size?: WidgetSize }) {
  const { t } = useT();
  const { navigate } = useNavigate();
  const [totalMin, setTotalMin] = useState(0);
  const [sparkPoints, setSparkPoints] = useState<number[]>(Array(7).fill(0));
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([
      api.focus.getDayStats(todayStr()),
      api.focus.getWeekStats(nDaysAgo(6), todayStr()),
      api.focus.getActiveSession(),
    ]).then(([dayStats, weekStats, active]) => {
      setTotalMin(dayStats.total_min);
      const points = Array.from({ length: 7 }, (_, i) => {
        const d = nDaysAgo(6 - i);
        const found = (weekStats as FocusWeekPoint[]).find(w => w.date === d);
        return found?.total_min ?? 0;
      });
      setSparkPoints(points);
      setActiveSession(active);
      setLoaded(true);
      if (active) setElapsed(Date.now() - new Date(active.started_at).getTime());
    }).catch(() => setLoaded(true));
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (activeSession) {
      const startMs = new Date(activeSession.started_at).getTime();
      intervalRef.current = setInterval(() => setElapsed(Date.now() - startMs), 1000);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [activeSession]);

  async function handleStop() {
    if (!activeSession) return;
    const durationMin = Math.max(1, Math.round(elapsed / 60000));
    await api.focus.stopSession(activeSession.id, durationMin);
    setActiveSession(null);
    setElapsed(0);
    api.focus.getDayStats(todayStr()).then(s => setTotalMin(s.total_min)).catch(() => {});
  }

  const goalMin = 90;
  const todayPct = Math.min(100, (totalMin / goalMin) * 100);
  const weekTotal = sparkPoints.reduce((a, b) => a + b, 0);
  const weekAvg = (() => { const a = sparkPoints.filter(p => p > 0); return a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : 0; })();
  const pomos = Math.floor(totalMin / 25);

  // ── XS ────────────────────────────────────────────────────────────────────
  if (size === 'XS') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 12, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span style={{ ...eyebrow, fontSize: 8.5 }}>🧠 {t('focus.eyebrow')}</span>
        <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 34, color: 'var(--fb-text)' }}>{totalMin}m</div>
        <div style={{ fontSize: 9, color: 'var(--fb-text-3)' }}>{pomos} pomodori</div>
      </div>
    );
  }

  // ── S ─────────────────────────────────────────────────────────────────────
  if (size === 'S') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={eyebrow}>🧠 {t('focus.eyebrow')}</span>
          <span style={{ fontSize: 10, color: 'var(--fb-text-3)' }}>{pomos} 🍅</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 32, color: 'var(--fb-text)' }}>{totalMin}</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 11, color: 'var(--fb-text-2)' }}>min · goal {goalMin}m</span>
        </div>
        <div style={{ height: 22 }}>
          <AreaChart points={sparkPoints} color="var(--fb-accent)" height={20} />
        </div>
      </div>
    );
  }

  // ── M (2×2 quadrants) ─────────────────────────────────────────────────────
  if (size === 'M') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Ring size={86} pct={todayPct} color="var(--fb-accent)" />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, color: 'var(--fb-accent)' }}>{totalMin}</span>
              <span style={{ fontSize: 8.5, color: 'var(--fb-text-3)', letterSpacing: 0.5 }}>/ {goalMin}m</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={eyebrow}>🧠 {t('focus.eyebrow')}</span>
            <span style={{ fontSize: 11, color: 'var(--fb-text-2)' }}>Oggi</span>
            <span style={{ fontSize: 10.5, color: 'var(--fb-accent)', fontWeight: 700 }}>{Math.round(todayPct)}% goal</span>
          </div>
        </div>

        <div style={{ background: 'var(--fb-bg-2)', border: '1px solid var(--fb-border)', borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--fb-text-3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Pomodori</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 20, color: 'var(--fb-accent)' }}>{pomos}</span>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} style={{
                width: 18, height: 18, borderRadius: 5,
                background: i < pomos ? 'var(--fb-accent)' : 'transparent',
                border: i < pomos ? 'none' : '1.5px dashed var(--fb-border-strong, var(--fb-border))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: i < pomos ? 'white' : 'transparent',
              }}>🍅</span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
            <span>7 days</span>
            <span className="tnum">{Math.floor(weekTotal/60)}h {weekTotal%60}m</span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <AreaChart points={sparkPoints} color="var(--fb-accent)" height={60} target={goalMin} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Status</span>
          {activeSession ? (
            <>
              <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, color: 'var(--fb-accent)' }}>{formatElapsed(elapsed)}</div>
              {activeSession.project && <span style={{ fontSize: 10, color: 'var(--fb-text-3)' }}>{activeSession.project}</span>}
              <button onClick={handleStop} style={{ ...fbBtnGhost, borderColor: 'var(--fb-red)', color: 'var(--fb-red)', fontSize: 10.5, marginTop: 4, alignSelf: 'flex-start' }}>⏹ {t('focus.stop')}</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 10.5, color: 'var(--fb-text-3)' }}>Nessuna sessione attiva</span>
              <button onClick={() => navigate('focus')} style={{ ...fbBtnGhost, fontSize: 10.5, marginTop: 4, alignSelf: 'flex-start' }}>▶ Pomodoro</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── L ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...cardOuter, height: '100%', padding: 20, display: 'grid', gridTemplateColumns: '230px 1fr 280px', gap: 22, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={eyebrow}>🧠 {t('focus.eyebrow')} · oggi</span>
          <div style={{ position: 'relative' }}>
            <Ring size={150} pct={todayPct} color="var(--fb-accent)" />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 40, color: 'var(--fb-accent)' }}>{totalMin}</span>
              <span style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>/ {goalMin}m</span>
              <span style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginTop: 3 }}>{Math.round(todayPct)}% goal</span>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--fb-bg-2)', border: '1px solid var(--fb-border)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--fb-text-3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Pomodori</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--fb-accent)' }}>{pomos}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} style={{
                flex: 1, aspectRatio: '1', maxWidth: 20, borderRadius: 4,
                background: i < pomos ? 'var(--fb-accent)' : 'transparent',
                border: i < pomos ? 'none' : '1.5px dashed var(--fb-border-strong, var(--fb-border))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: i < pomos ? 'white' : 'transparent',
              }}>🍅</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 18, borderLeft: '1px solid var(--fb-divider)', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Last 7 days</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 24, color: 'var(--fb-text)' }}>{Math.floor(weekTotal/60)}h {weekTotal%60}m</span>
              <span style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>tot · avg {weekAvg}m</span>
            </div>
          </div>
          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: 'color-mix(in srgb, var(--fb-amber) 12%, transparent)', color: 'var(--fb-amber)', fontWeight: 700, letterSpacing: 0.4 }}>goal {goalMin}m/d</span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AreaChart points={sparkPoints} color="var(--fb-accent)" height={150} target={goalMin} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--fb-text-3)' }}>
          {['Lu','Ma','Me','Gi','Ve','Sa','Do'].map(d => <span key={d} style={{ flex: 1, textAlign: 'center' }}>{d}</span>)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 18, borderLeft: '1px solid var(--fb-divider)' }}>
        <div>
          <div style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 6 }}>Status</div>
          {activeSession ? (
            <>
              <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 32, color: 'var(--fb-accent)' }}>{formatElapsed(elapsed)}</div>
              {activeSession.project && <div style={{ fontSize: 11, color: 'var(--fb-text-3)', fontStyle: 'italic', marginTop: 2 }}>{activeSession.project}</div>}
              <button onClick={handleStop} style={{ ...fbBtnGhost, borderColor: 'var(--fb-red)', color: 'var(--fb-red)', fontSize: 11.5, marginTop: 6 }}>⏹ {t('focus.stop')}</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--fb-text-3)' }}>Nessuna sessione attiva</div>
              <button onClick={() => navigate('focus')} style={{ ...fbBtnGhost, fontSize: 11.5, marginTop: 6 }}>▶ Pomodoro</button>
            </>
          )}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--fb-divider)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { l: 'Best day', v: `${Math.max(...sparkPoints, 0)}m` },
            { l: 'Pomos sett', v: `${Math.floor(weekTotal/25)}` },
          ].map(s => (
            <div key={s.l} style={{ background: 'var(--fb-bg-2)', border: '1px solid var(--fb-border)', borderRadius: 7, padding: '6px 8px' }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--fb-text-3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>{s.l}</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15, color: 'var(--fb-text)' }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
