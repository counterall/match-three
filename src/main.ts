import './style.css';
import {
  clearCells,
  collapse,
  createBoard,
  findMove,
  findRuns,
  isAdjacent,
  colsOf,
  matchedCells,
  rowsOf,
  scoreFor,
  shuffle,
  swap,
  type Grid,
  type Pos,
  type Spawn,
} from './board';
import { gemSvg, installGemDefs } from './gems';
import { initSettings } from './settings-ui';
import { installStandaloneZoomGuards } from './tap-guard';
import { Countdown, bonusSeconds, formatTime } from './timer';
import { canPause, shouldAutoPause } from './pause';

// ---- Timing (kept in sync with CSS through custom properties) ----
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SWAP_MS = reducedMotion ? 60 : 200;
const POP_MS = reducedMotion ? 60 : 280;
const FALL_BASE_MS = reducedMotion ? 60 : 160;
const FALL_PER_ROW_MS = reducedMotion ? 0 : 45;
const HINT_DELAY_MS = 6000;
const TICK_MS = 200; // how often the HUD clock refreshes
const LOW_TIME_MS = 10_000; // the clock turns urgent below this
const BEST_KEY = 'neon-cascade:best';

// ---- Board layout: narrow (phone portrait) screens get fewer, bigger columns ----
const compactQuery = window.matchMedia('(max-width: 600px)');
const LAYOUTS = {
  compact: { rows: 8, cols: 6 },
  wide: { rows: 8, cols: 8 },
};
const currentLayout = () => (compactQuery.matches ? LAYOUTS.compact : LAYOUTS.wide);

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
const timeEl = document.querySelector<HTMLSpanElement>('#time')!;
const timeStatEl = document.querySelector<HTMLDivElement>('#time-stat')!;
const gameOverEl = document.querySelector<HTMLDivElement>('#game-over')!;
const finalScoreEl = document.querySelector<HTMLSpanElement>('#final-score')!;
const newBestEl = document.querySelector<HTMLParagraphElement>('#new-best')!;
const playAgainBtn = document.querySelector<HTMLButtonElement>('#play-again')!;
const pauseBtn = document.querySelector<HTMLButtonElement>('#pause')!;
const pausedEl = document.querySelector<HTMLDivElement>('#paused')!;
const resumeBtn = document.querySelector<HTMLButtonElement>('#resume')!;

// ---- State ----
let grid: Grid = [];
let score = 0;
let best = loadBest();
let busy = false;
let selected: Pos | null = null;
let hintTimer = 0;
let gameToken = 0; // bumps on new game so in-flight cascades stop touching the board
const clock = new Countdown(0); // round timer; starts on the first swap
let timeUp = false; // the clock ran out: no more input
let paused = false; // the player paused (or the page was hidden): no input, clock held
let bestAtStart = 0; // to tell whether this round set a new best
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
  el.dataset.type = String(type);
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
  for (let r = 0; r < rowsOf(grid); r++) {
    for (let c = 0; c < colsOf(grid); c++) {
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
  el.dataset.type = String(type);
  el.style.left = `${((col + 0.5) / colsOf(grid)) * 100}%`;
  el.style.top = `${((row + 0.5) / rowsOf(grid)) * 100}%`;
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
  if (busy || timeUp || paused) return;
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
  updateClock(); // the tick may lag the clock by up to TICK_MS
  if (busy || timeUp || paused) return;
  busy = true;
  const token = gameToken;
  clock.start(performance.now());
  syncPauseButton();
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
    finishMove();
    return;
  }

  await resolveCascades(token);
  if (token !== gameToken) return;
  finishMove();
}

/** Unblocks input after a move, or ends the round if time ran out during it. */
function finishMove(): void {
  busy = false;
  if (timeUp) showGameOver();
  else if (!paused) resetIdle();
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
    const bonus = timeUp ? 0 : bonusSeconds(score, score + points);
    setScore(score + points);
    const messages = cascade >= 2 ? [`Cascade ×${cascade}`] : [];
    // add() refuses once the clock has run out, even if the tick hasn't noticed yet.
    if (bonus > 0 && clock.add(bonus * 1000, performance.now())) {
      flashTimeBonus();
      messages.push(`+${bonus}s`);
    }
    if (messages.length > 0) toast(messages.join(' · '));

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
    await wait(FALL_BASE_MS + rowsOf(grid) * FALL_PER_ROW_MS);
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

// ---- Round timer ----
function updateClock(): void {
  const left = clock.remaining(performance.now());
  const text = formatTime(left);
  if (timeEl.textContent !== text) timeEl.textContent = text;
  timeStatEl.classList.toggle('low', clock.isStarted && left > 0 && left <= LOW_TIME_MS);
  if (!timeUp && clock.isStarted && left <= 0) endRound();
}

function flashTimeBonus(): void {
  timeStatEl.classList.remove('bonus');
  void timeStatEl.offsetWidth; // restart the animation
  timeStatEl.classList.add('bonus');
}

/** Time ran out: block input now; a cascade already running finishes first. */
function endRound(): void {
  timeUp = true;
  syncPauseButton();
  select(null);
  drag = null;
  clearTimeout(hintTimer);
  clearHint();
  if (!busy) showGameOver();
}

function showGameOver(): void {
  clearTimeout(hintTimer);
  clearHint();
  finalScoreEl.textContent = score.toLocaleString();
  newBestEl.hidden = !(score > bestAtStart && score > 0);
  gameOverEl.hidden = false;
  playAgainBtn.focus();
}

function newGame(): void {
  gameToken++;
  busy = false;
  timeUp = false;
  selected = null;
  drag = null;
  gameOverEl.hidden = true;
  setPaused(false);
  clock.reset(settings.timeLimit * 60_000);
  bestAtStart = best;
  const { rows, cols } = currentLayout();
  grid = createBoard(rows, cols);
  document.body.style.setProperty('--rows', String(rows));
  document.body.style.setProperty('--cols', String(cols));
  setScore(0);
  rebuildBoard();
  resetIdle();
  updateClock();
  syncPauseButton();
}

// ---- Pause / resume ----
const roundState = () => ({ started: clock.isStarted, timeUp, paused });

/** The pause button works only while a round is running (after the first swap, before time's up). */
function syncPauseButton(): void {
  pauseBtn.disabled = !paused && !canPause(roundState());
  pauseBtn.setAttribute('aria-pressed', String(paused));
  pauseBtn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
}

function setPaused(on: boolean): void {
  paused = on;
  if (on) {
    clock.hold('paused', performance.now());
    select(null);
    drag = null;
    clearTimeout(hintTimer);
    clearHint();
  } else {
    clock.release('paused', performance.now());
  }
  pausedEl.hidden = !on;
  hintBtn.disabled = on;
  syncPauseButton();
  updateClock();
}

function pause(): void {
  if (!canPause(roundState())) return;
  setPaused(true);
  if (!settingsDialog.open) resumeBtn.focus();
}

function resume(): void {
  if (!paused) return;
  setPaused(false);
  if (!busy) resetIdle();
  pauseBtn.focus();
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
  if (!pos || busy || timeUp || paused) return;
  drag = { pos, x: e.clientX, y: e.clientY };
  boardEl.setPointerCapture(e.pointerId);
});

boardEl.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  const threshold = boardEl.clientWidth / colsOf(grid) / 3;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
  const from = drag.pos;
  const to =
    Math.abs(dx) > Math.abs(dy)
      ? { row: from.row, col: from.col + Math.sign(dx) }
      : { row: from.row + Math.sign(dy), col: from.col };
  drag = null;
  if (to.row >= 0 && to.row < rowsOf(grid) && to.col >= 0 && to.col < colsOf(grid)) {
    void trySwap(from, to);
  }
});

boardEl.addEventListener('pointerup', () => {
  if (!drag) return; // a swipe already handled it
  const pos = drag.pos;
  drag = null;
  if (busy || timeUp || paused) return;
  resetIdle();
  if (selected && selected.row === pos.row && selected.col === pos.col) select(null);
  else if (selected && isAdjacent(selected, pos)) void trySwap(selected, pos);
  else select(pos);
});

boardEl.addEventListener('pointercancel', () => (drag = null));

hintBtn.addEventListener('click', showHint);
newGameBtn.addEventListener('click', newGame);
playAgainBtn.addEventListener('click', newGame);
pauseBtn.addEventListener('click', () => (paused ? resume() : pause()));
resumeBtn.addEventListener('click', resume);

// Crossing the phone/desktop breakpoint swaps the board shape, but only before the
// first move, so resizing or rotating never throws away a game in progress.
compactQuery.addEventListener('change', () => {
  if (!clock.isStarted && !busy) newGame();
});

// The clock pauses while the settings dialog is open or the page is hidden. Hiding the
// page (switching tabs, minimising the home-screen app) also pauses a running round,
// so coming back shows the Paused screen instead of jumping straight into play.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clock.hold('hidden', performance.now());
  else clock.release('hidden', performance.now());
  if (shouldAutoPause(roundState(), document.hidden)) pause();
  updateClock();
});
// iOS home-screen apps may skip visibilitychange when backgrounded; pagehide still fires.
window.addEventListener('pagehide', () => {
  if (shouldAutoPause(roundState(), true)) pause();
});

const settingsDialog = document.querySelector<HTMLDialogElement>('#settings')!;

installStandaloneZoomGuards();
installGemDefs();
const settings = initSettings({
  onOpenChange(open) {
    if (open) clock.hold('settings', performance.now());
    else clock.release('settings', performance.now());
    updateClock();
    // The round may have ended behind the modal, where focus() can't reach.
    if (!open && !gameOverEl.hidden) playAgainBtn.focus();
    else if (!open && paused) resumeBtn.focus();
  },
  // A new limit applies to the next game, or right away if this one hasn't started.
  onTimeLimitChange(minutes) {
    if (!clock.isStarted && !timeUp) {
      clock.reset(minutes * 60_000);
      updateClock();
    }
  },
});
if (document.hidden) clock.hold('hidden', performance.now());
setInterval(updateClock, TICK_MS);

newGame();
