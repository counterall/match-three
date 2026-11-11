import { describe, expect, it } from 'vitest';
import {
  SIZE,
  collapse,
  createBoard,
  findMove,
  findRuns,
  isAdjacent,
  matchedCells,
  scoreFor,
  shuffle,
  type Grid,
} from './board';

/** Builds a grid from rows of digits; '.' means empty. */
function gridFrom(rows: string[]): Grid {
  let id = 1000;
  return rows.map((line) =>
    [...line].map((ch) => (ch === '.' ? null : { id: id++, type: Number(ch) })),
  );
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

// A stuck 8x8 board pattern with no matches and no moves.
const STUCK = [
  '01230123',
  '45604560',
  '12341234',
  '56015601',
  '23452345',
  '60126012',
  '34563456',
  '01230123',
];

describe('findRuns', () => {
  it('finds horizontal and vertical runs', () => {
    const g = gridFrom(STUCK);
    g[0][0]!.type = 9; g[0][1]!.type = 9; g[0][2]!.type = 9; // row run of 3
    g[1][7]!.type = 8; g[2][7]!.type = 8; g[3][7]!.type = 8; g[4][7]!.type = 8; // col run of 4
    const runs = findRuns(g);
    expect(runs.map((r) => r.length).sort()).toEqual([3, 4]);
  });

  it('dedupes shared cells in L shapes', () => {
    const g = gridFrom(STUCK);
    for (const [r, c] of [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]]) g[r][c]!.type = 9;
    const runs = findRuns(g);
    expect(runs).toHaveLength(2);
    expect(matchedCells(runs)).toHaveLength(5);
  });

  it('finds nothing on a clean board', () => {
    expect(findRuns(gridFrom(STUCK))).toEqual([]);
  });
});

describe('findMove', () => {
  it('returns null when no swap makes a match', () => {
    expect(findMove(gridFrom(STUCK))).toBeNull();
  });

  it('finds a swap that creates a match', () => {
    const g = gridFrom(STUCK);
    g[0][0]!.type = 9; g[0][1]!.type = 9; g[1][2]!.type = 9;
    const move = findMove(g);
    expect(move).not.toBeNull();
    expect(isAdjacent(move![0], move![1])).toBe(true);
  });
});

describe('collapse', () => {
  it('drops gems down and spawns new ones above the board', () => {
    const g = gridFrom(STUCK);
    const survivor = g[0][3]!;
    g[5][3] = null;
    g[6][3] = null;
    const spawns = collapse(g, seeded(1));
    expect(g[2][3]).toBe(survivor);
    expect(spawns).toHaveLength(2);
    expect(spawns.map((s) => [s.pos.row, s.fromRow])).toEqual([[1, -1], [0, -2]]);
    expect(g.flat().every((x) => x !== null)).toBe(true);
  });
});

describe('createBoard / shuffle', () => {
  it('creates full boards with no matches and a valid move', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = createBoard(seeded(seed));
      expect(g).toHaveLength(SIZE);
      expect(g.flat()).toHaveLength(SIZE * SIZE);
      expect(findRuns(g)).toEqual([]);
      expect(findMove(g)).not.toBeNull();
    }
  });

  it('shuffle fixes a stuck board while keeping the same gems', () => {
    const g = gridFrom(STUCK);
    const ids = g.flat().map((x) => x!.id).sort();
    shuffle(g, seeded(7));
    expect(g.flat().map((x) => x!.id).sort()).toEqual(ids);
    expect(findRuns(g)).toEqual([]);
    expect(findMove(g)).not.toBeNull();
  });
});

describe('scoreFor', () => {
  it('rewards long runs and cascades', () => {
    const run3 = [[{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]];
    expect(scoreFor(run3, 1)).toBe(30);
    expect(scoreFor(run3, 2)).toBe(60);
    const run5 = [Array.from({ length: 5 }, (_, i) => ({ row: 0, col: i }))];
    expect(scoreFor(run5, 1)).toBe(50 + 40);
  });
});
