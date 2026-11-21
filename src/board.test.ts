import { describe, expect, it } from 'vitest';
import {
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
      const g = createBoard(8, 8, seeded(seed));
      expect(g).toHaveLength(8);
      expect(g.flat()).toHaveLength(64);
      expect(findRuns(g)).toEqual([]);
      expect(findMove(g)).not.toBeNull();
    }
  });

  it('supports non-square boards (6 columns x 8 rows)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = createBoard(8, 6, seeded(seed));
      expect(g).toHaveLength(8);
      expect(g.every((row) => row.length === 6)).toBe(true);
      expect(findRuns(g)).toEqual([]);
      expect(findMove(g)).not.toBeNull();
    }
  });

  it('collapses and shuffles non-square boards in bounds', () => {
    const g = createBoard(8, 6, seeded(3));
    g[7][5] = null;
    g[0][0] = null;
    const spawns = collapse(g, seeded(4));
    expect(spawns).toHaveLength(2);
    expect(g.flat().every((x) => x !== null)).toBe(true);
    shuffle(g, seeded(5));
    expect(g).toHaveLength(8);
    expect(g.every((row) => row.length === 6)).toBe(true);
    expect(findMove(g)).not.toBeNull();
  });

  it('finds runs at the right and bottom edges of a non-square board', () => {
    const g = gridFrom(['012345', '123450', '234501', '345012']);
    g[0][3]!.type = 9; g[0][4]!.type = 9; g[0][5]!.type = 9;
    g[1][5]!.type = 8; g[2][5]!.type = 8; g[3][5]!.type = 8;
    expect(findRuns(g).map((r) => r.length)).toEqual([3, 3]);
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

describe('shuffle fallback (issue #38)', () => {
  it('reports false and installs a brand-new board when it cannot rearrange', () => {
    const grid = createBoard(6, 6, seeded(3));
    const oldIds = new Set(grid.flat().map((g) => g!.id));
    // No attempts allowed: forces the fallback.
    expect(shuffle(grid, seeded(4), {}, 0)).toBe(false);
    expect(grid.flat().every((g) => g && !oldIds.has(g.id))).toBe(true);
    expect(findRuns(grid)).toEqual([]);
    expect(findMove(grid)).not.toBeNull();
  });

  it('reports true and keeps the very same gems when it can rearrange', () => {
    const grid = gridFrom(STUCK);
    const ids = grid.flat().map((g) => g!.id).sort();
    expect(shuffle(grid, seeded(5))).toBe(true);
    expect(grid.flat().map((g) => g!.id).sort()).toEqual(ids);
  });
});

describe('collapse with several empty cells per column (issue #38)', () => {
  it('drops survivors in order and refills every gap from above', () => {
    const grid = gridFrom(['0123', '4567', '1234', '5670']);
    const survivors = [grid[3][0]!, grid[0][0]!]; // column 0 keeps rows 0 and 3
    grid[1][0] = grid[2][0] = null;
    const spawns = collapse(grid, seeded(1));
    expect(grid[3][0]).toBe(survivors[0]);
    expect(grid[2][0]).toBe(survivors[1]);
    const col0 = spawns.filter((s) => s.pos.col === 0);
    expect(col0.map((s) => s.pos.row).sort((a, b) => a - b)).toEqual([0, 1]);
    expect(col0.every((s) => s.fromRow === s.pos.row - 2)).toBe(true);
    expect(grid.flat().every((g) => g !== null)).toBe(true);
  });

  it('refills a fully emptied column', () => {
    const grid = gridFrom(['00', '11', '22']);
    for (const row of grid) row[1] = null;
    const spawns = collapse(grid, seeded(2));
    expect(spawns).toHaveLength(3);
    expect(spawns.map((s) => s.fromRow).sort((a, b) => a - b)).toEqual([-3, -2, -1]);
  });
});

describe('findMove equals the full-board check (issue #38)', () => {
  function oldFindMove(grid: Grid, opts: { diagonal?: boolean }) {
    const rows = grid.length;
    const cols = grid[0].length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = { row: r, col: c };
        for (const b of [{ row: r, col: c + 1 }, { row: r + 1, col: c }]) {
          if (b.row >= rows || b.col >= cols) continue;
          const t = grid[a.row][a.col];
          grid[a.row][a.col] = grid[b.row][b.col];
          grid[b.row][b.col] = t;
          const ok = findRuns(grid, opts).length > 0;
          const u = grid[a.row][a.col];
          grid[a.row][a.col] = grid[b.row][b.col];
          grid[b.row][b.col] = u;
          if (ok) return [a, b];
        }
      }
    }
    return null;
  }

  it('returns the identical move on random run-free boards, with and without diagonals', () => {
    const rng = seeded(99);
    let compared = 0;
    for (let i = 0; i < 400; i++) {
      const rows = 3 + Math.floor(rng() * 6);
      const cols = 3 + Math.floor(rng() * 6);
      const types = 2 + Math.floor(rng() * 5);
      let id = 1;
      const grid: Grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({ id: id++, type: Math.floor(rng() * types) })),
      );
      for (const diagonal of [false, true]) {
        if (findRuns(grid, { diagonal }).length > 0) continue; // findMove is for settled boards
        compared++;
        expect(findMove(grid, { diagonal })).toEqual(oldFindMove(grid, { diagonal }));
      }
    }
    expect(compared).toBeGreaterThan(100);
  });
});
