import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useT } from '../../i18n/useT';
import { useNavigate } from '../../hooks/useNavigate';
import { cardOuter, eyebrow } from '../../lib/fbUI';
import type { Task, TaskCompletionRate, WidgetSize } from '../../types';

function todayStr(): string { return new Date().toISOString().slice(0, 10); }
const PRIORITY_COLORS = ['#6b7280', '#f59e0b', '#ef4444'] as const;

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

function TaskRow({ task, onToggle, size = 'M' }: { task: Task; onToggle: (id: number) => void; size?: 'S'|'M'|'L' }) {
  const fontSize = size === 'S' ? 10.5 : size === 'M' ? 12 : 12.5;
  const dotSize = size === 'S' ? 5 : 6;
  const checkSize = size === 'S' ? 12 : 14;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        style={{
          width: checkSize, height: checkSize, borderRadius: 4,
          border: `1.5px solid ${task.done ? 'var(--fb-accent)' : 'var(--fb-border-strong, var(--fb-border))'}`,
          background: task.done ? 'var(--fb-accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: checkSize - 4, flexShrink: 0,
          cursor: 'pointer', padding: 0,
        }}
      >{task.done ? '✓' : ''}</button>
      <span style={{ width: dotSize, height: dotSize, borderRadius: 99, background: PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[0], flexShrink: 0 }} />
      <span style={{
        flex: 1, fontSize,
        color: task.done ? 'var(--fb-text-3)' : 'var(--fb-text)',
        textDecoration: task.done ? 'line-through' : 'none',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{task.title}</span>
    </div>
  );
}

export default function TasksCard({ size = 'M' }: { size?: WidgetSize }) {
  const { t } = useT();
  const { navigate } = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rate, setRate] = useState<TaskCompletionRate>({ total: 0, done: 0, rate: 0 });
  const [weekData, setWeekData] = useState<number[]>(Array(7).fill(0));

  useEffect(() => {
    const d = todayStr();
    Promise.all([api.tasks.get(d), api.tasks.completionRate(d)])
      .then(([rows, r]) => {
        setTasks(rows as Task[]);
        setRate(r as TaskCompletionRate);
      })
      .catch(() => {});
    if (size === 'L' || size === 'M') {
      // 7-day completion
      Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const dt = new Date(); dt.setDate(dt.getDate() - (6 - i));
          return api.tasks.completionRate(dt.toISOString().slice(0, 10)).catch(() => ({ rate: 0, done: 0, total: 0 }));
        })
      ).then(rows => setWeekData(rows.map(r => (r as TaskCompletionRate).rate * 100)));
    }
  }, [size]);

  async function handleToggle(id: number) {
    try {
      await api.tasks.toggle(id);
      const d = todayStr();
      const [rows, r] = await Promise.all([api.tasks.get(d), api.tasks.completionRate(d)]);
      setTasks(rows as Task[]);
      setRate(r as TaskCompletionRate);
    } catch { /* silent */ }
  }

  const pct = rate.total > 0 ? (rate.done / rate.total) * 100 : 0;
  const todo = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  const priorityCount = [0, 0, 0]; tasks.forEach(t => { priorityCount[t.priority]++; });

  // ── XS (158×152) ──────────────────────────────────────────────────────────
  if (size === 'XS') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...eyebrow, fontSize: 8.5 }}>{t('tasks.eyebrow')}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, color: 'var(--fb-accent)',
            background: 'var(--fb-accent-soft)', padding: '2px 6px', borderRadius: 99,
            fontFamily: 'var(--font-display)', letterSpacing: 0.3,
          }}>{rate.done}/{rate.total}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden', marginTop: 6 }}>
          {tasks.slice(0, 3).map(t => <TaskRow key={t.id} task={t} onToggle={handleToggle} size="S" />)}
        </div>
      </div>
    );
  }

  // ── S (318×152) ───────────────────────────────────────────────────────────
  if (size === 'S') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={eyebrow}>{t('tasks.eyebrow')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18, color: 'var(--fb-accent)' }}>{rate.done}</span>
            <span style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>/ {rate.total} · {Math.round(pct)}%</span>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden', marginTop: 8 }}>
          {tasks.slice(0, 4).map(t => <TaskRow key={t.id} task={t} onToggle={handleToggle} size="S" />)}
        </div>
      </div>
    );
  }

  // ── M (484×318) ───────────────────────────────────────────────────────────
  if (size === 'M') {
    return (
      <div style={{ ...cardOuter, height: '100%', padding: 18, display: 'grid', gridTemplateColumns: '1fr 130px', gap: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Ring size={70} pct={pct} color="var(--fb-accent)" />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 20, color: 'var(--fb-accent)' }}>{rate.done}</span>
                <span style={{ fontSize: 8, color: 'var(--fb-text-3)', marginTop: -2 }}>/ {rate.total}</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={eyebrow}>{t('tasks.eyebrow')}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 26 }}>{Math.round(pct)}%</span>
                <span style={{ fontSize: 11, color: 'var(--fb-text-3)' }}>{t('tasks.completion')}</span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid var(--fb-divider)', overflow: 'hidden' }}>
            {tasks.slice(0, 5).map(t => <TaskRow key={t.id} task={t} onToggle={handleToggle} size="M" />)}
            {tasks.length === 0 && <span style={{ fontSize: 12, color: 'var(--fb-text-3)', fontStyle: 'italic' }}>{t('tasks.empty')}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 14, borderLeft: '1px solid var(--fb-divider)' }}>
          <div style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Priority</div>
          {[
            { l: 'Alta', c: '#ef4444', count: priorityCount[2], max: Math.max(...priorityCount, 1) },
            { l: 'Media', c: '#f59e0b', count: priorityCount[1], max: Math.max(...priorityCount, 1) },
            { l: 'Bassa', c: '#6b7280', count: priorityCount[0], max: Math.max(...priorityCount, 1) },
          ].map(p => (
            <div key={p.l} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: p.c, fontWeight: 600 }}>● {p.l}</span>
                <span className="tnum" style={{ color: 'var(--fb-text-2)' }}>{p.count}</span>
              </div>
              <div style={{ height: 5, background: 'var(--fb-bg-2)', borderRadius: 99 }}>
                <div style={{ height: '100%', width: `${(p.count/p.max)*100}%`, background: p.c, borderRadius: 99 }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--fb-divider)' }}>
            <div style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 4 }}>Week</div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 28 }}>
              {weekData.map((v, i) => (
                <div key={i} style={{ flex: 1, height: `${Math.max(8, v)}%`, background: i === 6 ? 'var(--fb-accent)' : 'color-mix(in srgb, var(--fb-accent) 35%, transparent)', borderRadius: 2 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── L (1024×318) ──────────────────────────────────────────────────────────
  return (
    <div style={{ ...cardOuter, height: '100%', padding: 20, display: 'grid', gridTemplateColumns: '240px 1fr 340px', gap: 22, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
        <span style={eyebrow}>{t('tasks.eyebrow')} · oggi</span>
        <div style={{ position: 'relative' }}>
          <Ring size={170} pct={pct} color="var(--fb-accent)" />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 46, color: 'var(--fb-accent)' }}>{rate.done}</span>
            <span style={{ fontSize: 12, color: 'var(--fb-text-3)' }}>/ {rate.total}</span>
            <span style={{ fontSize: 10, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginTop: 4 }}>{Math.round(pct)}% done</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--fb-text-3)' }}>
            <span>To do</span><span>{todo.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
            {todo.slice(0, 4).map(t => <TaskRow key={t.id} task={t} onToggle={handleToggle} size="M" />)}
            {todo.length === 0 && <span style={{ fontSize: 11, color: 'var(--fb-text-3)', fontStyle: 'italic' }}>nessuna</span>}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid var(--fb-divider)', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--fb-text-3)' }}>
            <span>Done</span><span>{done.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
            {done.slice(0, 4).map(t => <TaskRow key={t.id} task={t} onToggle={handleToggle} size="M" />)}
            {done.length === 0 && <span style={{ fontSize: 11, color: 'var(--fb-text-3)', fontStyle: 'italic' }}>nessuna completata</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 18, borderLeft: '1px solid var(--fb-divider)' }}>
        <div>
          <div style={{ fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 8 }}>Priority breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { l: 'Alta', c: '#ef4444', count: priorityCount[2] },
              { l: 'Media', c: '#f59e0b', count: priorityCount[1] },
              { l: 'Bassa', c: '#6b7280', count: priorityCount[0] },
            ].map(p => {
              const max = Math.max(...priorityCount, 1);
              return (
                <div key={p.l}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: p.c, fontWeight: 600 }}>● {p.l}</span>
                    <span className="tnum" style={{ color: 'var(--fb-text-2)' }}>{p.count}/{tasks.length || 0}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--fb-bg-2)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${(p.count/max)*100}%`, background: p.c, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ paddingTop: 12, borderTop: '1px solid var(--fb-divider)', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--fb-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 6 }}>
            <span>Completion · 7 days</span>
            <span className="tnum">avg {Math.round(weekData.reduce((a,b)=>a+b,0)/Math.max(1, weekData.filter(v=>v>0).length))}%</span>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 5, alignItems: 'flex-end', minHeight: 50 }}>
            {weekData.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${Math.max(5, v)}%`, background: i === 6 ? 'var(--fb-accent)' : 'color-mix(in srgb, var(--fb-accent) 35%, transparent)', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 8.5, color: 'var(--fb-text-3)' }}>{['L','M','M','G','V','S','D'][i]}</span>
              </div>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => navigate('tasks')}
          style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px solid var(--fb-border)', color: 'var(--fb-text-2)', padding: '4px 10px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          {t('tasks.seeAll')}
        </button>
      </div>
    </div>
  );
}
