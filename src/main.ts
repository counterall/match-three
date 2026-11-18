import './style.css';
import {
  BOMB_SPAWN_CHANCE,
  applySpecials,
  beamReach,
  blastScore,
  clearCells,
  collapse,
  createBoard,
  findMove,
  findRuns,
  isAdjacent,
  colsOf,
  planClear,
  rowsOf,
  scoreFor,
  shuffle,
  swap,
  type Gem,
  type Grid,
  type LineDir,
  type MatchOptions,
  type Pos,
  type Special,
  type Spawn,
} from './board';
import { DEFAULT_CAST, drawCast, type AnimalCast } from './animals';
import { LINE_BADGE_ANGLE, gemSvg, installGemDefs, type GemMark } from './gems';
import { t } from './i18n';
import { initSettings } from './settings-ui';
import { installStandaloneZoomGuards } from './tap-guard';
import { Countdown, bonusSeconds, formatTime } from './timer';
import { canPause, shouldAutoPause } from './pause';
import { loadBest, saveBest } from './best';
import { DEFAULT_SETTINGS, type TimeLimit } from './settings';
import { CALLOUT_MS, LONG_CALLOUT_MS, calloutKey, calloutMs, showMoveTotal, stepCallout, type Callout } from './combo';

// ---- Timing (kept in sync with CSS through custom properties) ----
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SWAP_MS = reducedMotion ? 60 : 200;
const POP_MS = reducedMotion ? 60 : 280;
const FALL_BASE_MS = reducedMotion ? 60 : 160;
const FALL_PER_ROW_MS = reducedMotion ? 0 : 45;
const BLAST_MS = reducedMotion ? 220 : 340; // reduced motion: a plain flash, still long enough to see
const HINT_DELAY_MS = 6000;
const TICK_MS = 200; // how often the HUD clock refreshes
const LOW_TIME_MS = 10_000; // the clock turns urgent below this

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
root.style.setProperty('--blast-ms', `${BLAST_MS}ms`);

// ---- DOM ----
const boardEl = document.querySelector<HTMLDivElement>('#board')!;
const scoreEl = document.querySelector<HTMLSpanElement>('#score')!;
const bestEl = document.querySelector<HTMLSpanElement>('#best')!;
const diagBadge = document.querySelector<HTMLSpanElement>('#diag-badge')!;
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
let roundLimit: TimeLimit = DEFAULT_SETTINGS.timeLimit; // this round's length; set by setRoundLimit()
let roundDiagonal = DEFAULT_SETTINGS.diagonal; // this round's mode (issue #30); set by setRoundLimit()
let best = 0; // best score for rounds of roundLimit minutes in this mode (issues #22, #30)
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

const storage = () => window.localStorage;

/** The match rules of this round: diagonal matches on or off (issue #30). */
const matchOpts = (): MatchOptions => ({ diagonal: roundDiagonal });

/**
 * Sets the round length and mode whose best score the HUD shows and this round can
 * beat; the diagonal badge next to Best shows the mode.
 */
function setRoundLimit(minutes: TimeLimit, diagonal = roundDiagonal): void {
  roundLimit = minutes;
  roundDiagonal = diagonal;
  diagBadge.hidden = !diagonal;
  best = loadBest(storage, minutes, diagonal);
  bestAtStart = best;
  setScore(score);
}

// ---- Rendering ----
/** This game's animals (Animals gem style): drawn afresh by newGame(). */
let animalCast: AnimalCast = DEFAULT_CAST;

function createGemEl(gem: Gem, row: number, col: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'gem';
  el.dataset.id = String(gem.id);
  el.dataset.type = String(gem.type);
  drawGem(el, gem);
  place(el, row, col);
  boardEl.append(el);
  els.set(gem.id, el);
  return el;
}

/** A gem element's special kind and direction, as flagged on the element. */
function markOf(el: HTMLDivElement): GemMark {
  return { special: el.dataset.special as Special | undefined, dir: el.dataset.dir as LineDir | undefined };
}

/**
 * (Re)draws a gem element's artwork in the current style. Specials are flagged on
 * the element (`data-special`, plus `data-dir` for line gems, issue #32).
 */
function drawGem(el: HTMLDivElement, mark: GemMark = markOf(el), style = settings.gemStyle): void {
  if (mark.special) el.dataset.special = mark.special;
  else delete el.dataset.special;
  if (mark.special === 'line' && mark.dir) el.dataset.dir = mark.dir;
  else delete el.dataset.dir;
  el.innerHTML = gemSvg(Number(el.dataset.type), style, animalCast, mark);
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
      const el = els.get(gem.id) ?? createGemEl(gem, r, c);
      if (el.dataset.row !== String(r) || el.dataset.col !== String(c)) place(el, r, c);
    }
  }
}

function addSpawns(spawns: Spawn[]): void {
  for (const s of spawns) createGemEl(s.gem, s.fromRow, s.pos.col);
  void boardEl.offsetHeight; // commit start positions so the fall animates
}

function rebuildBoard(): void {
  boardEl.querySelectorAll('.gem, .blast, .beam').forEach((el) => el.remove());
  els.clear();
  render();
}

function elAt(p: Pos): HTMLDivElement | undefined {
  const gem = grid[p.row]?.[p.col];
  return gem ? els.get(gem.id) : undefined;
}

function setScore(value: number): void {
  score = value;
  scoreEl.textContent = score.toLocaleString(settings.language);
  if (score > best) {
    best = score;
    saveBest(storage, roundLimit, best, roundDiagonal);
  }
  bestEl.textContent = best.toLocaleString(settings.language);
}

/**
 * What the toast shows: a word line (styled by `tier`: '1'–'4' or 'total', issue #34)
 * and an optional smaller second line of chips (Bomb!/Line!) and extra text (+20s).
 */
interface ToastContent {
  word?: string;
  tier?: string;
  chips?: string[];
  extra?: string;
}

let toastTimer = 0;
function toast(content: string | ToastContent, ms = CALLOUT_MS): void {
  const c = typeof content === 'string' ? { word: content } : content;
  const parts: HTMLElement[] = [];
  if (c.word) parts.push(span('callout-word', c.word));
  const chips = c.chips ?? [];
  if (chips.length > 0 || c.extra) {
    const items = chips.map((chip) => span('callout-chip', chip));
    if (c.extra) items.push(span('callout-extra', c.extra));
    const sub = span('callout-sub', '');
    // Spaces between the parts so the live region reads "Great! ×3 Bomb! +20s", not
    // one run-on word; whitespace between flex items isn't drawn.
    items.forEach((item, i) => (i > 0 ? sub.append(' ', item) : sub.append(item)));
    parts.push(sub);
  }
  toastEl.replaceChildren(...parts.flatMap((part, i) => (i > 0 ? [' ', part] : [part])));
  if (c.tier) toastEl.dataset.tier = c.tier;
  else delete toastEl.dataset.tier;
  toastEl.classList.remove('show');
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), ms);
}

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

/** A cascade step's callout as toast content, in the current language (issue #34). */
function calloutContent(c: Callout): ToastContent {
  const lang = settings.language;
  const key = calloutKey(c.tier);
  return {
    word: key ? t(lang, key, { n: c.step }) : undefined,
    tier: String(c.tier), // '0' (no word: a lone tag or bonus) still pops in
    chips: c.tags.map((kind) => t(lang, kind === 'bomb' ? 'tagBomb' : 'tagLine')),
    extra: c.bonus > 0 ? t(lang, 'bonusTime', { s: c.bonus }) : undefined,
  };
}

/** Flash over the 3x3 square around a bomb that goes off (clipped by the board's overflow). */
function showBlast(p: Pos): void {
  const el = document.createElement('div');
  el.className = 'blast';
  el.style.left = `${((p.col - 1) / colsOf(grid)) * 100}%`;
  el.style.top = `${((p.row - 1) / rowsOf(grid)) * 100}%`;
  el.style.width = `${(3 / colsOf(grid)) * 100}%`;
  el.style.height = `${(3 / rowsOf(grid)) * 100}%`;
  boardEl.append(el);
  el.addEventListener('animationend', () => el.remove());
}

/**
 * The beam of a line gem going off (issue #32): a strip along its line, centred on
 * the gem, sweeping out both ways (clipped by the board's overflow). Its data-type
 * colours the glow.
 */
function showBeam(p: Pos): void {
  const gem = grid[p.row][p.col];
  if (!gem) return;
  const el = document.createElement('div');
  el.className = 'beam';
  el.dataset.type = String(gem.type);
  el.style.left = `${((p.col + 0.5) / colsOf(grid)) * 100}%`;
  el.style.top = `${((p.row + 0.5) / rowsOf(grid)) * 100}%`;
  el.style.setProperty('--beam-angle', `${LINE_BADGE_ANGLE[gem.dir ?? 'row']}deg`);
  boardEl.append(el);
  el.addEventListener('animationend', () => el.remove());
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
  const move = findMove(grid, matchOpts());
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

  if (findRuns(grid, matchOpts()).length === 0) {
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

  const totalShown = await resolveCascades(token, [a, b]);
  if (token !== gameToken) return;
  // Time ran out during a long chain: let its move total show before "Time's up"
  // covers the board (input is already blocked by timeUp).
  if (timeUp && totalShown) {
    await wait(LONG_CALLOUT_MS);
    if (token !== gameToken) return;
  }
  finishMove();
}

/** Unblocks input after a move, or ends the round if time ran out during it. */
function finishMove(): void {
  busy = false;
  if (timeUp) showGameOver();
  else if (!paused) resetIdle();
}

/**
 * `swapped`: the two cells of the player's swap, so a run's new special lands on the moved gem.
 * Resolves true when it ended by showing the move total (issue #34).
 */
async function resolveCascades(token: number, swapped: Pos[]): Promise<boolean> {
  let cascade = 1;
  let moveTotal = 0; // every point this move scored, for the move-total callout
  for (let runs = findRuns(grid, matchOpts()); runs.length > 0; runs = findRuns(grid, matchOpts())) {
    // Specials: 5+ runs leave a bomb (issue #28), 4-runs a line gem (issue #32);
    // cleared bombs blast their 3x3, cleared line gems their whole line.
    const plan = planClear(grid, runs, cascade === 1 ? swapped : []);
    const cells = plan.cleared;
    const points = scoreFor(runs, cascade) + blastScore(plan, cascade);
    const type = grid[runs[0][0].row][runs[0][0].col]!.type;

    // Beams first: they read the line gems' directions before the grid changes.
    plan.fired.forEach(showBeam);
    plan.detonated.forEach(showBlast);
    applySpecials(grid, plan.made);
    for (const m of plan.made) {
      const el = elAt(m);
      if (!el) continue;
      drawGem(el, m);
      el.classList.add('special-made');
      // A timer, not animationend: reduced motion turns the animation off.
      setTimeout(() => el.classList.remove('special-made'), POP_MS);
    }

    // Beamed gems pop as the beam's front reaches them (issue #32): the strip
    // (1.5 board widths each way) grows over 75% of POP_MS.
    const reach = reducedMotion ? new Map<string, number>() : beamReach(grid, plan.fired);
    const msPerCell = (POP_MS * 0.75) / (1.5 * colsOf(grid));
    let lastPop = 0;
    const popping: HTMLDivElement[] = [];
    for (const p of cells) {
      const el = elAt(p);
      if (!el) continue;
      const delay = Math.round((reach.get(`${p.row},${p.col}`) ?? 0) * msPerCell);
      el.style.setProperty('--pop-delay', `${delay}ms`);
      lastPop = Math.max(lastPop, delay);
      el.classList.add('pop');
      popping.push(el);
    }
    floatPoints(runs.flat(), points, type);
    const bonus = timeUp ? 0 : bonusSeconds(score, score + points);
    setScore(score + points);
    moveTotal += points;
    let granted = 0;
    // add() refuses once the clock has run out, even if the tick hasn't noticed yet.
    if (bonus > 0 && clock.add(bonus * 1000, performance.now())) {
      flashTimeBonus();
      granted = bonus;
    }
    // Combo callout (issue #34): the word climbs with the step; specials made and
    // bonus time go on its second line.
    const callout = stepCallout(cascade, plan.made, granted);
    if (callout) toast(calloutContent(callout), calloutMs(callout.tier));

    // A blast (and, under reduced motion, a beam's flash) runs BLAST_MS; a beam's
    // sweep takes one pop, and its farthest gem pops lastPop ms in.
    const flashing = plan.detonated.length > 0 || (reducedMotion && plan.fired.length > 0);
    await wait(Math.max(POP_MS + lastPop, flashing ? BLAST_MS : 0));
    if (token !== gameToken) return false;

    for (const el of popping) {
      els.delete(Number(el.dataset.id));
      el.remove();
    }
    clearCells(grid, cells);
    const spawns = collapse(grid, Math.random, BOMB_SPAWN_CHANCE);
    addSpawns(spawns);
    render();
    await wait(FALL_BASE_MS + rowsOf(grid) * FALL_PER_ROW_MS);
    if (token !== gameToken) return false;
    cascade++;
  }

  const hasMove = findMove(grid, matchOpts()) !== null;
  // The board has settled: a long chain shows what the whole move scored ("No moves" wins).
  const totalShown = hasMove && showMoveTotal(cascade - 1);
  if (totalShown) {
    const n = moveTotal.toLocaleString(settings.language);
    toast({ word: t(settings.language, 'moveTotal', { n }), tier: 'total' }, LONG_CALLOUT_MS);
  }
  if (!hasMove) {
    toast(t(settings.language, 'noMoves'), 1400);
    await wait(700);
    if (token !== gameToken) return false;
    shuffle(grid, Math.random, matchOpts());
    boardEl.classList.add('shuffling');
    render();
    await wait(SWAP_MS * 2);
    boardEl.classList.remove('shuffling');
  }
  return totalShown;
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
  finalScoreEl.textContent = score.toLocaleString(settings.language);
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
  // Reset the clock before unpausing: setPaused() runs updateClock(), which would
  // otherwise see the previous round's expired clock and end this one at once.
  clock.reset(settings.timeLimit * 60_000);
  setPaused(false);
  // Seven of the eight animals, in a random order, for every new game (issue #20).
  animalCast = drawCast(Math.random);
  // Score first: setRoundLimit() shows it, and could save the old one as a best.
  // The mode is fixed for the round before the board is made (issue #30).
  score = 0;
  setRoundLimit(settings.timeLimit, settings.diagonal);
  const { rows, cols } = currentLayout();
  grid = createBoard(rows, cols, Math.random, matchOpts());
  document.body.style.setProperty('--rows', String(rows));
  document.body.style.setProperty('--cols', String(cols));
  rebuildBoard();
  resetIdle();
  updateClock();
  syncPauseButton();
}

// ---- Pause / resume ----
const roundState = () => ({ started: clock.isStarted, timeUp, paused });

/**
 * The pause button works only while a round is running (after the first swap, before
 * time's up). Its aria-label (Pause/Resume) is owned here, not by data-i18n-label.
 */
function syncPauseButton(): void {
  pauseBtn.disabled = !paused && !canPause(roundState());
  pauseBtn.dataset.paused = String(paused);
  pauseBtn.setAttribute('aria-label', t(settings.language, paused ? 'resume' : 'pause'));
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
  updateClock(); // the tick may lag by up to TICK_MS; time may already be up
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
      setRoundLimit(minutes);
      updateClock();
    }
  },
  // Diagonal matches: the next game, or a fresh board right away if this one hasn't started.
  onDiagonalChange() {
    if (!clock.isStarted && !timeUp && !busy) newGame();
  },
  // Redraw every gem on the board in the new style; positions and state are unchanged.
  onGemStyleChange(style) {
    for (const el of els.values()) {
      // Popping gems are about to be removed; redrawing would restart their pop animation.
      if (!el.classList.contains('pop')) drawGem(el, undefined, style);
    }
  },
  // Static text is already translated; refresh what main.ts writes itself.
  onLanguageChange() {
    syncPauseButton();
    setScore(score);
    if (!gameOverEl.hidden) finalScoreEl.textContent = score.toLocaleString(settings.language);
  },
});
if (document.hidden) clock.hold('hidden', performance.now());
setInterval(updateClock, TICK_MS);

newGame();
