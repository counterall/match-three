// Pure game logic for the match-3 board. No DOM access here, so it can be unit tested.

export const DEFAULT_ROWS = 8;
export const DEFAULT_COLS = 8;
export const GEM_TYPES = 7;

export interface Gem {
  id: number;
  type: number;
}

export interface Pos {
  row: number;
  col: number;
}

/** grid[row][col]; null only appears transiently between clearing and refilling. */
export type Grid = (Gem | null)[][];

export const rowsOf = (grid: Grid): number => grid.length;
export const colsOf = (grid: Grid): number => grid[0]?.length ?? 0;

export type Rng = () => number;

/** A gem created during refill, with the virtual (negative) row it should fall from. */
export interface Spawn {
  gem: Gem;
  pos: Pos;
  fromRow: number;
}

let nextId = 1;

export function newGem(rng: Rng, type?: number): Gem {
  return { id: nextId++, type: type ?? Math.floor(rng() * GEM_TYPES) };
}

export function isAdjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function swap(grid: Grid, a: Pos, b: Pos): void {
  const tmp = grid[a.row][a.col];
  grid[a.row][a.col] = grid[b.row][b.col];
  grid[b.row][b.col] = tmp;
}

/** Returns every horizontal and vertical run of 3+ same-type gems. */
export function findRuns(grid: Grid): Pos[][] {
  const runs: Pos[][] = [];
  const typeAt = (r: number, c: number) => grid[r][c]?.type ?? -1;
  const rows = rowsOf(grid);
  const cols = colsOf(grid);

  for (let r = 0; r < rows; r++) {
    let start = 0;
    for (let c = 1; c <= cols; c++) {
      if (c < cols && typeAt(r, c) === typeAt(r, start) && typeAt(r, c) !== -1) continue;
      if (c - start >= 3 && typeAt(r, start) !== -1) {
        runs.push(Array.from({ length: c - start }, (_, i) => ({ row: r, col: start + i })));
      }
      start = c;
    }
  }

  for (let c = 0; c < cols; c++) {
    let start = 0;
    for (let r = 1; r <= rows; r++) {
      if (r < rows && typeAt(r, c) === typeAt(start, c) && typeAt(r, c) !== -1) continue;
      if (r - start >= 3 && typeAt(start, c) !== -1) {
        runs.push(Array.from({ length: r - start }, (_, i) => ({ row: start + i, col: c })));
      }
      start = r;
    }
  }

  return runs;
}

/** Unique cells covered by any run (an L or T shape shares a cell between two runs). */
export function matchedCells(runs: Pos[][]): Pos[] {
  const seen = new Map<string, Pos>();
  for (const run of runs) for (const p of run) seen.set(`${p.row},${p.col}`, p);
  return [...seen.values()];
}

/** Points for one clearing step: 10 per gem, +bonus for long runs, times the cascade level. */
export function scoreFor(runs: Pos[][], cascade: number): number {
  let base = matchedCells(runs).length * 10;
  for (const run of runs) if (run.length > 3) base += (run.length - 3) * 20;
  return base * cascade;
}

export function clearCells(grid: Grid, cells: Pos[]): void {
  for (const p of cells) grid[p.row][p.col] = null;
}

/**
 * Drops gems down into empty cells and fills the top of each column with new gems.
 * Returns the newly created gems with the row above the board they start from.
 */
export function collapse(grid: Grid, rng: Rng): Spawn[] {
  const spawns: Spawn[] = [];
  for (let c = 0; c < colsOf(grid); c++) {
    let write = rowsOf(grid) - 1;
    for (let r = write; r >= 0; r--) {
      const gem = grid[r][c];
      if (gem) {
        grid[r][c] = null;
        grid[write][c] = gem;
        write--;
      }
    }
    const missing = write + 1;
    for (let r = write; r >= 0; r--) {
      const gem = newGem(rng);
      grid[r][c] = gem;
      spawns.push({ gem, pos: { row: r, col: c }, fromRow: r - missing });
    }
  }
  return spawns;
}

/** Finds a swap that would create a match, or null when the board is stuck. */
export function findMove(grid: Grid): [Pos, Pos] | null {
  const rows = rowsOf(grid);
  const cols = colsOf(grid);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = { row: r, col: c };
      for (const b of [{ row: r, col: c + 1 }, { row: r + 1, col: c }]) {
        if (b.row >= rows || b.col >= cols) continue;
        swap(grid, a, b);
        const ok = findRuns(grid).length > 0;
        swap(grid, a, b);
        if (ok) return [a, b];
      }
    }
  }
  return null;
}

/** A fresh rows x cols board with no ready-made matches and at least one valid move. */
export function createBoard(
  rows = DEFAULT_ROWS,
  cols = DEFAULT_COLS,
  rng: Rng = Math.random,
): Grid {
  for (;;) {
    const grid: Grid = [];
    for (let r = 0; r < rows; r++) {
      const row: (Gem | null)[] = [];
      grid.push(row);
      for (let c = 0; c < cols; c++) {
        let type: number;
        do {
          type = Math.floor(rng() * GEM_TYPES);
        } while (
          (c >= 2 && row[c - 1]!.type === type && row[c - 2]!.type === type) ||
          (r >= 2 && grid[r - 1][c]!.type === type && grid[r - 2][c]!.type === type)
        );
        row.push(newGem(rng, type));
      }
    }
    if (findMove(grid)) return grid;
  }
}

/** Rearranges the existing gems until there are no matches and at least one move. */
export function shuffle(grid: Grid, rng: Rng = Math.random): void {
  const rows = rowsOf(grid);
  const cols = colsOf(grid);
  const gems = grid.flat().filter((g): g is Gem => g !== null);
  for (let attempt = 0; attempt < 1000; attempt++) {
    for (let i = gems.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [gems[i], gems[j]] = [gems[j], gems[i]];
    }
    for (let i = 0; i < gems.length; i++) grid[Math.floor(i / cols)][i % cols] = gems[i];
    if (findRuns(grid).length === 0 && findMove(grid)) return;
  }
  // Extremely unlikely with 7 types; fall back to a brand-new board.
  const fresh = createBoard(rows, cols, rng);
  for (let r = 0; r < rows; r++) grid[r] = fresh[r];
}
