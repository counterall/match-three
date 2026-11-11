// Round timer rules: pure, with time passed in (`now`, in ms) so tests are deterministic.

/** Every BONUS_EVERY points earns BONUS_SECONDS more on the clock. */
export const BONUS_EVERY = 1000;
export const BONUS_SECONDS = 20;

/** Bonus seconds earned by going from `prevScore` to `nextScore` (one award per thousand crossed). */
export function bonusSeconds(prevScore: number, nextScore: number): number {
  const crossed = Math.floor(nextScore / BONUS_EVERY) - Math.floor(prevScore / BONUS_EVERY);
  return Math.max(0, crossed) * BONUS_SECONDS;
}

/** Formats remaining time as m:ss, rounding up so 0:00 only shows once time is really up. */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * A countdown that starts on demand and can be held (paused) for named reasons,
 * e.g. "settings" and "hidden". It only runs while started and not held.
 */
export class Countdown {
  private left: number; // ms remaining as of `since`
  private since = 0;
  private started = false;
  private readonly holds = new Set<string>();

  constructor(limitMs: number) {
    this.left = limitMs;
  }

  get isStarted(): boolean {
    return this.started;
  }

  private get running(): boolean {
    return this.started && this.holds.size === 0;
  }

  /** Banks the time elapsed since the last change, so state can change at `now`. */
  private settle(now: number): void {
    this.left = this.remaining(now);
    this.since = now;
  }

  remaining(now: number): number {
    return this.running ? Math.max(0, this.left - (now - this.since)) : this.left;
  }

  expired(now: number): boolean {
    return this.remaining(now) <= 0;
  }

  start(now: number): void {
    if (this.started) return;
    this.settle(now);
    this.started = true;
  }

  hold(reason: string, now: number): void {
    this.settle(now);
    this.holds.add(reason);
  }

  release(reason: string, now: number): void {
    this.settle(now);
    this.holds.delete(reason);
  }

  /** Adds time; does nothing once the countdown has run out. */
  add(ms: number, now: number): void {
    this.settle(now);
    if (this.left > 0) this.left += ms;
  }

  /** Back to a fresh, unstarted countdown of `limitMs`. Holds are kept. */
  reset(limitMs: number): void {
    this.left = limitMs;
    this.started = false;
  }
}
