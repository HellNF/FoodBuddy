import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { api } from '../api';
import { useT } from '../i18n/useT';
import type { BarcodeSearchResult } from '../types';

interface FoodNameSearchProps {
  onResult: (result: BarcodeSearchResult) => void;
}

const eyebrow: CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: 1.4,
  textTransform: 'uppercase', color: 'var(--fb-text-3)',
};

const serifItalic: CSSProperties = {
  fontFamily: 'var(--font-serif)', fontStyle: 'italic',
};

export default function FoodNameSearch({ onResult }: FoodNameSearchProps) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BarcodeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setSearched(false); setError(''); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.barcode.search(q);
        setResults(res);
        setSearched(true);
      } catch {
        setError(t('common.searchError'));
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Search field — bezel + serif italic input */}
      <div style={{
        background: 'var(--fb-bg)',
        border: '1px solid var(--fb-border)',
        borderRadius: 18,
        padding: 3,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--fb-card)',
          borderRadius: 15,
          padding: '12px 16px',
        }}>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="var(--fb-text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text" value={query} autoFocus
            onChange={e => setQuery(e.target.value)}
            placeholder="Pasta, latte, yogurt…"
            style={{
              flex: 1, minWidth: 0,
              background: 'transparent', border: 0, outline: 'none',
              color: 'var(--fb-text)',
              fontFamily: 'var(--font-serif)', fontStyle: 'italic',
              fontSize: 18, fontWeight: 400, letterSpacing: -0.3,
              padding: 0,
            }}
          />
          {loading && (
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '1.5px solid var(--fb-border-strong)',
              borderTopColor: 'var(--fb-accent)',
              animation: 'fnsSpin .9s linear infinite',
              flexShrink: 0,
            }} />
          )}
          {query && !loading && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Cancella"
              style={{
                width: 20, height: 20, borderRadius: 99,
                background: 'var(--fb-bg-2)', border: 0,
                color: 'var(--fb-text-3)', fontSize: 11, lineHeight: 1,
                cursor: 'pointer', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          )}
        </div>
      </div>

      {/* Hint state */}
      {!query && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          padding: '24px 12px',
          color: 'var(--fb-text-3)',
        }}>
          <span style={eyebrow}>Open Food Facts</span>
          <span style={{ ...serifItalic, fontSize: 14, color: 'var(--fb-text-2)' }}>
            Inizia a digitare per cercare un prodotto
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'color-mix(in srgb, var(--fb-red) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--fb-red) 35%, transparent)',
          borderRadius: 12,
          color: 'var(--fb-red)', fontSize: 12.5, fontWeight: 500,
        }}>{error}</div>
      )}

      {/* Empty state */}
      {searched && results.length === 0 && !error && !loading && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '24px 12px',
        }}>
          <span style={{ ...serifItalic, fontSize: 16, color: 'var(--fb-text-2)' }}>
            {t('common.noResults')}
          </span>
          <span style={{ fontSize: 12, color: 'var(--fb-text-3)' }}>
            {t('common.tryOtherTerm')}
          </span>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={eyebrow}>{results.length} risultati</span>
            <span style={{ flex: 1, height: 1, background: 'var(--fb-divider)' }} />
          </div>
          <ul style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            maxHeight: 360, overflowY: 'auto',
            margin: 0, padding: 0, listStyle: 'none',
          }} className="hide-scrollbar">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onResult(r)}
                  className="fns-result"
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 10px',
                    background: 'transparent',
                    border: '1px solid transparent',
                    borderRadius: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all .25s cubic-bezier(0.32,0.72,0,1)',
                  }}
                >
                  {/* Image bezel */}
                  <div style={{
                    flexShrink: 0, padding: 2,
                    background: 'var(--fb-bg)',
                    border: '1px solid var(--fb-border)',
                    borderRadius: 12,
                  }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 10,
                      background: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      {r.image_url ? (
                        <img
                          src={r.image_url} alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          onError={e => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            (e.currentTarget.parentElement as HTMLElement).innerHTML = '<span style="font-size:1.5rem">🥫</span>';
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 24 }}>🥫</span>
                      )}
                    </div>
                  </div>

                  {/* Text block */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{
                      fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                      fontSize: 14.5, fontWeight: 400, letterSpacing: -0.2,
                      color: 'var(--fb-text)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {r.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.calories > 0 ? (
                        <>
                          <span className="tnum" style={{
                            fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
                            padding: '2px 8px', borderRadius: 99,
                            background: 'color-mix(in srgb, var(--fb-orange) 14%, transparent)',
                            color: 'var(--fb-orange)',
                          }}>
                            {Math.round(r.calories)} kcal
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--fb-text-3)' }}>per 100g</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 10.5, color: 'var(--fb-text-3)', fontStyle: 'italic' }}>
                          kcal non disponibili
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <span style={{
                    width: 26, height: 26, borderRadius: 99,
                    background: 'var(--fb-bg)',
                    border: '1px solid var(--fb-border)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--fb-text-2)', fontSize: 12, lineHeight: 1,
                    flexShrink: 0,
                    transition: 'transform .3s cubic-bezier(0.32,0.72,0,1), background .3s ease',
                  }} className="fns-chevron">↗</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <style>{`
        @keyframes fnsSpin { to { transform: rotate(360deg); } }
        .fns-result:hover {
          background: var(--fb-bg);
          border-color: var(--fb-border) !important;
        }
        .fns-result:hover .fns-chevron {
          background: var(--fb-accent) !important;
          color: white !important;
          border-color: var(--fb-accent) !important;
          transform: translate(2px, -2px);
        }
        .fns-result:active { transform: scale(0.99); }
      `}</style>
    </div>
  );
}
