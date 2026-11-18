// Issue #28: bomb gems. A run of 5+ leaves a bomb of the run's colour behind; a
// cleared bomb blasts the 3x3 around it and sets off any bomb the blast reaches.
import { describe, expect, it } from 'vitest';
import {
  BOMB_SPAWN_CHANCE,
  applyBombs,
  blastScore,
  clearCells,
  collapse,
  findMove,
  findRuns,
  planClear,
  shuffle,
  type Grid,
  type Pos,
} from './board';

/** Rows of digits; a letter a–g is a bomb of type 0–6. */
function gridFrom(rows: string[]): Grid {
  let id = 5000;
  return rows.map((line) =>
    [...line].map((ch) => {
      const bomb = ch >= 'a' && ch <= 'g';
      const type = bomb ? ch.charCodeAt(0) - 97 : Number(ch);
      return bomb ? { id: id++, type, special: 'bomb' as const } : { id: id++, type };
    }),
  );
}

const key = (p: Pos) => `${p.row},${p.col}`;
const keys = (ps: Pos[]) => ps.map(key).sort();

// No runs anywhere: rows/cols of a 5-type latin-ish pattern.
const BASE = [
  '0123456',
  '4560123',
  '1234560',
  '5601234',
  '2345601',
  '6012345',
];

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('making bombs (5+ in a run)', () => {
  it('turns the swapped gem of a 5-run into a bomb and keeps it on the board', () => {
    const g = gridFrom(['3333345', ...BASE.slice(1)]);
    const plan = planClear(g, findRuns(g), [{ row: 0, col: 1 }, { row: 1, col: 1 }]);
    expect(keys(plan.made)).toEqual(['0,1']);
    expect(keys(plan.cleared)).toEqual(['0,0', '0,2', '0,3', '0,4']);
    applyBombs(g, plan.made);
    expect(g[0][1]).toMatchObject({ type: 3, special: 'bomb' });
  });

  it('uses the middle gem of the run in a cascade (no swap)', () => {
    const g = gridFrom(['3333345', ...BASE.slice(1)]);
    const plan = planClear(g, findRuns(g));
    expect(keys(plan.made)).toEqual(['0,2']);
  });

  it('makes a bomb from a vertical 5-run and from 6+ runs (one per run)', () => {
    const rows = BASE.map((r) => r.split(''));
    for (let r = 0; r < 6; r++) rows[r][6] = '1';
    rows[1][5] = '2'; // keep row 1 free of runs after the column edit
    const g = gridFrom(rows.map((r) => r.join('')));
    const runs = findRuns(g);
    expect(runs).toHaveLength(1);
    const plan = planClear(g, runs);
    expect(plan.made).toHaveLength(1);
    expect(plan.made[0].col).toBe(6);
    expect(plan.cleared).toHaveLength(5);
  });

  it('makes no bomb from runs of 3 or 4', () => {
    const g = gridFrom(['3333456', ...BASE.slice(1)]);
    const plan = planClear(g, findRuns(g), [{ row: 0, col: 0 }, { row: 1, col: 0 }]);
    expect(plan.made).toEqual([]);
    expect(plan.cleared).toHaveLength(4);
  });
});

describe('blasts', () => {
  it('a cleared bomb blasts its 3x3 square', () => {
    // A 3-run on row 2 whose middle gem is a bomb.
    const g = gridFrom(BASE);
    g[2][1] = { id: 1, type: 9 };
    g[2][2] = { id: 2, type: 9, special: 'bomb' };
    g[2][3] = { id: 3, type: 9 };
    const runs = findRuns(g);
    expect(runs).toHaveLength(1);
    const plan = planClear(g, runs);
    expect(keys(plan.detonated)).toEqual(['2,2']);
    expect(keys(plan.cleared)).toEqual(
      keys([
        { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
        { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 },
        { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 },
      ]),
    );
    expect(plan.blasted).toHaveLength(6);
  });

  it('clips the blast at the board corner', () => {
    const g = gridFrom(BASE);
    g[0][0] = { id: 1, type: 9, special: 'bomb' };
    g[0][1] = { id: 2, type: 9 };
    g[0][2] = { id: 3, type: 9 };
    const plan = planClear(g, findRuns(g));
    expect(keys(plan.cleared)).toEqual(keys([
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
      { row: 1, col: 0 }, { row: 1, col: 1 },
    ]));
  });

  it('chains to bombs inside the blast, even far from the match', () => {
    const g = gridFrom(BASE);
    g[0][0] = { id: 1, type: 9, special: 'bomb' };
    g[0][1] = { id: 2, type: 9 };
    g[0][2] = { id: 3, type: 9 };
    g[1][1] = { id: 4, type: 5, special: 'bomb' }; // in the first blast
    g[2][2] = { id: 5, type: 8, special: 'bomb' }; // in the second blast
    const plan = planClear(g, findRuns(g));
    expect(keys(plan.detonated)).toEqual(['0,0', '1,1', '2,2']);
    // The last blast reaches row 3, cols 1–3.
    expect(keys(plan.cleared)).toContain('3,3');
    expect(keys(plan.cleared)).not.toContain('4,3');
    // Every cell is cleared once.
    expect(new Set(keys(plan.cleared)).size).toBe(plan.cleared.length);
  });

  it('never blasts away a bomb made in the same step', () => {
    // A 5-run whose first gem is a bomb: the new bomb (middle) survives the blast.
    const g = gridFrom(['3333345', ...BASE.slice(1)]);
    g[0][1] = { id: 1, type: 3, special: 'bomb' };
    const plan = planClear(g, findRuns(g));
    expect(keys(plan.made)).toEqual(['0,2']);
    expect(keys(plan.cleared)).not.toContain('0,2');
    expect(keys(plan.detonated)).toEqual(['0,1']);
  });

  it('does not turn an existing bomb into the new bomb; it goes off instead', () => {
    const g = gridFrom(['3333345', ...BASE.slice(1)]);
    g[0][1] = { id: 1, type: 3, special: 'bomb' };
    const plan = planClear(g, findRuns(g), [{ row: 0, col: 1 }, { row: 1, col: 1 }]);
    expect(plan.made).toHaveLength(1);
    expect(keys(plan.made)).not.toContain('0,1');
    expect(keys(plan.detonated)).toContain('0,1');
  });
});

describe('a whole step', () => {
  it('keeps the new bomb, clears the rest, and refills the board', () => {
    const g = gridFrom(['3333345', ...BASE.slice(1)]);
    g[1][3] = { id: 1, type: 9, special: 'bomb' };
    g[0][3] = { id: 2, type: 3, special: 'bomb' }; // part of the run: goes off, chains to (1,3)
    const plan = planClear(g, findRuns(g), [{ row: 0, col: 1 }, { row: 1, col: 1 }]);
    const made = g[0][1]!;
    applyBombs(g, plan.made);
    clearCells(g, plan.cleared);
    collapse(g, seq(0.4, 0.6, 0.2), BOMB_SPAWN_CHANCE);
    expect(g.flat().every((x) => x !== null)).toBe(true);
    const fell = g.flatMap((row, r) => row.map((x, c) => (x === made ? { r, c } : null))).find(Boolean);
    expect(fell?.c).toBe(1);
    expect(made.special).toBe('bomb');
    expect(keys(plan.detonated)).toEqual(['0,3', '1,3']);
  });
});

describe('blastScore', () => {
  it('scores 10 per blasted gem plus 50 per bomb, times the cascade', () => {
    const plan = { made: [], cleared: [], blasted: new Array<Pos>(6), detonated: new Array<Pos>(2) };
    expect(blastScore(plan, 1)).toBe(6 * 10 + 2 * 50);
    expect(blastScore(plan, 3)).toBe((6 * 10 + 2 * 50) * 3);
    expect(blastScore({ made: [], cleared: [], blasted: [], detonated: [] }, 2)).toBe(0);
  });
});

describe('random bombs on refill', () => {
  const holes = () => {
    const g = gridFrom(BASE);
    g[0][0] = null; g[1][0] = null; g[0][3] = null;
    return g;
  };

  it('is about 1 in 12 refills', () => {
    expect(BOMB_SPAWN_CHANCE).toBeCloseTo(1 / 12);
  });

  it('spawns at most one bomb per refill when the roll succeeds', () => {
    const g = holes();
    // gem types (3 spawns), then the bomb roll (hit), then which spawn.
    const spawns = collapse(g, seq(0.1, 0.2, 0.3, 0.01, 0.5), BOMB_SPAWN_CHANCE);
    expect(spawns.filter((s) => s.gem.special === 'bomb')).toHaveLength(1);
  });

  it('spawns none when the roll misses, and none by default', () => {
    expect(collapse(holes(), seq(0.1, 0.2, 0.3, 0.5), BOMB_SPAWN_CHANCE).some((s) => s.gem.special)).toBe(false);
    expect(collapse(holes(), seq(0.1, 0.2, 0.3, 0.01)).some((s) => s.gem.special)).toBe(false);
  });

  it('keeps the bomb index in range for rolls near 1', () => {
    const spawns = collapse(holes(), seq(0.1, 0.2, 0.3, 0, 0.999999999), 1);
    expect(spawns.filter((s) => s.gem.special === 'bomb')).toHaveLength(1);
  });

  it('spawns nothing on a full board', () => {
    expect(collapse(gridFrom(BASE), seq(0.01), BOMB_SPAWN_CHANCE)).toEqual([]);
  });
});

describe('bombs on the rest of the board', () => {
  it('match by colour in hints', () => {
    const g = gridFrom(BASE);
    for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) g[r][c]!.type = 10 + r * 7 + c;
    // Only move: swap (0,2) down/up to line up bomb, gem, gem of type 9.
    g[0][0] = { id: 1, type: 9, special: 'bomb' };
    g[0][1]!.type = 9;
    g[1][2]!.type = 9;
    const move = findMove(g);
    expect(keys(move ?? [])).toEqual(['0,2', '1,2']);
  });

  it('keep their flag through a shuffle', () => {
    const g = gridFrom(BASE);
    g[2][2] = { id: 77, type: 2, special: 'bomb' };
    shuffle(g, seq(0.3, 0.7, 0.1, 0.9, 0.5));
    const found = g.flat().find((x) => x?.id === 77);
    expect(found?.special).toBe('bomb');
  });
});
