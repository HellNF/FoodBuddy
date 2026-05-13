export interface FocusSnapshot {
  active: boolean;
  mode: 'pomodoro' | 'session';
  state: 'IDLE' | 'RUNNING' | 'PAUSED';
  phase: 'focus' | 'break';
  remainSec: number;
  totalSec: number;
  project?: string;
}

const initial: FocusSnapshot = {
  active: false, mode: 'pomodoro', state: 'IDLE',
  phase: 'focus', remainSec: 0, totalSec: 0,
};

let current: FocusSnapshot = initial;
const listeners = new Set<(s: FocusSnapshot) => void>();

function pushToMain(s: FocusSnapshot) {
  try {
    const api = (window as unknown as { electronAPI?: { invoke: (c: string, ...a: unknown[]) => unknown } }).electronAPI;
    api?.invoke('focus:setLock', s);
  } catch { /* renderer-only */ }
}

export function updateFocus(patch: Partial<FocusSnapshot>) {
  current = { ...current, ...patch };
  listeners.forEach(l => l(current));
  pushToMain(current);
}

export function clearFocus() {
  current = { ...initial };
  listeners.forEach(l => l(current));
  pushToMain(current);
}

export function getFocus(): FocusSnapshot { return current; }

export function subscribeFocus(l: (s: FocusSnapshot) => void): () => void {
  listeners.add(l);
  l(current);
  return () => { listeners.delete(l); };
}

export function isFocusLocked(): boolean {
  return current.active && (current.state === 'RUNNING' || current.state === 'PAUSED');
}
