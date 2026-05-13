let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = W.AudioContext ?? W.webkitAudioContext;
    if (!Ctor) return null;
    try { ctx = new Ctor(); } catch { return null; }
  }
  if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
  return ctx;
}

function beep(freq: number, durMs: number, type: OscillatorType = 'sine', volume = 0.18, delayMs = 0) {
  const c = getCtx(); if (!c) return;
  const start = c.currentTime + delayMs / 1000;
  const dur = durMs / 1000;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(volume, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.start(start);
  o.stop(start + dur + 0.02);
}

export function soundFocusStart() {
  beep(880, 160);
  beep(1175, 220, 'sine', 0.18, 180);
}

export function soundBreakStart() {
  beep(523, 200);
  beep(392, 280, 'sine', 0.16, 220);
}

export function soundSessionEnd() {
  beep(659, 160);
  beep(880, 160, 'sine', 0.2, 180);
  beep(1318, 380, 'sine', 0.22, 360);
}

export function soundTick() {
  beep(660, 80, 'square', 0.08);
}
