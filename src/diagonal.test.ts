// Diagonal matches (issue #30): an optional mode where 3+ in a line along either
// diagonal also match. Board rules, the setting, per-mode best and the wiring.
import { describe, expect, it } from 'vitest';
import { createBoard, findMove, findRuns, planClear, shuffle, type Grid, type Pos } from './board';
import { LEGACY_BEST_KEY, bestKey, loadBest, saveBest, type BestStore } from './best';
import { DEFAULT_SETTINGS, TIME_LIMITS, parseSettings } from './settings';
import { MESSAGES } from './i18n';
import html from '../index.html?raw';
import mainSrc from './main.ts?raw';
import settingsUiSrc from './settings-ui.ts?raw';

const DIAG = { diagonal: true };

/** Builds a grid from rows of digits. */
function gridFrom(rows: string[]): Grid {
  let id = 5000;
  return rows.map((line) => [...line].map((ch) => ({ id: id++, type: Number(ch) })));
}

/** A rows x cols board with no runs in any direction: neighbours differ by 1, 3, 4 or 2 (mod 7). */
function patterned(rows: number, cols: number): Grid {
  let id = 9000;
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({ id: id++, type: (c + 3 * r) % 7 })),
  );
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

const at = (cells: Pos[]) => cells.map((p) => `${p.row},${p.col}`);

// (0,0) (1,1) (2,2) share type 1 along the down-right diagonal; nothing else lines up.
const DOWN_RIGHT = ['1234', '3156', '4512', '6623'];
// The same rows mirrored: the run runs down-left from (0,3).
const DOWN_LEFT = DOWN_RIGHT.map((row) => [...row].reverse().join(''));

describe('diagonal runs (issue #30)', () => {
  it('the test boards have no straight runs', () => {
    expect(findRuns(gridFrom(DOWN_RIGHT))).toEqual([]);
    expect(findRuns(gridFrom(DOWN_LEFT))).toEqual([]);
    expect(findRuns(patterned(8, 8), DIAG)).toEqual([]);
  });

  it('finds a down-right diagonal run only when diagonal matches are on', () => {
    expect(findRuns(gridFrom(DOWN_RIGHT), { diagonal: false })).toEqual([]);
    expect(findRuns(gridFrom(DOWN_RIGHT), DIAG).map(at)).toEqual([['0,0', '1,1', '2,2']]);
  });

  it('finds a down-left diagonal run', () => {
    expect(findRuns(gridFrom(DOWN_LEFT), DIAG).map(at)).toEqual([['0,3', '1,2', '2,1']]);
  });

  it('finds runs that touch the board edges, in order along the line', () => {
    const g = patterned(6, 8);
    for (let i = 0; i < 6; i++) g[i][i + 2]!.type = 9; // down-right, from the top edge to the bottom edge
    const runs = findRuns(g, DIAG).filter((run) => run.length === 6);
    expect(runs.map(at)).toEqual([['0,2', '1,3', '2,4', '3,5', '4,6', '5,7']]);
  });

  it('a diagonal 5-run makes a bomb: the swapped gem, else the middle one', () => {
    const g = patterned(7, 7);
    for (let i = 0; i < 5; i++) g[i + 1][5 - i]!.type = 9; // down-left: (1,5) … (5,1)
    const run = findRuns(g, DIAG).find((r) => r.length === 5);
    expect(run && at(run)).toEqual(['1,5', '2,4', '3,3', '4,2', '5,1']);
    expect(at(planClear(g, [run!]).made)).toEqual(['3,3']);
    expect(at(planClear(g, [run!], [{ row: 4, col: 2 }, { row: 4, col: 3 }]).made)).toEqual(['4,2']);
  });

  it('findMove sees a swap that only makes a diagonal match', () => {
    // A board with no moves at all, plus a new colour (9) on (0,0) and (1,1):
    // swapping (2,3) left puts a third 9 on (2,2).
    const g = gridFrom(['01230123', '45604560', '12341234', '56015601', '23452345', '60126012', '34563456', '01230123']);
    for (const [r, c] of [[0, 0], [1, 1], [2, 3]]) g[r][c]!.type = 9;
    expect(findRuns(g, DIAG)).toEqual([]);
    expect(findMove(g)).toBeNull();
    expect(findMove(g, DIAG)).not.toBeNull();
  });

  it('createBoard with diagonal matches on starts with no diagonal runs and a move', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const [rows, cols] of [[8, 8], [8, 6]]) {
        const g = createBoard(rows, cols, seeded(seed), DIAG);
        expect(findRuns(g, DIAG), `seed ${seed}`).toEqual([]);
        expect(findMove(g, DIAG), `seed ${seed}`).not.toBeNull();
      }
    }
  });

  it('shuffle with diagonal matches on leaves no diagonal runs', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = createBoard(8, 8, seeded(seed), DIAG);
      shuffle(g, seeded(seed + 100), DIAG);
      expect(findRuns(g, DIAG)).toEqual([]);
      expect(findMove(g, DIAG)).not.toBeNull();
    }
  });
});

describe('diagonal setting', () => {
  it('is off by default', () => {
    expect(DEFAULT_SETTINGS.diagonal).toBe(false);
    expect(parseSettings(null).diagonal).toBe(false);
  });

  it('keeps a saved on/off value', () => {
    expect(parseSettings('{"diagonal":true}').diagonal).toBe(true);
    expect(parseSettings('{"diagonal":false}').diagonal).toBe(false);
  });

  it('falls back to off for anything that is not a boolean', () => {
    for (const v of ['"on"', '"true"', '1', 'null', '[]', '{}']) {
      expect(parseSettings(`{"diagonal":${v}}`).diagonal, v).toBe(false);
    }
  });

  it('older saved settings (no diagonal field) keep their other values', () => {
    const s = parseSettings('{"theme":"pastel","timeLimit":5,"language":"zh-CN","gemStyle":"animals"}');
    expect(s).toEqual({ theme: 'pastel', timeLimit: 5, language: 'zh-CN', gemStyle: 'animals', diagonal: false });
  });
});

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

describe('best score per mode', () => {
  it('normal-mode keys are unchanged; diagonal ones are new and distinct', () => {
    for (const { minutes } of TIME_LIMITS) {
      expect(bestKey(minutes)).toBe(`neon-cascade:best:${minutes}m`);
      expect(bestKey(minutes, false)).toBe(`neon-cascade:best:${minutes}m`);
      expect(bestKey(minutes, true)).toBe(`neon-cascade:best:${minutes}m:diag`);
    }
    const all = TIME_LIMITS.flatMap(({ minutes }) => [bestKey(minutes), bestKey(minutes, true)]);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain(LEGACY_BEST_KEY);
  });

  it('a diagonal best does not touch the normal best for the same limit', () => {
    const store = memoryStore({ 'neon-cascade:best:3m': '1500' });
    expect(loadBest(() => store, 3, true)).toBe(0);
    saveBest(() => store, 3, 9000, true);
    expect(loadBest(() => store, 3, true)).toBe(9000);
    expect(loadBest(() => store, 3)).toBe(1500);
    expect(store.data['neon-cascade:best:3m']).toBe('1500');
  });
});

describe('Settings dialog and HUD markup', () => {
  it('has a Diagonal matches section with its own radio group and note', () => {
    expect(html).toMatch(/<h3 id="diagonal-title" data-i18n="diagonal">Diagonal matches<\/h3>/);
    expect(html).toMatch(/id="diagonal-options"[^>]*role="radiogroup"[^>]*aria-labelledby="diagonal-title"/);
    expect(html).toMatch(/data-i18n="diagonalNote"/);
  });

  it('settings-ui renders Off/On pills with translated labels', () => {
    expect(settingsUiSrc).toContain('#diagonal-options');
    expect(settingsUiSrc).toMatch(/diagonalOff/);
    expect(settingsUiSrc).toMatch(/diagonalOn/);
    expect(settingsUiSrc).toMatch(/onDiagonalChange\?\.\(/);
  });

  // The ⤢ badge next to Best was removed in issue #36 (owner decision); daily-ui.test.ts checks it stays gone.

  it('has every new string in every language', () => {
    for (const key of ['diagonal', 'diagonalOff', 'diagonalOn', 'diagonalNote'] as const) {
      expect(MESSAGES.en[key]).toBeTruthy();
      expect(MESSAGES['zh-CN'][key]).toBeTruthy();
    }
  });
});

describe('main.ts wiring', () => {
  /** Body of the `name(…) { … }` function or method declared in main.ts. */
  function body(name: string): string {
    const m = mainSrc.match(new RegExp(`\\n( *)(?:function )?${name}\\([^)]*\\)[^{;\\n]*\\{([\\s\\S]*?)\\n\\1\\}`));
    if (!m) throw new Error(`no ${name} in main.ts`);
    return m[2];
  }

  it('passes the round’s mode to every board rule that depends on it', () => {
    for (const fn of ['findRuns', 'findMove', 'createBoard', 'shuffle']) {
      const calls = [...mainSrc.matchAll(new RegExp(`\\b${fn}\\(([^\\n]*)`, 'g'))].map((m) => m[1]);
      expect(calls.length, fn).toBeGreaterThan(0);
      for (const args of calls) expect(args, `${fn}(${args})`).toContain('matchOpts()');
    }
  });

  it('a new game takes the mode from the settings; the best follows the round', () => {
    // Free play takes the Settings; a daily (issue #36) overrides them with its twist.
    expect(body('newGame')).toContain('let minutes: TimeLimit = settings.timeLimit;');
    expect(body('newGame')).toContain('let diagonal = settings.diagonal;');
    expect(body('newGame')).toContain('setRoundLimit(minutes, diagonal)');
    expect(body('setRoundBest')).toMatch(/loadBest\(storage, roundLimit, roundDiagonal\)/);
    expect(body('setScore')).toMatch(/saveBest\(storage, roundLimit, best, roundDiagonal\)/);
  });

  it('a mode change applies at once only before the first move', () => {
    expect(body('onDiagonalChange')).toMatch(/if \(mode === 'free' && !clock\.isStarted && !timeUp && !busy\) newGame\('free'\)/);
  });
});
