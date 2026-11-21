// Pure game logic for the match-3 board. No DOM access here, so it can be unit tested.

export const DEFAULT_ROWS = 8;
export const DEFAULT_COLS = 8;
export const GEM_TYPES = 7;

/**
 * Special gems. A special still has a colour (type) and matches by it. Bombs
 * (issue #28) blast their 3x3; line gems (issue #32) fire along `dir`.
 */
export type Special = 'bomb' | 'line';

/** Which way a line gem fires: its row, its column, or a diagonal (diag = ↘, anti = ↗). */
export type LineDir = 'row' | 'col' | 'diag' | 'anti';

export interface Gem {
  id: number;
  type: number;
  special?: Special;
  /** Only on line gems: the direction of the run that made it. */
  dir?: LineDir;
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

/** True when the gem at (row, col) sits in a run of 3+ of its own type, in any enabled direction. */
function inRun(grid: Grid, row: number, col: number, opts: MatchOptions): boolean {
  const rows = rowsOf(grid);
  const cols = colsOf(grid);
  const type = grid[row][col]?.type;
  if (type === undefined) return false;
  const same = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c]?.type === type;
  for (const [dr, dc] of opts.diagonal ? [...STRAIGHT, ...DIAGONALS] : STRAIGHT) {
    let len = 1;
    for (let k = 1; same(row + dr * k, col + dc * k); k++) len++;
    for (let k = 1; same(row - dr * k, col - dc * k); k++) len++;
    if (len >= 3) return true;
  }
  return false;
}

/**
 * Finds a swap that would create a match, or null when the board is stuck. Meant for a
 * settled board (no runs yet): a swap only changes the two cells, so only runs through
 * them need checking, not the whole board.
 */
export function findMove(grid: Grid, opts: MatchOptions = {}): [Pos, Pos] | null {
  const rows = rowsOf(grid);
  const cols = colsOf(grid);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = { row: r, col: c };
      for (const b of [{ row: r, col: c + 1 }, { row: r + 1, col: c }]) {
        if (b.row >= rows || b.col >= cols) continue;
        swap(grid, a, b);
        const ok = inRun(grid, a.row, a.col, opts) || inRun(grid, b.row, b.col, opts);
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

/**
 * Rearranges the existing gems until there are no matches and at least one move.
 * Returns true when it kept the same gems (same ids, so their elements stay valid), or
 * false when it gave up and put a brand-new board in the grid: the caller must then
 * rebuild its elements. `maxAttempts` is a parameter so tests can reach the fallback.
 */
export function shuffle(grid: Grid, rng: Rng = Math.random, opts: MatchOptions = {}, maxAttempts = 1000): boolean {
  const rows = rowsOf(grid);
  const cols = colsOf(grid);
  const gems = grid.flat().filter((g): g is Gem => g !== null);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (let i = gems.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [gems[i], gems[j]] = [gems[j], gems[i]];
    }
    for (let i = 0; i < gems.length; i++) grid[Math.floor(i / cols)][i % cols] = gems[i];
    if (findRuns(grid, opts).length === 0 && findMove(grid, opts)) return true;
  }
  // Extremely unlikely with 7 types; fall back to a brand-new board.
  const fresh = createBoard(rows, cols, rng, opts);
  for (let r = 0; r < rows; r++) grid[r] = fresh[r];
  return false;
}

// ---- Special gems: bombs (issue #28) and line gems (issue #32) ----

/** A run at least this long leaves a bomb behind. */
export const BOMB_RUN = 5;
/** A run of exactly this length leaves a line gem behind. */
export const LINE_RUN = 4;
/** Chance that a refill drops in one bomb: about 1 in 12 refills. Line gems never drop in. */
export const BOMB_SPAWN_CHANCE = 1 / 12;
/** Points per gem a blast or beam clears, and the bonus per bomb / line gem that goes off (times the cascade). */
export const BLAST_POINTS = 10;
export const BOMB_BONUS = 50;
export const LINE_BONUS = 30;

/** A special gem made in a clearing step: where, which kind, and (line gems) its direction. */
export interface Made extends Pos {
  special: Special;
  dir?: LineDir;
}

/** What one clearing step does to the board. */
export interface ClearPlan {
  /** Cells whose gem turns into a special and stays on the board. */
  made: Made[];
  /** Every cell to clear: the matched gems (minus `made`) plus everything blasted or beamed. */
  cleared: Pos[];
  /** The cells in `cleared` that only a blast or a beam reached (not part of a match). */
  blasted: Pos[];
  /** Bombs that went off, in chain order. */
  detonated: Pos[];
  /** Line gems that fired, in chain order. */
  fired: Pos[];
}

const posKey = (p: Pos) => `${p.row},${p.col}`;

/** Step [dRow, dCol] along each line direction. */
export const LINE_STEP: Record<LineDir, readonly [number, number]> = {
  row: [0, 1],
  col: [1, 0],
  diag: [1, 1],
  anti: [1, -1],
};

/** The direction of a run (its cells are listed in order along the line). */
function runDir(run: Pos[]): LineDir {
  const dr = run[1].row - run[0].row;
  const dc = run[1].col - run[0].col;
  if (dr === 0) return 'row';
  if (dc === 0) return 'col';
  return dr === dc ? 'diag' : 'anti';
}

/**
 * Works out a clearing step. Each run of BOMB_RUN+ turns one of its gems into a
 * bomb of the run's colour, and each run of exactly LINE_RUN into a line gem
 * firing along the run: the swapped gem if it's in the run, otherwise the one
 * nearest the middle. A gem that is already special never becomes the new one (it
 * goes off instead). Every bomb being cleared blasts the 3x3 around it; every line
 * gem being cleared clears its whole line to both board edges; specials those
 * reach go off too. A special made in this step is never cleared.
 */
export function planClear(grid: Grid, runs: Pos[][], swapped: readonly Pos[] = []): ClearPlan {
  const specialAt = (p: Pos) => grid[p.row]?.[p.col]?.special;
  const swappedKeys = new Set(swapped.map(posKey));
  const madeKeys = new Set<string>();
  const made: Made[] = [];

  // Longest runs first, so a bomb gets first pick of the swapped gem over a line gem.
  for (const run of [...runs].sort((a, b) => b.length - a.length)) {
    const special: Special | null = run.length >= BOMB_RUN ? 'bomb' : run.length === LINE_RUN ? 'line' : null;
    if (!special) continue;
    const free = run.filter((p) => !specialAt(p) && !madeKeys.has(posKey(p)));
    if (free.length === 0) continue;
    const mid = (run.length - 1) / 2;
    const pick =
      free.find((p) => swappedKeys.has(posKey(p))) ??
      free.reduce((a, b) => (Math.abs(run.indexOf(b) - mid) < Math.abs(run.indexOf(a) - mid) ? b : a));
    madeKeys.add(posKey(pick));
    made.push(special === 'line' ? { ...pick, special, dir: runDir(run) } : { ...pick, special });
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
    if (specialAt(p)) queue.push(p);
  };
  for (const p of matchedCells(runs)) add(p, false);

  const detonated: Pos[] = [];
  const fired: Pos[] = [];
  const rows = rowsOf(grid);
  const cols = colsOf(grid);
  const onBoard = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols;
  while (queue.length > 0) {
    const s = queue.shift()!;
    const gem = grid[s.row][s.col]!;
    if (gem.special === 'bomb') {
      detonated.push(s);
      for (let r = s.row - 1; r <= s.row + 1; r++) {
        for (let c = s.col - 1; c <= s.col + 1; c++) {
          if (onBoard(r, c) && grid[r][c]) add({ row: r, col: c }, true);
        }
      }
    } else if (gem.special === 'line') {
      fired.push(s);
      const [dr, dc] = LINE_STEP[gem.dir ?? 'row'];
      for (const sign of [1, -1]) {
        for (let r = s.row + sign * dr, c = s.col + sign * dc; onBoard(r, c); r += sign * dr, c += sign * dc) {
          if (grid[r][c]) add({ row: r, col: c }, true);
        }
      }
    }
  }
  return { made, cleared, blasted, detonated, fired };
}

/**
 * How far each cell is from the nearest fired line gem along its beam, in cell
 * widths (a diagonal step is √2), keyed "row,col". `main.ts` uses it to pop gems
 * as the beam's front passes them. Read it before the line gems leave the grid.
 */
export function beamReach(grid: Grid, fired: Pos[]): Map<string, number> {
  const reach = new Map<string, number>();
  const rows = rowsOf(grid);
  const cols = colsOf(grid);
  for (const s of fired) {
    const gem = grid[s.row]?.[s.col];
    if (gem?.special !== 'line') continue;
    const [dr, dc] = LINE_STEP[gem.dir ?? 'row'];
    const unit = dr !== 0 && dc !== 0 ? Math.SQRT2 : 1;
    for (const sign of [1, -1]) {
      for (let k = 1, r = s.row + sign * dr, c = s.col + sign * dc; r >= 0 && r < rows && c >= 0 && c < cols; k++, r += sign * dr, c += sign * dc) {
        const key = posKey({ row: r, col: c });
        reach.set(key, Math.min(reach.get(key) ?? Infinity, k * unit));
      }
    }
  }
  return reach;
}

/** Turns the gems at the made cells into their specials (keeping their colour and id). */
export function applySpecials(grid: Grid, made: Made[]): void {
  for (const m of made) {
    const gem = grid[m.row][m.col];
    if (!gem) continue;
    gem.special = m.special;
    if (m.dir) gem.dir = m.dir;
    else delete gem.dir;
  }
}

/**
 * Extra points for a step's blasts and beams: BLAST_POINTS per gem they cleared,
 * plus BOMB_BONUS per bomb and LINE_BONUS per line gem, times the cascade.
 */
export function blastScore(plan: ClearPlan, cascade: number): number {
  return (
    (plan.blasted.length * BLAST_POINTS + plan.detonated.length * BOMB_BONUS + plan.fired.length * LINE_BONUS) * cascade
  );
}
