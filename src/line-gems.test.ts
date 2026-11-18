// Issue #32: line gems. A run of exactly 4 leaves a line gem of the run's colour
// behind; when it is cleared it fires along the run's direction (row, column or
// diagonal) to both board edges, chaining with bombs both ways.
import { describe, expect, it } from 'vitest';
import {
  BLAST_POINTS,
  BOMB_BONUS,
  BOMB_SPAWN_CHANCE,
  LINE_BONUS,
  LINE_RUN,
  applySpecials,
  beamReach,
  blastScore,
  collapse,
  findRuns,
  planClear,
  type Gem,
  type Grid,
  type LineDir,
  type Pos,
} from './board';

const key = (p: Pos) => `${p.row},${p.col}`;
const keys = (ps: Pos[]) => ps.map(key).sort();

/** A rows x cols board with no runs in any direction (types cycle with a stride of 2). */
function patterned(rows: number, cols: number): Grid {
  let id = 9000;
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c): Gem => ({ id: id++, type: 20 + ((c + 2 * r) % 5) + 5 * (r % 2) })),
  );
}
const DIAG = { diagonal: true };

const line = (row: number, col: number, dir: LineDir, type = 50): Gem => ({ id: 100 + row * 10 + col, type, special: 'line', dir });
const bomb = (type = 51): Gem => ({ id: 777, type, special: 'bomb' });

describe('making line gems (exactly 4 in a run)', () => {
  it('is a run of 4', () => {
    expect(LINE_RUN).toBe(4);
  });

  it('turns the swapped gem of a horizontal 4-run into a row line gem', () => {
    const g = patterned(8, 8);
    for (let c = 1; c <= 4; c++) g[2][c]!.type = 9;
    const plan = planClear(g, findRuns(g), [{ row: 2, col: 3 }, { row: 3, col: 3 }]);
    expect(plan.made).toEqual([{ row: 2, col: 3, special: 'line', dir: 'row' }]);
    expect(keys(plan.cleared)).toEqual(['2,1', '2,2', '2,4']);
    applySpecials(g, plan.made);
    expect(g[2][3]).toMatchObject({ type: 9, special: 'line', dir: 'row' });
  });

  it('uses the gem nearest the middle in a cascade', () => {
    const g = patterned(8, 8);
    for (let c = 1; c <= 4; c++) g[2][c]!.type = 9;
    const made = planClear(g, findRuns(g)).made;
    expect(made).toHaveLength(1);
    expect(['2,2', '2,3']).toContain(key(made[0]));
  });

  it('a vertical 4-run makes a column line gem', () => {
    const g = patterned(8, 6);
    for (let r = 3; r <= 6; r++) g[r][5]!.type = 9;
    const plan = planClear(g, findRuns(g));
    expect(plan.made).toHaveLength(1);
    expect(plan.made[0]).toMatchObject({ col: 5, special: 'line', dir: 'col' });
  });

  it('diagonal 4-runs make diagonal line gems (down-right = diag, up-right = anti)', () => {
    const g = patterned(8, 8);
    for (let i = 0; i < 4; i++) g[1 + i][1 + i]!.type = 9; // ↘
    expect(planClear(g, findRuns(g, DIAG)).made[0]).toMatchObject({ special: 'line', dir: 'diag' });
    const h = patterned(8, 8);
    for (let i = 0; i < 4; i++) h[1 + i][6 - i]!.type = 9; // ↗ (listed top-right to bottom-left)
    expect(planClear(h, findRuns(h, DIAG)).made[0]).toMatchObject({ special: 'line', dir: 'anti' });
  });

  it('runs of 3 make nothing; runs of 5+ still make a bomb, not a line gem', () => {
    const g = patterned(8, 8);
    for (let c = 0; c < 3; c++) g[0][c]!.type = 9;
    expect(planClear(g, findRuns(g)).made).toEqual([]);
    const h = patterned(8, 8);
    for (let c = 0; c < 5; c++) h[0][c]!.type = 9;
    const made = planClear(h, findRuns(h)).made;
    expect(made).toHaveLength(1);
    expect(made[0].special).toBe('bomb');
    expect(made[0].dir).toBeUndefined();
  });

  it('never turns a gem that is already special into the new one; it goes off instead', () => {
    const g = patterned(8, 8);
    for (let c = 1; c <= 4; c++) g[2][c]!.type = 9;
    g[2][3] = { ...line(2, 3, 'col'), type: 9 };
    const plan = planClear(g, findRuns(g), [{ row: 2, col: 3 }, { row: 3, col: 3 }]);
    expect(plan.made).toHaveLength(1);
    expect(key(plan.made[0])).not.toBe('2,3');
    expect(plan.fired.map(key)).toEqual(['2,3']);
  });

  it('never spawns at random on refill', () => {
    const g = patterned(8, 8);
    g[0][0] = null;
    g[0][1] = null;
    for (let i = 0; i < 200; i++) {
      const h = g.map((row) => row.slice());
      const spawns = collapse(h, Math.random, 1);
      expect(spawns.some((s) => s.gem.special === 'line')).toBe(false);
    }
    expect(BOMB_SPAWN_CHANCE).toBeGreaterThan(0);
  });
});

describe('firing', () => {
  /** A 3-run on row `r` cols 0..2 of colour 9 whose middle gem is `mid`. */
  const withRunAround = (g: Grid, r: number, c: number, mid: Gem, vertical = false) => {
    for (let i = -1; i <= 1; i++) {
      const [rr, cc] = vertical ? [r + i, c] : [r, c + i];
      g[rr][cc] = i === 0 ? { ...mid, type: 9 } : { id: 4000 + rr * 10 + cc, type: 9 };
    }
  };

  it('a row line gem clears its whole row, to both edges', () => {
    const g = patterned(8, 8);
    withRunAround(g, 3, 1, line(3, 1, 'row'), true); // vertical 3-run (2..4, col 1), middle fires along row 3
    const plan = planClear(g, findRuns(g));
    expect(plan.fired.map(key)).toEqual(['3,1']);
    for (let c = 0; c < 8; c++) expect(keys(plan.cleared)).toContain(`3,${c}`);
    expect(plan.cleared).toHaveLength(3 + 7);
    expect(keys(plan.blasted)).toEqual(['3,0', '3,2', '3,3', '3,4', '3,5', '3,6', '3,7']);
  });

  it('a column line gem clears its whole column on a 6x8 board', () => {
    const g = patterned(8, 6);
    withRunAround(g, 5, 2, line(5, 2, 'col'));
    const plan = planClear(g, findRuns(g));
    for (let r = 0; r < 8; r++) expect(keys(plan.cleared)).toContain(`${r},2`);
    expect(plan.cleared).toHaveLength(3 + 7);
  });

  it('a diagonal line gem clears both ways along its diagonal, clipped by the board', () => {
    const g = patterned(8, 6);
    withRunAround(g, 2, 2, line(2, 2, 'diag'));
    const plan = planClear(g, findRuns(g));
    const expected = ['0,0', '1,1', '3,3', '4,4', '5,5'];
    for (const k of expected) expect(keys(plan.blasted)).toContain(k);
    expect(plan.blasted).toHaveLength(expected.length);

    const h = patterned(8, 6);
    withRunAround(h, 2, 2, line(2, 2, 'anti'));
    const anti = planClear(h, findRuns(h));
    expect(keys(anti.blasted)).toEqual(['0,4', '1,3', '3,1', '4,0']);
  });

  it('a beam that reaches a bomb sets it off', () => {
    const g = patterned(8, 8);
    withRunAround(g, 3, 1, line(3, 1, 'row'), true);
    g[3][6] = bomb();
    const plan = planClear(g, findRuns(g));
    expect(plan.fired.map(key)).toEqual(['3,1']);
    expect(plan.detonated.map(key)).toEqual(['3,6']);
    expect(keys(plan.cleared)).toContain('2,7');
    expect(keys(plan.cleared)).toContain('4,5');
  });

  it('a blast that reaches a line gem fires it', () => {
    const g = patterned(8, 8);
    withRunAround(g, 0, 1, bomb()); // row 0 cols 0..2, bomb in the middle
    g[1][2] = line(1, 2, 'col');
    const plan = planClear(g, findRuns(g));
    expect(plan.detonated.map(key)).toEqual(['0,1']);
    expect(plan.fired.map(key)).toEqual(['1,2']);
    for (let r = 0; r < 8; r++) expect(keys(plan.cleared)).toContain(`${r},2`);
  });

  it('a beam fires other line gems it reaches, and each cell is cleared once', () => {
    const g = patterned(8, 8);
    withRunAround(g, 3, 1, line(3, 1, 'row'), true);
    g[3][5] = line(3, 5, 'col');
    const plan = planClear(g, findRuns(g));
    expect(plan.fired.map(key)).toEqual(['3,1', '3,5']);
    for (let r = 0; r < 8; r++) expect(keys(plan.cleared)).toContain(`${r},5`);
    expect(new Set(keys(plan.cleared)).size).toBe(plan.cleared.length);
  });

  it('never clears a special made in the same step', () => {
    const g = patterned(8, 8);
    for (let c = 2; c <= 5; c++) g[4][c]!.type = 9; // 4-run on row 4
    g[1][3] = line(1, 3, 'col'); // will be cleared by a vertical 3-run below…
    g[0][3] = { id: 1, type: 50 };
    g[2][3] = { id: 2, type: 50 };
    const plan = planClear(g, findRuns(g), [{ row: 4, col: 3 }, { row: 5, col: 3 }]);
    expect(plan.made.map(key)).toEqual(['4,3']);
    expect(plan.fired.map(key)).toEqual(['1,3']);
    expect(keys(plan.cleared)).not.toContain('4,3');
  });
});

describe('scoring', () => {
  it('+10 per gem a line or blast clears, +30 per line gem, +50 per bomb, times the cascade', () => {
    expect(BLAST_POINTS).toBe(10);
    expect(LINE_BONUS).toBe(30);
    expect(BOMB_BONUS).toBe(50);
    const plan = { made: [], cleared: [], blasted: new Array<Pos>(7), detonated: new Array<Pos>(1), fired: new Array<Pos>(2) };
    expect(blastScore(plan, 1)).toBe(7 * 10 + 50 + 2 * 30);
    expect(blastScore(plan, 3)).toBe((7 * 10 + 50 + 2 * 30) * 3);
  });
});

describe('a swap that makes a 4-run and a 5-run through the moved gem', () => {
  it('gives the moved gem to the bomb', () => {
    const g = patterned(8, 8);
    for (let c = 0; c < 4; c++) g[2][c]!.type = 9; // row 2, cols 0..3
    for (let r = 0; r < 5; r++) g[r][3]!.type = 9; // col 3, rows 0..4 (crosses at 2,3)
    const plan = planClear(g, findRuns(g), [{ row: 2, col: 3 }, { row: 2, col: 4 }]);
    expect(plan.made.find((m) => m.special === 'bomb')).toMatchObject({ row: 2, col: 3 });
    expect(plan.made.find((m) => m.special === 'line')).toMatchObject({ row: 2, dir: 'row' });
  });
});

describe('beamReach (for popping gems as the beam passes)', () => {
  it('measures each cell from the nearest fired line gem, in cell widths', () => {
    const g = patterned(8, 8);
    g[3][1] = line(3, 1, 'row');
    g[5][5] = line(5, 5, 'diag');
    const reach = beamReach(g, [{ row: 3, col: 1 }, { row: 5, col: 5 }]);
    expect(reach.get('3,0')).toBe(1);
    expect(reach.get('3,7')).toBe(6);
    expect(reach.get('7,7')).toBeCloseTo(2 * Math.SQRT2);
    expect(reach.get('3,3')).toBe(2); // on both lines: the nearer one wins (row: 2, diagonal: 2√2)
    expect(reach.has('3,1')).toBe(false);
  });
});

