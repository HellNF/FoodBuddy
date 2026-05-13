import { useEffect, useState, type CSSProperties } from 'react';
import type { FocusSnapshot } from '../lib/focusLock';

function fmt(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

const initial: FocusSnapshot = {
  active: false, mode: 'pomodoro', state: 'IDLE',
  phase: 'focus', remainSec: 0, totalSec: 0,
};

type ApiBridge = {
  on: (c: string, cb: (...a: unknown[]) => void) => void;
  off: (c: string) => void;
  invoke: (c: string, ...a: unknown[]) => Promise<unknown>;
};

function Ring({ progress, accent, dim }: { progress: number; accent: string; dim: boolean }) {
  const R = 22; const cx = 26; const cy = 26; const SW = 2;
  const C = 2 * Math.PI * R;
  return (
    <svg width={52} height={52} viewBox="0 0 52 52" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor={accent} stopOpacity="0" />
          <stop offset="100%" stopColor={accent} stopOpacity={dim ? 0 : 0.35} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R + 4} fill="url(#ringGlow)" />
      <circle cx={cx} cy={cy} r={R} fill="none"
        stroke="rgba(236,232,223,0.08)" strokeWidth={SW} />
      <circle cx={cx} cy={cy} r={R} fill="none"
        stroke={accent} strokeWidth={SW} strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - progress)}
        transform={`rotate(-90 ${cx} ${cy})`}
        opacity={dim ? 0.35 : 1}
        style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.23,1,0.32,1), opacity 240ms' }} />
    </svg>
  );
}

export default function FocusMiniWidget() {
  const [snap, setSnap] = useState<FocusSnapshot>(initial);
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: ApiBridge }).electronAPI;
    if (!api) { setMounted(true); return; }
    api.on('focus:snapshot', (s) => setSnap(s as FocusSnapshot));
    api.invoke('focus:getLock').then(s => setSnap(s as FocusSnapshot)).catch(() => {});
    requestAnimationFrame(() => setMounted(true));
    return () => api.off('focus:snapshot');
  }, []);

  function restoreMain() {
    const api = (window as unknown as { electronAPI?: ApiBridge }).electronAPI;
    api?.invoke('focus:restoreMain').catch(() => {});
  }

  const isFocus  = snap.phase === 'focus';
  const isPaused = snap.state === 'PAUSED';
  const accent   = isFocus ? '#f59e3b' : '#7cba6c';
  const label    = isPaused ? 'In pausa' : (isFocus ? 'Focus' : 'Pausa breve');

  const progress = snap.totalSec > 0
    ? Math.max(0, Math.min(1, 1 - snap.remainSec / snap.totalSec))
    : 0;

  const drag: CSSProperties   = { WebkitAppRegion: 'drag' } as CSSProperties;
  const noDrag: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties;

  return (
    <>
      <style>{`
        html, body, #root {
          margin: 0; padding: 0;
          width: 100%; height: 100%;
          overflow: hidden;
          background: transparent;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        body::-webkit-scrollbar, html::-webkit-scrollbar { display: none; }
        @keyframes mw-mount {
          from { opacity: 0; transform: translateY(8px); filter: blur(6px); }
          to   { opacity: 1; transform: translateY(0);   filter: blur(0);   }
        }
        @keyframes mw-breathe-${isFocus ? 'f' : 'b'} {
          0%, 100% { box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.04),
            0 0 0 1px rgba(255,255,255,0.04),
            0 0 24px -8px ${accent}33,
            0 18px 40px -18px rgba(0,0,0,0.85); }
          50%      { box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 0 0 1px ${accent}22,
            0 0 32px -6px ${accent}55,
            0 22px 50px -18px rgba(0,0,0,0.85); }
        }
      `}</style>

      {/* Outer shell — hairline ring (Doppelrand layer 1) */}
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => { setHover(false); setPressed(false); }}
        style={{
          ...drag,
          boxSizing: 'border-box',
          width: '100vw', height: '100vh',
          padding: 5,
          borderRadius: 22,
          background:
            'linear-gradient(180deg, rgba(255,240,220,0.06) 0%, rgba(255,240,220,0.02) 100%)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          opacity: mounted ? 1 : 0,
          animation: 'mw-mount 700ms cubic-bezier(0.23,1,0.32,1) both',
          userSelect: 'none',
        }}
      >
        {/* Inner core (Doppelrand layer 2) */}
        <div
          style={{
            position: 'relative',
            width: '100%', height: '100%',
            borderRadius: 17,
            background:
              'radial-gradient(120% 180% at 0% 0%, rgba(245,158,59,0.07) 0%, transparent 55%), ' +
              'linear-gradient(135deg, #1a1612 0%, #0e0c09 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.04),' +
              ' 0 0 0 1px rgba(255,255,255,0.04),' +
              ` 0 0 24px -8px ${accent}33,` +
              ' 0 18px 40px -18px rgba(0,0,0,0.85)',
            animation: isPaused ? undefined : `mw-breathe-${isFocus ? 'f' : 'b'} 3.2s ease-in-out infinite`,
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 12px 12px 14px',
            overflow: 'hidden',
          }}
        >
          {/* Grain overlay — physical paper feel */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            opacity: 0.035, mixBlendMode: 'overlay',
            background:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            backgroundSize: '80px 80px',
          }} />

          {/* Ring */}
          <div style={{ position: 'relative', flexShrink: 0, width: 52, height: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ring progress={progress} accent={accent} dim={isPaused} />
            {isPaused && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(236,232,223,0.5)',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <line x1="9"  y1="6" x2="9"  y2="18" />
                  <line x1="15" y1="6" x2="15" y2="18" />
                </svg>
              </div>
            )}
          </div>

          {/* Text column */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'var(--font-display)',
              fontSize: 9, fontWeight: 600, letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: isPaused ? 'rgba(236,232,223,0.45)' : accent,
              lineHeight: 1,
            }}>
              <span style={{
                display: 'inline-block', width: 5, height: 5, borderRadius: 99,
                background: accent,
                boxShadow: isPaused ? 'none' : `0 0 8px ${accent}`,
                opacity: isPaused ? 0.4 : 1,
              }} />
              {label}
            </span>
            <span style={{
              fontFamily: 'var(--font-serif)', fontStyle: 'italic',
              fontSize: 30, fontWeight: 400, letterSpacing: -0.8,
              color: 'var(--fb-text)', lineHeight: 1.05,
              fontVariantNumeric: 'tabular-nums',
              marginTop: 2,
            }}>
              {fmt(snap.remainSec)}
            </span>
            {snap.project && (
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: 10, color: 'rgba(236,232,223,0.42)',
                letterSpacing: 0.1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginTop: 1,
              }}>
                {snap.project}
              </span>
            )}
          </div>

          {/* Restore — Button-in-Button island */}
          <button
            type="button"
            onClick={restoreMain}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            title="Riapri LifeBuddy"
            className="mw-restore"
            style={{
              ...noDrag,
              position: 'relative',
              flexShrink: 0,
              width: 38, height: 38,
              borderRadius: 99,
              border: '1px solid rgba(255,255,255,0.06)',
              background:
                hover
                  ? 'linear-gradient(180deg, rgba(255,240,220,0.07) 0%, rgba(255,240,220,0.02) 100%)'
                  : 'linear-gradient(180deg, rgba(255,240,220,0.04) 0%, rgba(255,240,220,0.01) 100%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.06),' +
                (hover ? ` 0 0 0 4px ${accent}1a` : ' 0 0 0 0 transparent'),
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 320ms cubic-bezier(0.23,1,0.32,1),' +
                          ' box-shadow 320ms cubic-bezier(0.23,1,0.32,1),' +
                          ' background 240ms cubic-bezier(0.23,1,0.32,1)',
              transform: pressed ? 'scale(0.94)' : (hover ? 'scale(1.04)' : 'scale(1)'),
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={isPaused ? 'rgba(236,232,223,0.7)' : accent}
              strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
              style={{
                transition: 'transform 360ms cubic-bezier(0.23,1,0.32,1)',
                transform: hover ? 'translate(1px, -1px) scale(1.06)' : 'translate(0,0) scale(1)',
              }}>
              <path d="M14 4h6v6" />
              <path d="M10 20H4v-6" />
              <path d="M20 4l-8 8" />
              <path d="M4 20l8-8" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
