import { Component, useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useT } from '../i18n/useT';

interface BarcodeScannerProps {
  onResult: (barcode: string) => void;
  onError?: (err: string) => void;
}

class ScannerErrorBoundary extends Component<{ children: ReactNode }, { msg: string | null }> {
  state = { msg: null as string | null };
  static getDerivedStateFromError(err: unknown) {
    return { msg: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
  componentDidCatch(err: unknown) {
    console.error('[BarcodeScanner crash]', err);
  }
  render() {
    if (this.state.msg) {
      return (
        <div style={{
          padding: '14px 16px',
          background: 'color-mix(in srgb, var(--fb-red) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--fb-red) 35%, transparent)',
          borderRadius: 14,
          color: 'var(--fb-red)', fontSize: 13, whiteSpace: 'pre-wrap',
        }}>
          Scanner crashed: {this.state.msg}
        </div>
      );
    }
    return this.props.children;
  }
}

function safeStop(scanner: Html5Qrcode) {
  try {
    const p = scanner.stop();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch { /* not running */ }
}

function classifyCamera(label: string): 'iphone' | 'mac' {
  const l = label.toLowerCase();
  if (l.includes('iphone') || l.includes('continuity') || l.includes('isight') || l.includes('ipad')) return 'iphone';
  return 'mac';
}

const eyebrow: CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: 1.4,
  textTransform: 'uppercase', color: 'var(--fb-text-3)',
};

export default function BarcodeScanner(props: BarcodeScannerProps) {
  return (
    <ScannerErrorBoundary>
      <BarcodeScannerInner {...props} />
    </ScannerErrorBoundary>
  );
}

function BarcodeScannerInner({ onResult, onError }: BarcodeScannerProps) {
  const { t } = useT();
  const containerRef  = useRef<HTMLDivElement>(null);
  const scannerRef    = useRef<Html5Qrcode | null>(null);
  const scannedRef    = useRef(false);

  const [cameras, setCameras]               = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [scanning, setScanning]             = useState(false);
  const [error, setError]                   = useState('');

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices.length) {
          setCameras(devices);
          const saved = localStorage.getItem('barcode:lastCamera');
          const preferred = (saved && devices.find(d => d.id === saved))
            ?? devices.find(d => classifyCamera(d.label) === 'mac')
            ?? devices[0];
          setSelectedCamera(preferred.id);
        } else {
          setError(t('common.noCamera'));
        }
      })
      .catch(() => setError(t('common.cameraDenied')));
  }, []);

  useEffect(() => {
    if (!selectedCamera || !containerRef.current) return;

    let cancelled = false;
    let started = false;

    const scanner = new Html5Qrcode('barcode-reader', {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
      ],
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    });
    scannerRef.current = scanner;
    scannedRef.current = false;

    scanner
      .start(
        selectedCamera,
        { fps: 10, qrbox: { width: 300, height: 200 } },
        (decodedText) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          safeStop(scanner);
          setScanning(false);
          onResult(decodedText);
        },
        () => {}
      )
      .then(() => {
        started = true;
        if (cancelled) { safeStop(scanner); return; }
        setScanning(true);
      })
      .catch(err => {
        console.error('[BarcodeScanner] start failed:', err);
        if (cancelled) return;
        setError(typeof err === 'string' ? err : 'Avvio fotocamera fallito');
        onError?.(String(err));
      });

    return () => {
      cancelled = true;
      if (started) safeStop(scanner);
    };
  }, [selectedCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  const macCameras    = cameras.filter(c => classifyCamera(c.label) === 'mac');
  const iphoneCameras = cameras.filter(c => classifyCamera(c.label) === 'iphone');

  function pickCamera(id: string) {
    setSelectedCamera(id);
    localStorage.setItem('barcode:lastCamera', id);
  }

  const camPill = (active: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 13px', borderRadius: 99,
    fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    background: active ? 'var(--fb-accent-soft)' : 'var(--fb-bg)',
    border: '1px solid ' + (active ? 'var(--fb-accent)' : 'var(--fb-border)'),
    color: active ? 'var(--fb-accent)' : 'var(--fb-text-2)',
    transition: 'all .3s cubic-bezier(0.32,0.72,0,1)',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Camera source segmented control */}
      {cameras.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...eyebrow, marginRight: 4 }}>Sorgente</span>
          {macCameras.map(c => (
            <button
              key={c.id} onClick={() => pickCamera(c.id)}
              style={camPill(selectedCamera === c.id)}
            >
              <span aria-hidden>💻</span>
              {macCameras.length > 1 ? c.label : 'Mac'}
            </button>
          ))}
          {iphoneCameras.map(c => (
            <button
              key={c.id} onClick={() => pickCamera(c.id)}
              style={camPill(selectedCamera === c.id)}
            >
              <span aria-hidden>📱</span>
              iPhone
            </button>
          ))}
        </div>
      )}

      {/* Viewfinder */}
      <div style={{
        position: 'relative',
        background: 'var(--fb-bg)',
        border: '1px solid var(--fb-border)',
        borderRadius: 22,
        padding: 4,
        overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: '#000' }}>
          <div
            id="barcode-reader" ref={containerRef}
            style={{ width: '100%', minHeight: 240, display: 'block' }}
          />

          {/* Corner brackets (Apple Camera QR style) */}
          {scanning && !error && (
            <>
              <Bracket pos="tl" />
              <Bracket pos="tr" />
              <Bracket pos="bl" />
              <Bracket pos="br" />

              {/* Animated scan line */}
              <span style={{
                position: 'absolute', left: '12%', right: '12%',
                top: '50%',
                height: 2,
                background: 'linear-gradient(90deg, transparent 0%, var(--fb-accent) 50%, transparent 100%)',
                boxShadow: '0 0 18px var(--fb-accent)',
                animation: 'scanSweep 2.4s cubic-bezier(0.32,0.72,0,1) infinite',
                pointerEvents: 'none',
              }} />

              {/* Status pill overlay */}
              <span style={{
                position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', borderRadius: 99,
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                color: 'rgba(255,255,255,0.92)',
                fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--fb-green)',
                  boxShadow: '0 0 8px var(--fb-green)',
                  animation: 'scanPulse 1.6s ease-in-out infinite',
                }} />
                Inquadra il codice a barre
              </span>
            </>
          )}

          {/* Loading state when no camera bound yet */}
          {!scanning && !error && cameras.length > 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.4)',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'var(--font-serif)', fontStyle: 'italic',
              fontSize: 13,
            }}>
              Avvio fotocamera…
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'color-mix(in srgb, var(--fb-red) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--fb-red) 35%, transparent)',
          borderRadius: 12,
          color: 'var(--fb-red)', fontSize: 12.5, fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      <style>{`
        @keyframes scanSweep {
          0%   { top: 18%; opacity: 0; }
          12%  { opacity: 1; }
          50%  { top: 82%; opacity: 1; }
          88%  { opacity: 1; }
          100% { top: 18%; opacity: 0; }
        }
        @keyframes scanPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}

function Bracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const size = 28;
  const thick = 2.5;
  const inset = 18;
  const isTop  = pos[0] === 't';
  const isLeft = pos[1] === 'l';
  const style: CSSProperties = {
    position: 'absolute',
    width: size, height: size,
    pointerEvents: 'none',
    [isTop ? 'top' : 'bottom']: inset,
    [isLeft ? 'left' : 'right']: inset,
    borderColor: 'rgba(255,255,255,0.92)',
    borderStyle: 'solid',
    borderRadius: 4,
    [isTop ? 'borderTopWidth' : 'borderBottomWidth']: thick,
    [isLeft ? 'borderLeftWidth' : 'borderRightWidth']: thick,
    [isTop ? 'borderBottomWidth' : 'borderTopWidth']: 0,
    [isLeft ? 'borderRightWidth' : 'borderLeftWidth']: 0,
    boxShadow: '0 0 10px rgba(0,0,0,0.4)',
  };
  return <span style={style} />;
}
