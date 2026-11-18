import { describe, expect, it } from 'vitest';
import { LEGACY_BEST_KEY, bestKey, loadBest, parseBest, saveBest, type BestStore } from './best';
import { TIME_LIMITS } from './settings';
import mainSrc from './main.ts?raw';

function memoryStore(initial: Record<string, string> = {}): BestStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const throwing = (): BestStore => {
  throw new Error('storage blocked');
};

describe('best score per time limit (issue #22)', () => {
  it('uses a distinct storage key for every time limit', () => {
    const keys = TIME_LIMITS.map((t) => bestKey(t.minutes));
    expect(new Set(keys).size).toBe(TIME_LIMITS.length);
    for (const k of keys) expect(k).not.toBe(LEGACY_BEST_KEY);
  });

  it('a best set in a 10-minute game is not the best for a 3-minute game', () => {
    const store = memoryStore();
    saveBest(() => store, 10, 52_000);
    expect(loadBest(() => store, 10)).toBe(52_000);
    expect(loadBest(() => store, 3)).toBe(0);
    expect(loadBest(() => store, 5)).toBe(0);
  });

  it('keeps each limit’s best separately', () => {
    const store = memoryStore();
    saveBest(() => store, 3, 1_200);
    saveBest(() => store, 5, 3_400);
    saveBest(() => store, 10, 9_900);
    expect(TIME_LIMITS.map((t) => loadBest(() => store, t.minutes))).toEqual([1_200, 3_400, 9_900]);
  });

  it('does not carry the old shared best over to any limit, and leaves it in place', () => {
    const store = memoryStore({ [LEGACY_BEST_KEY]: '77777' });
    for (const t of TIME_LIMITS) expect(loadBest(() => store, t.minutes)).toBe(0);
    saveBest(() => store, 3, 10);
    expect(store.data[LEGACY_BEST_KEY]).toBe('77777');
  });

  it('treats missing or invalid saved values as 0', () => {
    expect(parseBest(null)).toBe(0);
    expect(parseBest('')).toBe(0);
    expect(parseBest('abc')).toBe(0);
    expect(parseBest('-5')).toBe(0);
    expect(parseBest('Infinity')).toBe(0);
    expect(parseBest('12.7')).toBe(12);
    expect(parseBest('4200')).toBe(4200);
  });

  it('survives unavailable storage', () => {
    expect(loadBest(throwing, 3)).toBe(0);
    expect(() => saveBest(throwing, 3, 100)).not.toThrow();
  });

  it('main.ts reads and writes the best through best.ts, not the old shared key', () => {
    expect(mainSrc).toMatch(/from '\.\/best'/);
    expect(mainSrc).not.toContain("'neon-cascade:best'");
  });

  /** Body of the `name(…) { … }` function or method declared in main.ts, up to its closing brace at that indent. */
  function body(name: string): string {
    const m = mainSrc.match(new RegExp(`\\n( *)(?:function )?${name}\\([^)]*\\)[^{;\\n]*\\{([\\s\\S]*?)\\n\\1\\}`));
    if (!m) throw new Error(`no ${name} in main.ts`);
    return m[2];
  }

  it('saves to the best of the limit the round started with, not the current setting', () => {
    expect(body('setScore')).toMatch(/saveBest\(storage, roundLimit, best, roundDiagonal\)/);
  });

  it('switches the best on a new game and on a limit change before the first move', () => {
    expect(body('newGame')).toContain('setRoundLimit(settings.timeLimit, settings.diagonal)');
    expect(body('onTimeLimitChange')).toContain('setRoundLimit(minutes)');
  });
});
