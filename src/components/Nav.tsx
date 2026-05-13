import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useNavigate } from '../hooks/useNavigate';
import { useSettings } from '../hooks/useSettings';
import { useT } from '../i18n/useT';
import { useToast } from './Toast';
import { getThisMonday } from '../lib/dateUtil';
import { subscribeFocus, isFocusLocked } from '../lib/focusLock';
import type { PageName, UserLevel } from '../types';
import NotificationBell from './NotificationBell';

// ── Icons ─────────────────────────────────────────────────────────────────────

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

const ICONS: Record<PageName, string> = {
  dashboard:    'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  exercise:     'M6.5 6.5a5 5 0 000 11M17.5 6.5a5 5 0 010 11M3 12h3m12 0h3M6.5 12h11',
  net:          'M12 2v20M2 12h20 M7 7l10 10M17 7L7 17',
  week:         'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  foods:        'M3 2l2 7h14l2-7 M7 9c0 6 2 9 5 13M17 9c0 6-2 9-5 13',
  compare:      'M8 6h13M8 12h8M8 18h5 M3 6h.01M3 12h.01M3 18h.01',
  pantry:       'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8 M10 12h4',
  recipes:      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  history:      'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  weight:       'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  goals:        'M12 2L9 9H2l5.5 4-2 7L12 16l6.5 4-2-7L22 9h-7z',
  supplements:  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7 7-7z',
  measurements: 'M2 12h20 M12 2v20 M4.93 4.93l14.14 14.14 M19.07 4.93L4.93 19.07',
  data:         'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  settings:     'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z',
  notifications: 'M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 003.4 0',
  day:          'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  sleep:        'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  tasks:        'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  habits:       'M3 5a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm9 0a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2V5zm0 9a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2v-3zm-9 0a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3z',
  focus:        'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14v4l3 3',
  journal:      'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
  achievements: 'M12 2L9 9H2l5.5 4-2 7L12 16l6.5 4-2-7L22 9h-7z',
  insights:     'M3 3v18h18 M7 14l3-3 4 4 5-6',
};

// ── Nav item definitions ───────────────────────────────────────────────────────

interface NavItem { page: PageName; labelKey: string; group: string; }

const DEFAULT_ORDER: NavItem[] = [
  { page: 'dashboard',     labelKey: 'nav.today',         group: 'track' },
  { page: 'foods',         labelKey: 'nav.foods',         group: 'track' },
  { page: 'pantry',        labelKey: 'nav.pantry',        group: 'track' },
  { page: 'recipes',       labelKey: 'nav.recipes',       group: 'track' },
  { page: 'week',          labelKey: 'nav.week',          group: 'plan' },
  { page: 'history',       labelKey: 'nav.history',       group: 'plan' },
  { page: 'net',           labelKey: 'nav.net',           group: 'plan' },
  { page: 'compare',       labelKey: 'nav.compare',       group: 'plan' },
  { page: 'supplements',   labelKey: 'nav.supplements',   group: 'health' },
  { page: 'exercise',      labelKey: 'nav.exercise',      group: 'training' },
  { page: 'measurements',  labelKey: 'nav.measurements',  group: 'health' },
  { page: 'weight',        labelKey: 'nav.body',          group: 'health' },
  { page: 'goals',         labelKey: 'nav.goals',         group: 'health' },
  { page: 'sleep',         labelKey: 'nav.sleep',         group: 'lifestyle' },
  { page: 'tasks',         labelKey: 'nav.tasks',         group: 'lifestyle' },
  { page: 'habits',        labelKey: 'nav.habits',        group: 'lifestyle' },
  { page: 'focus',         labelKey: 'nav.focus',         group: 'lifestyle' },
  { page: 'journal',       labelKey: 'nav.journal',       group: 'lifestyle' },
  { page: 'achievements',  labelKey: 'nav.achievements',  group: 'lifestyle' },
  { page: 'insights',      labelKey: 'nav.insights',      group: 'lifestyle' },
  { page: 'notifications', labelKey: 'nav.notifications', group: 'system' },
  { page: 'data',          labelKey: 'nav.data',          group: 'system' },
  { page: 'settings',      labelKey: 'nav.settings',      group: 'system' },
];

const GROUPS = [
  { id: 'track',     labelKey: 'nav.group.track' },
  { id: 'lifestyle', labelKey: 'nav.group.lifestyle' },
  { id: 'training',  labelKey: 'nav.group.training' },
  { id: 'plan',      labelKey: 'nav.group.plan' },
  { id: 'health',    labelKey: 'nav.group.health' },
  { id: 'system',    labelKey: 'nav.group.system' },
];

const STORAGE_KEY = 'nav_order';
const HIDDEN_KEY  = 'nav_hidden';
const UNHIDEABLE: Set<PageName> = new Set(['dashboard', 'settings']);

function loadOrder(): NavItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_ORDER;
    const pages: PageName[] = JSON.parse(saved);
    const known = new Set(pages);
    const merged = pages.map(p => DEFAULT_ORDER.find(i => i.page === p)).filter(Boolean) as NavItem[];
    const added  = DEFAULT_ORDER.filter(i => !known.has(i.page));
    return [...merged, ...added];
  } catch { return DEFAULT_ORDER; }
}

function saveOrder(items: NavItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(i => i.page)));
}

function loadHidden(): Set<PageName> {
  try {
    const saved = localStorage.getItem(HIDDEN_KEY);
    if (!saved) return new Set();
    const pages: PageName[] = JSON.parse(saved);
    return new Set(pages.filter(p => !UNHIDEABLE.has(p)));
  } catch { return new Set(); }
}

function saveHidden(hidden: Set<PageName>) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
}

// ── Edit affordance: small arrow button ──────────────────────────────────────

function ArrowBtn({ dir, disabled, onClick, label, dataMoveFocus }: {
  dir: 'up' | 'down';
  disabled: boolean;
  onClick: () => void;
  label: string;
  dataMoveFocus?: boolean;
}) {
  const path = dir === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} ${dir === 'up' ? '↑' : '↓'}`}
      title={dir === 'up' ? 'Sposta su' : 'Sposta giù'}
      data-move-focus={dataMoveFocus ? 'true' : undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: 6,
        border: 0, background: 'transparent',
        color: disabled ? 'var(--fb-text-3)' : 'var(--fb-text-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = 'var(--fb-text)'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = 'var(--fb-text-2)'; }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </button>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      {hidden ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-10-8-10-8a18.45 18.45 0 015.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a18.5 18.5 0 01-2.16 3.19" />
          <path d="M9.88 9.88a3 3 0 004.24 4.24" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </>
      ) : (
        <>
          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────

interface NavProps { activePage: PageName; }

export default function Nav({ activePage }: NavProps) {
  const { navigate } = useNavigate();
  const { t } = useT();
  const { settings } = useSettings();

  const { showToast } = useToast();

  const [items, setItems]       = useState<NavItem[]>(loadOrder);
  const [hidden, setHidden]     = useState<Set<PageName>>(loadHidden);
  const [editing, setEditing]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [focusLocked, setFocusLocked] = useState(isFocusLocked());
  const [level, setLevel] = useState<UserLevel | null>(null);

  useEffect(() => subscribeFocus(s => setFocusLocked(s.active && (s.state === 'RUNNING' || s.state === 'PAUSED'))), []);

  useEffect(() => {
    let alive = true;
    function load() {
      api.gamification.getStatus().then(s => { if (alive) setLevel(s); }).catch(() => {});
    }
    load();
    const id = setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const tryNavigate = useCallback((target: PageName, param?: { weekStart?: string }) => {
    if (focusLocked && target !== 'focus') {
      showToast(t('focus.lockedNav'), 'info');
      return;
    }
    if (target === 'week') navigate('week', param ?? { weekStart: getThisMonday() });
    else navigate(target);
  }, [focusLocked, navigate, showToast, t]);

  const editListRef = useRef<HTMLDivElement | null>(null);

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    saveOrder(items);
  }, [items]);

  const hiddenMounted = useRef(false);
  useEffect(() => {
    if (!hiddenMounted.current) { hiddenMounted.current = true; return; }
    saveHidden(hidden);
  }, [hidden]);

  // Esc exits edit mode
  useEffect(() => {
    if (!editing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const toggleHidden = useCallback((page: PageName) => {
    if (UNHIDEABLE.has(page)) return;
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page); else next.add(page);
      return next;
    });
  }, []);

  // Move within same group: swap with previous/next item that shares group.
  // Items can't move across groups (group is a fixed property per page).
  const movePage = useCallback((page: PageName, dir: -1 | 1) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.page === page);
      if (idx < 0) return prev;
      const group = prev[idx].group;
      // Find neighbour in same group walking the flat array
      let neighbour = -1;
      for (let j = idx + dir; j >= 0 && j < prev.length; j += dir) {
        if (prev[j].group === group) { neighbour = j; break; }
      }
      if (neighbour < 0) return prev;
      const next = [...prev];
      [next[idx], next[neighbour]] = [next[neighbour], next[idx]];
      return next;
    });
    requestAnimationFrame(() => {
      editListRef.current
        ?.querySelector<HTMLElement>(`[data-page="${page}"] [data-move-focus]`)
        ?.focus();
    });
  }, []);

  const resetNav = useCallback(() => {
    if (!window.confirm(t('nav.resetConfirm'))) return;
    setItems(DEFAULT_ORDER);
    setHidden(new Set());
    showToast(t('nav.reordered'), 'success');
  }, [t, showToast]);

  const visibleItems = editing
    ? items
    : items.filter(i => {
        if (hidden.has(i.page)) return false;
        if (i.page === 'pantry' && settings.pantry_enabled === 0) return false;
        return true;
      });

  // Group items for rendering — exclude 'health' (shown in profile panel)
  const groupedItems = GROUPS.filter(g => g.id !== 'health').map(g => ({
    ...g,
    items: visibleItems.filter(i => i.group === g.id),
  })).filter(g => g.items.length > 0);

  // Profile panel items (health group, respecting hidden state)
  const profileItems = visibleItems.filter(i => i.group === 'health');

  const calRec = settings.cal_rec || Math.round(((settings.cal_min || 1800) + (settings.cal_max || 2200)) / 2);

  return (
    <nav style={{
      width: 220, flexShrink: 0,
      height: '100%',
      background: 'var(--fb-bg-2)',
      borderRight: '1px solid var(--fb-border)',
      display: 'flex', flexDirection: 'column',
      padding: '18px 12px 24px',
      gap: 18,
      fontFamily: 'var(--font-body)',
      color: 'var(--fb-text)',
    }}>

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--fb-accent) 0%, var(--fb-accent-2) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 13, letterSpacing: -0.3,
            boxShadow: '0 2px 8px rgba(217,119,6,0.25)',
            flexShrink: 0,
          }}>lb</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--fb-text)', letterSpacing: -0.2 }}>
            LifeBuddy
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <NotificationBell />
          <button
            onClick={() => setEditing(v => !v)}
            title={editing ? t('nav.done') : t('nav.reorderHide')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: 5,
              border: editing ? '1px solid var(--fb-accent)' : '1px solid var(--fb-border-strong)',
              background: editing ? 'var(--fb-accent-soft)' : 'transparent',
              color: editing ? 'var(--fb-accent)' : 'var(--fb-text-3)',
              cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-body)',
            }}
          >
            {editing ? '✓' : <span style={{ display: 'inline-block', transform: 'scaleX(-1) rotate(15deg)', fontSize: 10 }}>✎</span>}
          </button>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}
           className="hide-scrollbar">

        {editing ? (
          // Edit mode — same grouped layout as normal, with ↑↓ + eye affordances per row
          <div ref={editListRef} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {GROUPS.map(g => {
              const groupItems = items.filter(i => i.group === g.id);
              if (groupItems.length === 0) return null;
              return (
                <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <div style={{
                    fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase',
                    color: 'var(--fb-text-2)', padding: '4px 10px 6px',
                  }}>
                    {t(g.labelKey)}
                  </div>
                  {groupItems.map((item, idxInGroup) => {
                    const { page, labelKey } = item;
                    const isHidden = hidden.has(page);
                    const isFirst  = idxInGroup === 0;
                    const isLast   = idxInGroup === groupItems.length - 1;
                    return (
                      <div
                        key={page}
                        data-page={page}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 6px 6px 10px', borderRadius: 7,
                          color: isHidden ? 'var(--fb-text-3)' : 'var(--fb-text)',
                          fontSize: 13,
                          transition: 'background 140ms var(--ease-out-strong)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--fb-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Icon d={ICONS[page] ?? ICONS.settings} size={15} />
                        <span style={{
                          flex: 1, minWidth: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textDecoration: isHidden ? 'line-through' : 'none',
                          textDecorationColor: 'var(--fb-text-3)',
                        }}>
                          {t(labelKey)}
                        </span>
                        <ArrowBtn
                          dir="up"
                          disabled={isFirst}
                          onClick={() => movePage(page, -1)}
                          label={t('nav.reorderHide')}
                          dataMoveFocus={!isFirst}
                        />
                        <ArrowBtn
                          dir="down"
                          disabled={isLast}
                          onClick={() => movePage(page, 1)}
                          label={t('nav.reorderHide')}
                          dataMoveFocus={isFirst}
                        />
                        {!UNHIDEABLE.has(page) ? (
                          <button
                            type="button"
                            onClick={() => toggleHidden(page)}
                            aria-label={isHidden ? t('nav.showPage') : t('nav.hidePage')}
                            title={isHidden ? t('nav.showPage') : t('nav.hidePage')}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 24, height: 24, borderRadius: 6,
                              border: 0, background: 'transparent',
                              color: isHidden ? 'var(--fb-text-3)' : 'var(--fb-text-2)',
                              cursor: 'pointer',
                            }}
                          >
                            <EyeIcon hidden={isHidden} />
                          </button>
                        ) : (
                          <span style={{ width: 24, flexShrink: 0 }} aria-hidden />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px 0',
              fontSize: 10.5, color: 'var(--fb-text-3)', letterSpacing: 0.3,
              borderTop: '1px solid var(--fb-divider)', marginTop: 4,
            }}>
              <span>{t('nav.hiddenCount').replace('{n}', String(hidden.size))}</span>
              <button
                type="button"
                onClick={resetNav}
                style={{
                  background: 'transparent', border: 0, padding: '2px 4px',
                  color: 'var(--fb-text-2)', fontSize: 10.5, cursor: 'pointer',
                  textDecoration: 'underline', textUnderlineOffset: 2,
                }}
              >
                {t('nav.reset')}
              </button>
            </div>
          </div>
        ) : (
          // Normal mode — grouped list with one-shot stagger on first mount.
          (() => {
            let flatIdx = 0;
            return groupedItems.map(g => (
              <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase',
                  color: 'var(--fb-text-2)', padding: '4px 10px 6px',
                }}>
                  {t(g.labelKey)}
                </div>
                {g.items.map(item => {
                  const isActive = item.page === activePage;
                  const i = flatIdx++;
                  const isLockedItem = focusLocked && item.page !== 'focus';
                  return (
                    <button
                      key={item.page}
                      onClick={() => tryNavigate(item.page)}
                      title={isLockedItem ? t('focus.lockedNav') : undefined}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: isActive ? 'var(--fb-accent-soft)' : 'transparent',
                        color: isActive ? 'var(--fb-accent)' : (isLockedItem ? 'var(--fb-text-3)' : 'var(--fb-text)'),
                        border: 0, borderRadius: 7,
                        padding: '7px 10px',
                        fontSize: 13, fontWeight: isActive ? 600 : 400,
                        fontFamily: 'var(--font-body)',
                        cursor: isLockedItem ? 'not-allowed' : 'pointer',
                        opacity: isLockedItem ? 0.55 : 1,
                        textAlign: 'left', width: '100%',
                        transition: 'background 160ms var(--ease-out-strong), color 160ms var(--ease-out-strong)',
                        animation: 'fb-fade-up 320ms var(--ease-out-strong) both',
                        animationDelay: `${Math.min(i * 22, 280)}ms`,
                      }}
                    >
                      <Icon d={ICONS[item.page] ?? ICONS.settings} size={16} />
                      <span>{t(item.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            ));
          })()
        )}
      </div>

      {/* Profile panel — collapses above the user strip */}
      {!editing && profileOpen && profileItems.length > 0 && (
        <div style={{ borderTop: '1px solid var(--fb-divider)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{
            fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase',
            color: 'var(--fb-text-2)', padding: '0 10px 6px',
          }}>
            {t(GROUPS.find(g => g.id === 'health')?.labelKey ?? '')}
          </div>
          {profileItems.map(item => {
            const isActive = item.page === activePage;
            const isLockedItem = focusLocked && item.page !== 'focus';
            return (
              <button
                key={item.page}
                onClick={() => tryNavigate(item.page)}
                title={isLockedItem ? t('focus.lockedNav') : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: isActive ? 'var(--fb-accent-soft)' : 'transparent',
                  color: isActive ? 'var(--fb-accent)' : 'var(--fb-text)',
                  border: 0, borderRadius: 7, padding: '7px 10px',
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', width: '100%',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
              >
                <Icon d={ICONS[item.page] ?? ICONS.settings} size={16} />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom — level + user strip (click to open/close profile) */}
      <button
        onClick={() => setProfileOpen(v => !v)}
        style={{
          padding: '12px 10px 0', borderTop: '1px solid var(--fb-divider)',
          display: 'flex', flexDirection: 'column', gap: 8,
          background: 'transparent', border: 0, cursor: 'pointer',
          width: '100%', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          {/* Level badge or generic avatar */}
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: level
              ? 'linear-gradient(135deg, var(--fb-accent) 0%, var(--fb-accent-2) 100%)'
              : (profileOpen ? 'var(--fb-accent-soft)' : 'var(--fb-card-2)'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: level ? '0 2px 8px rgba(217,119,6,0.28)' : 'none',
            transition: 'background 160ms var(--ease-out-strong)',
          }}>
            <span style={{
              fontFamily: 'var(--font-serif)', fontStyle: 'italic',
              fontSize: level ? 14 : 11, fontWeight: 700,
              color: level ? '#fff' : (profileOpen ? 'var(--fb-accent)' : 'var(--fb-text-2)'),
              lineHeight: 1,
            }}>
              {level?.level ?? 'U'}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: 'var(--fb-text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              letterSpacing: -0.1,
            }}>
              {level?.level_name ?? 'Utente'}
            </div>
            <div style={{
              fontSize: 10, color: 'var(--fb-text-3)',
              display: 'flex', alignItems: 'center', gap: 6,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {level
                ? <>
                    <span>{level.total_points}{level.next_level_min != null ? `/${level.next_level_min}` : ''} pt</span>
                    {level.today_points > 0 && (
                      <span style={{
                        color: 'var(--fb-accent)', fontWeight: 700,
                        background: 'var(--fb-accent-soft)',
                        padding: '1px 5px', borderRadius: 99, fontSize: 9,
                      }}>+{level.today_points}</span>
                    )}
                  </>
                : (calRec > 0 ? `${calRec} kcal` : '—')
              }
            </div>
          </div>
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              color: 'var(--fb-text-3)', flexShrink: 0,
              transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 240ms var(--ease-out-strong)',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Level progress bar */}
        {level && level.next_level_min != null && level.next_level_min > 0 && (
          <div style={{
            height: 3, width: '100%', borderRadius: 99,
            background: 'var(--fb-border)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.round(((level.total_points ?? 0) / level.next_level_min) * 100))}%`,
              borderRadius: 99,
              background: 'linear-gradient(90deg, var(--fb-accent) 0%, var(--fb-accent-2) 100%)',
              transition: 'width 600ms cubic-bezier(0.23,1,0.32,1)',
            }} />
          </div>
        )}
      </button>
    </nav>
  );
}
