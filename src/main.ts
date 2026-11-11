import './style.css';
import {
  SIZE,
  clearCells,
  collapse,
  createBoard,
  findMove,
  findRuns,
  isAdjacent,
  matchedCells,
  scoreFor,
  shuffle,
  swap,
  type Grid,
  type Pos,
  type Spawn,
} from './board';
import { gemColor, gemSvg } from './gems';

// ---- Timing (kept in sync with CSS through custom properties) ----
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SWAP_MS = reducedMotion ? 60 : 200;
const POP_MS = reducedMotion ? 60 : 280;
const FALL_BASE_MS = reducedMotion ? 60 : 160;
const FALL_PER_ROW_MS = reducedMotion ? 0 : 45;
const HINT_DELAY_MS = 6000;
const BEST_KEY = 'neon-cascade:best';

const root = document.documentElement;
root.style.setProperty('--swap-ms', `${SWAP_MS}ms`);
root.style.setProperty('--pop-ms', `${POP_MS}ms`);

// ---- DOM ----
const boardEl = document.querySelector<HTMLDivElement>('#board')!;
const scoreEl = document.querySelector<HTMLSpanElement>('#score')!;
const bestEl = document.querySelector<HTMLSpanElement>('#best')!;
const toastEl = document.querySelector<HTMLDivElement>('#toast')!;
const hintBtn = document.querySelector<HTMLButtonElement>('#hint')!;
const newGameBtn = document.querySelector<HTMLButtonElement>('#new-game')!;

// ---- State ----
let grid: Grid = [];
let score = 0;
let best = loadBest();
let busy = false;
let selected: Pos | null = null;
let hintTimer = 0;
let gameToken = 0; // bumps on new game so in-flight cascades stop touching the board
const els = new Map<number, HTMLDivElement>();

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(): void {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    /* storage unavailable; best score just won't persist */
  }
}

// ---- Rendering ----
function createGemEl(id: number, type: number, row: number, col: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'gem';
  el.dataset.id = String(id);
  el.style.setProperty('--c', gemColor(type));
  el.innerHTML = gemSvg(type);
  place(el, row, col);
  boardEl.append(el);
  els.set(id, el);
  return el;
}

function place(el: HTMLDivElement, row: number, col: number): void {
  const prevRow = Number(el.dataset.row ?? row);
  const drop = Math.max(0, row - prevRow);
  el.style.transitionDuration = drop > 0 ? `${FALL_BASE_MS + drop * FALL_PER_ROW_MS}ms` : '';
  el.dataset.row = String(row);
  el.dataset.col = String(col);
  el.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
}

/** Moves every gem element to its grid position (CSS transitions animate it). */
function render(): void {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const gem = grid[r][c];
      if (!gem) continue;
      const el = els.get(gem.id) ?? createGemEl(gem.id, gem.type, r, c);
      if (el.dataset.row !== String(r) || el.dataset.col !== String(c)) place(el, r, c);
    }
  }
}

function addSpawns(spawns: Spawn[]): void {
  for (const s of spawns) createGemEl(s.gem.id, s.gem.type, s.fromRow, s.pos.col);
  void boardEl.offsetHeight; // commit start positions so the fall animates
}

function rebuildBoard(): void {
  boardEl.querySelectorAll('.gem').forEach((el) => el.remove());
  els.clear();
  render();
}

function elAt(p: Pos): HTMLDivElement | undefined {
  const gem = grid[p.row]?.[p.col];
  return gem ? els.get(gem.id) : undefined;
}

function setScore(value: number): void {
  score = value;
  scoreEl.textContent = score.toLocaleString();
  if (score > best) {
    best = score;
    saveBest();
  }
  bestEl.textContent = best.toLocaleString();
}

let toastTimer = 0;
function toast(text: string, ms = 1100): void {
  toastEl.textContent = text;
  toastEl.classList.remove('show');
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), ms);
}

function floatPoints(cells: Pos[], points: number, type: number): void {
  const row = cells.reduce((s, p) => s + p.row, 0) / cells.length;
  const col = cells.reduce((s, p) => s + p.col, 0) / cells.length;
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = `+${points}`;
  el.style.setProperty('--c', gemColor(type));
  el.style.left = `${((col + 0.5) / SIZE) * 100}%`;
  el.style.top = `${((row + 0.5) / SIZE) * 100}%`;
  boardEl.append(el);
  el.addEventListener('animationend', () => el.remove());
}

// ---- Selection & hints ----
function select(p: Pos | null): void {
  if (selected) elAt(selected)?.classList.remove('selected');
  selected = p;
  if (selected) elAt(selected)?.classList.add('selected');
}

function clearHint(): void {
  boardEl.querySelectorAll('.hint').forEach((el) => el.classList.remove('hint'));
}

function showHint(): void {
  if (busy) return;
  clearHint();
  const move = findMove(grid);
  if (!move) return;
  for (const p of move) elAt(p)?.classList.add('hint');
}

function resetIdle(): void {
  clearHint();
  clearTimeout(hintTimer);
  hintTimer = window.setTimeout(showHint, HINT_DELAY_MS);
}

// ---- Game flow ----
async function trySwap(a: Pos, b: Pos): Promise<void> {
  if (busy) return;
  busy = true;
  const token = gameToken;
  select(null);
  resetIdle();

  swap(grid, a, b);
  render();
  await wait(SWAP_MS);
  if (token !== gameToken) return;

  if (findRuns(grid).length === 0) {
    // Not a match: bounce back.
    swap(grid, a, b);
    render();
    elAt(a)?.classList.add('nope');
    elAt(b)?.classList.add('nope');
    await wait(SWAP_MS);
    if (token !== gameToken) return;
    elAt(a)?.classList.remove('nope');
    elAt(b)?.classList.remove('nope');
    busy = false;
    return;
  }

  await resolveCascades(token);
  if (token !== gameToken) return;
  busy = false;
  resetIdle();
}

async function resolveCascades(token: number): Promise<void> {
  let cascade = 1;
  for (let runs = findRuns(grid); runs.length > 0; runs = findRuns(grid)) {
    const cells = matchedCells(runs);
    const points = scoreFor(runs, cascade);
    const type = grid[cells[0].row][cells[0].col]!.type;

    const popping = cells.map((p) => elAt(p)).filter((el): el is HTMLDivElement => !!el);
    popping.forEach((el) => el.classList.add('pop'));
    floatPoints(cells, points, type);
    setScore(score + points);
    if (cascade >= 2) toast(`Cascade ×${cascade}`);

    await wait(POP_MS);
    if (token !== gameToken) return;

    for (const el of popping) {
      els.delete(Number(el.dataset.id));
      el.remove();
    }
    clearCells(grid, cells);
    const spawns = collapse(grid, Math.random);
    addSpawns(spawns);
    render();
    await wait(FALL_BASE_MS + SIZE * FALL_PER_ROW_MS);
    if (token !== gameToken) return;
    cascade++;
  }

  if (!findMove(grid)) {
    toast('No moves left · shuffling', 1400);
    await wait(700);
    if (token !== gameToken) return;
    shuffle(grid);
    boardEl.classList.add('shuffling');
    render();
    await wait(SWAP_MS * 2);
    boardEl.classList.remove('shuffling');
  }
}

function newGame(): void {
  gameToken++;
  busy = false;
  selected = null;
  grid = createBoard();
  setScore(0);
  rebuildBoard();
  resetIdle();
}

// ---- Input: tap-to-select or swipe a gem ----
let drag: { pos: Pos; x: number; y: number } | null = null;

function posFromEvent(e: PointerEvent): Pos | null {
  const el = (e.target as Element).closest<HTMLDivElement>('.gem');
  if (!el || el.classList.contains('pop')) return null;
  return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
}

boardEl.addEventListener('pointerdown', (e) => {
  const pos = posFromEvent(e);
  if (!pos || busy) return;
  drag = { pos, x: e.clientX, y: e.clientY };
  boardEl.setPointerCapture(e.pointerId);
});

boardEl.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  const threshold = boardEl.clientWidth / SIZE / 3;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
  const from = drag.pos;
  const to =
    Math.abs(dx) > Math.abs(dy)
      ? { row: from.row, col: from.col + Math.sign(dx) }
      : { row: from.row + Math.sign(dy), col: from.col };
  drag = null;
  if (to.row >= 0 && to.row < SIZE && to.col >= 0 && to.col < SIZE) void trySwap(from, to);
});

boardEl.addEventListener('pointerup', () => {
  if (!drag) return; // a swipe already handled it
  const pos = drag.pos;
  drag = null;
  if (busy) return;
  resetIdle();
  if (selected && selected.row === pos.row && selected.col === pos.col) select(null);
  else if (selected && isAdjacent(selected, pos)) void trySwap(selected, pos);
  else select(pos);
});

boardEl.addEventListener('pointercancel', () => (drag = null));

hintBtn.addEventListener('click', showHint);
newGameBtn.addEventListener('click', newGame);

newGame();
