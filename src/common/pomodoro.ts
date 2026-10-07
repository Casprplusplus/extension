export interface Pomodoro {
  phase: 'focus' | 'break' | 'long';
  rounds: number;
  durations: { focus: number; break: number; long: number };
  remaining: number;
  endsAt: number | null;
  sound: boolean;
  notifiedEnd: number | null;
}
export function parsePomodoro(value: unknown): Pomodoro {
  const data = (value && typeof value === 'object' ? value : {}) as Partial<Pomodoro>;
  const minute = (n: unknown, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 120
      ? Math.round(n)
      : fallback;
  const durations = {
    focus: minute(data.durations?.focus, 25),
    break: minute(data.durations?.break, 5),
    long: minute(data.durations?.long, 15),
  };
  const phase = data.phase === 'break' || data.phase === 'long' ? data.phase : 'focus';
  return {
    phase,
    durations,
    rounds: Number.isSafeInteger(data.rounds) && data.rounds! >= 0 ? data.rounds! : 0,
    remaining:
      typeof data.remaining === 'number' && Number.isFinite(data.remaining)
        ? Math.max(0, Math.min(7200, data.remaining))
        : durations[phase] * 60,
    endsAt:
      typeof data.endsAt === 'number' && Number.isFinite(data.endsAt) && data.endsAt > 0
        ? data.endsAt
        : null,
    sound: data.sound === true,
    notifiedEnd:
      typeof data.notifiedEnd === 'number' && Number.isFinite(data.notifiedEnd)
        ? data.notifiedEnd
        : null,
  };
}
export function pomodoroShouldRing(state: Pomodoro, now: number): boolean {
  return (
    state.sound &&
    state.endsAt !== null &&
    state.notifiedEnd !== state.endsAt &&
    now >= state.endsAt &&
    now - state.endsAt <= 60000
  );
}
export function pomodoroSeconds(state: Pomodoro, now: number): number {
  return state.endsAt === null
    ? state.remaining
    : Math.max(0, Math.ceil((state.endsAt - now) / 1000));
}
export function nextPomodoro(state: Pomodoro): Pomodoro {
  const rounds = state.rounds + (state.phase === 'focus' ? 1 : 0);
  const phase = state.phase !== 'focus' ? 'focus' : rounds % 4 === 0 ? 'long' : 'break';
  return {
    ...state,
    rounds,
    phase,
    endsAt: null,
    remaining: state.durations[phase] * 60,
  };
}
