import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useT } from '../../i18n/useT';
import { useNavigate } from '../../hooks/useNavigate';
import { cardOuter, eyebrow } from '../../lib/fbUI';
import type { Task, TaskCompletionRate } from '../../types';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const PRIORITY_COLORS = ['#6b7280', '#f59e0b', '#ef4444'] as const;

function CompletionRing({ done, total, size = 40 }: { done: number; total: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const offset = circ * (1 - pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fb-border)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="var(--fb-accent)"
        strokeWidth={5}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset .4s cubic-bezier(0.16,1,0.3,1)' }}
      />
    </svg>
  );
}

export default function TasksCard() {
  const { t } = useT();
  const { navigate } = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rate, setRate] = useState<TaskCompletionRate>({ total: 0, done: 0, rate: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const d = todayStr();
    Promise.all([
      api.tasks.get(d),
      api.tasks.completionRate(d),
    ])
      .then(([rows, r]) => {
        setTasks(rows as Task[]);
        setRate(r as TaskCompletionRate);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleToggle(id: number) {
    try {
      await api.tasks.toggle(id);
      const d = todayStr();
      const [rows, r] = await Promise.all([
        api.tasks.get(d),
        api.tasks.completionRate(d),
      ]);
      setTasks(rows as Task[]);
      setRate(r as TaskCompletionRate);
    } catch { /* silent */ }
  }

  const top3 = tasks.slice(0, 3);

  return (
    <div style={cardOuter}>
      {/* Header */}
      <div style={eyebrow}>{t('tasks.eyebrow')}</div>

      {/* Ring + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <CompletionRing done={rate.done} total={rate.total} size={40} />
        <div>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: loaded ? 'var(--fb-text)' : 'var(--fb-text-3)', lineHeight: 1 }}>
            {loaded ? `${rate.done}` : '…'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--fb-text-3)' }}>/{rate.total} {t('tasks.completion')}</span>
        </div>
      </div>

      {/* Top 3 tasks */}
      {top3.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {top3.map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <input
                type="checkbox"
                checked={task.done === 1}
                onChange={() => handleToggle(task.id)}
                style={{ width: 13, height: 13, cursor: 'pointer', flexShrink: 0, accentColor: 'var(--fb-accent)' }}
              />
              <span
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[0],
                  flexShrink: 0,
                }}
              />
              <span style={{
                fontSize: 12,
                color: task.done === 1 ? 'var(--fb-text-3)' : 'var(--fb-text)',
                textDecoration: task.done === 1 ? 'line-through' : 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}>
                {task.title}
              </span>
            </div>
          ))}
        </div>
      ) : loaded ? (
        <div style={{ fontSize: 12, color: 'var(--fb-text-3)', fontStyle: 'italic' }}>
          {t('tasks.empty')}
        </div>
      ) : null}

      {/* Footer CTA */}
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => navigate('tasks')}
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
          Vedi tutti
        </button>
      </div>
    </div>
  );
}
