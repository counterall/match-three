// Pure game logic for the match-3 board. No DOM access here, so it can be unit tested.

export const DEFAULT_ROWS = 8;
export const DEFAULT_COLS = 8;
export const GEM_TYPES = 7;

/** Special gems (issue #28). A bomb still has a colour (type) and matches by it. */
export type Special = 'bomb';

export interface Gem {
  id: number;
  type: number;
  special?: Special;
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

/** Rule options for matching. `diagonal` (issue #30): lines along either diagonal match too. */
export interface MatchOptions {
  diagonal?: boolean;
}

/** Line directions that can make a run: [dRow, dCol]. */
const STRAIGHT: readonly [number, number][] = [
  [0, 1],
  [1, 0],
];
const DIAGONALS: readonly [number, number][] = [
  [1, 1],
  [1, -1],
];

/**
 * Returns every run of 3+ same-type gems: horizontal and vertical, plus both
 * diagonals when `opts.diagonal` is on. Each run lists its cells in order along the line.
 */
export function findRuns(grid: Grid, opts: MatchOptions = {}): Pos[][] {
  const runs: Pos[][] = [];
  const rows = rowsOf(grid);
  const cols = colsOf(grid);
  const typeAt = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols ? (grid[r][c]?.type ?? -1) : -1;

  for (const [dr, dc] of opts.diagonal ? [...STRAIGHT, ...DIAGONALS] : STRAIGHT) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type = typeAt(r, c);
        // Start only at the first cell of a line of this type.
        if (type === -1 || typeAt(r - dr, c - dc) === type) continue;
        let len = 1;
        while (typeAt(r + dr * len, c + dc * len) === type) len++;
        if (len >= 3) runs.push(Array.from({ length: len }, (_, i) => ({ row: r + dr * i, col: c + dc * i })));
      }
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
export function collapse(grid: Grid, rng: Rng, bombChance = 0): Spawn[] {
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
  // At most one bomb per refill (issue #28). No extra rng calls when bombs are off.
  if (bombChance > 0 && spawns.length > 0 && rng() < bombChance) {
    spawns[Math.min(spawns.length - 1, Math.floor(rng() * spawns.length))].gem.special = 'bomb';
  }
  return spawns;
}

/** Finds a swap that would create a match, or null when the board is stuck. */
export function findMove(grid: Grid, opts: MatchOptions = {}): [Pos, Pos] | null {
  const rows = rowsOf(grid);
  const cols = colsOf(grid);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = { row: r, col: c };
      for (const b of [{ row: r, col: c + 1 }, { row: r + 1, col: c }]) {
        if (b.row >= rows || b.col >= cols) continue;
        swap(grid, a, b);
        const ok = findRuns(grid, opts).length > 0;
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
  opts: MatchOptions = {},
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
          (r >= 2 && grid[r - 1][c]!.type === type && grid[r - 2][c]!.type === type) ||
          (!!opts.diagonal &&
            r >= 2 &&
            ((c >= 2 && grid[r - 1][c - 1]!.type === type && grid[r - 2][c - 2]!.type === type) ||
              (c + 2 < cols && grid[r - 1][c + 1]!.type === type && grid[r - 2][c + 2]!.type === type)))
        );
        row.push(newGem(rng, type));
      }
    }
    if (findMove(grid, opts)) return grid;
  }
}

/** Rearranges the existing gems until there are no matches and at least one move. */
export function shuffle(grid: Grid, rng: Rng = Math.random, opts: MatchOptions = {}): void {
  const rows = rowsOf(grid);
  const cols = colsOf(grid);
  const gems = grid.flat().filter((g): g is Gem => g !== null);
  for (let attempt = 0; attempt < 1000; attempt++) {
    for (let i = gems.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [gems[i], gems[j]] = [gems[j], gems[i]];
    }
    for (let i = 0; i < gems.length; i++) grid[Math.floor(i / cols)][i % cols] = gems[i];
    if (findRuns(grid, opts).length === 0 && findMove(grid, opts)) return;
  }
  // Extremely unlikely with 7 types; fall back to a brand-new board.
  const fresh = createBoard(rows, cols, rng, opts);
  for (let r = 0; r < rows; r++) grid[r] = fresh[r];
}

// ---- Bombs (issue #28) ----

/** A run at least this long leaves a bomb behind. */
export const BOMB_RUN = 5;
/** Chance that a refill drops in one bomb: about 1 in 12 refills. */
export const BOMB_SPAWN_CHANCE = 1 / 12;
/** Points per gem a blast clears, and the bonus per bomb that goes off (times the cascade). */
export const BLAST_POINTS = 10;
export const BOMB_BONUS = 50;

/** What one clearing step does to the board. */
export interface ClearPlan {
  /** Cells whose gem turns into a bomb and stays on the board. */
  made: Pos[];
  /** Every cell to clear: the matched gems (minus `made`) plus everything blasted. */
  cleared: Pos[];
  /** The cells in `cleared` that only a blast reached (not part of a match). */
  blasted: Pos[];
  /** Bombs that went off, in chain order. */
  detonated: Pos[];
}

const posKey = (p: Pos) => `${p.row},${p.col}`;

/**
 * Works out a clearing step. Each run of BOMB_RUN+ turns one of its gems into a
 * bomb of the run's colour: the swapped gem if it's in the run, otherwise the one
 * nearest the middle. A gem that is already a bomb never becomes the new bomb (it
 * goes off instead). Every bomb being cleared blasts the 3x3 around it, and bombs
 * the blast reaches go off too. A bomb made in this step is never blasted.
 */
export function planClear(grid: Grid, runs: Pos[][], swapped: readonly Pos[] = []): ClearPlan {
  const isBomb = (p: Pos) => grid[p.row]?.[p.col]?.special === 'bomb';
  const swappedKeys = new Set(swapped.map(posKey));
  const madeKeys = new Set<string>();
  const made: Pos[] = [];

  for (const run of runs) {
    if (run.length < BOMB_RUN) continue;
    const free = run.filter((p) => !isBomb(p) && !madeKeys.has(posKey(p)));
    if (free.length === 0) continue;
    const mid = (run.length - 1) / 2;
    const pick =
      free.find((p) => swappedKeys.has(posKey(p))) ??
      free.reduce((a, b) => (Math.abs(run.indexOf(b) - mid) < Math.abs(run.indexOf(a) - mid) ? b : a));
    madeKeys.add(posKey(pick));
    made.push(pick);
  }

  const clearedKeys = new Set<string>();
  const cleared: Pos[] = [];
  const blasted: Pos[] = [];
  const queue: Pos[] = [];
  const add = (p: Pos, byBlast: boolean) => {
    const k = posKey(p);
    if (madeKeys.has(k) || clearedKeys.has(k)) return;
    clearedKeys.add(k);
    cleared.push(p);
    if (byBlast) blasted.push(p);
    if (isBomb(p)) queue.push(p);
  };
  for (const p of matchedCells(runs)) add(p, false);

  const detonated: Pos[] = [];
  const rows = rowsOf(grid);
  const cols = colsOf(grid);
  while (queue.length > 0) {
    const b = queue.shift()!;
    detonated.push(b);
    for (let r = b.row - 1; r <= b.row + 1; r++) {
      for (let c = b.col - 1; c <= b.col + 1; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c]) add({ row: r, col: c }, true);
      }
    }
  }
  return { made, cleared, blasted, detonated };
}

/** Turns the gems at `cells` into bombs (keeping their colour and id). */
export function applyBombs(grid: Grid, cells: Pos[]): void {
  for (const p of cells) {
    const gem = grid[p.row][p.col];
    if (gem) gem.special = 'bomb';
  }
}

/** Extra points for a step's blasts: BLAST_POINTS per blasted gem plus BOMB_BONUS per bomb, times the cascade. */
export function blastScore(plan: ClearPlan, cascade: number): number {
  return (plan.blasted.length * BLAST_POINTS + plan.detonated.length * BOMB_BONUS) * cascade;
}
