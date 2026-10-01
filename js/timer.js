// Block timer state is plain data so it survives refresh/close.
// Running: a wall-clock deadline (keeps counting while the tab is closed).
// Paused: the remaining milliseconds, frozen until Resume.
export function startTimer(ms, now = Date.now()) {
  return { status: 'running', deadline: now + ms, remainingMs: ms };
}

export function remaining(t, now = Date.now()) {
  if (t.status === 'paused') return t.remainingMs;
  return Math.max(0, t.deadline - now);
}

export function pause(t, now = Date.now()) {
  if (t.status !== 'running') return t;
  return { status: 'paused', deadline: null, remainingMs: remaining(t, now) };
}

export function resume(t, now = Date.now()) {
  if (t.status !== 'paused') return t;
  return { status: 'running', deadline: now + t.remainingMs, remainingMs: t.remainingMs };
}

export function format(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
