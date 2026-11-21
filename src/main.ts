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
  type Rng,
  type Special,
  type Spawn,
} from './board';
import { DEFAULT_CAST, drawCast, type AnimalCast } from './animals';
import { gemLabel, gemName } from './a11y';
import { msPerCell, popDelays, stepWaitMs } from './cascade';
import { beginDrag, inputBlocked, isActivateKey, moveFocus, ownsDrag, pickAction, swipeTarget, type Drag } from './input';
import { timingProperties, timingsFor, type Timings } from './motion';
import { LINE_BADGE_ANGLE, gemSvg, installGemDefs, type GemMark } from './gems';
import { t, type MessageKey } from './i18n';
import { initSettings } from './settings-ui';
import { installStandaloneZoomGuards } from './tap-guard';
import { Countdown, bonusSeconds, formatTime } from './timer';
import { canPause, shouldAutoPause } from './pause';
import { loadBest, saveBest } from './best';
import { DEFAULT_SETTINGS, type TimeLimit } from './settings';
import { CALLOUT_MS, LONG_CALLOUT_MS, calloutKey, calloutMs, showMoveTotal, stepCallout, type Callout } from './combo';
import {
  DAILY_MINUTES,
  dailyBest,
  dailyDate,
  formatDay,
  loadDaily,
  playedOn,
  recordDaily,
  saveDaily,
  seededRng,
  streakOn,
  twistFor,
  twistRules,
  type Twist,
} from './daily';

// ---- Timing (kept in sync with CSS through custom properties) ----
// Read again whenever the reduced-motion preference changes (issue #38).
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let motion: Timings = timingsFor(reducedQuery.matches);
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
function applyMotion(): void {
  for (const [name, value] of Object.entries(timingProperties(motion))) root.style.setProperty(name, value);
}
applyMotion();
reducedQuery.addEventListener('change', () => {
  motion = timingsFor(reducedQuery.matches);
  applyMotion();
});

// ---- DOM ----
const boardEl = document.querySelector<HTMLDivElement>('#board')!;
const scoreEl = document.querySelector<HTMLSpanElement>('#score')!;
const bestEl = document.querySelector<HTMLSpanElement>('#best')!;
const bestLabel = document.querySelector<HTMLSpanElement>('#best-label')!;
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
const dailyBtn = document.querySelector<HTMLButtonElement>('#daily')!;
const freePlayBtn = document.querySelector<HTMLButtonElement>('#free-play')!;
const dailyTitleEl = document.querySelector<HTMLParagraphElement>('#daily-title')!;
const dailyTitleText = document.querySelector<HTMLSpanElement>('#daily-title-text')!;
const todayBestEl = document.querySelector<HTMLParagraphElement>('#today-best')!;
const streakEl = document.querySelector<HTMLParagraphElement>('#streak')!;
const streakText = document.querySelector<HTMLSpanElement>('#streak-text')!;
const pausedEl = document.querySelector<HTMLDivElement>('#paused')!;
const resumeBtn = document.querySelector<HTMLButtonElement>('#resume')!;
const scoreLiveEl = document.querySelector<HTMLDivElement>('#score-live')!;

// ---- State ----
/** Free play follows the Settings; a daily (issue #36) is today's seeded 3-minute round. */
type Mode = 'free' | 'daily';
let mode: Mode = 'free';
let roundDate = ''; // a daily's date (the day it started), 'YYYY-MM-DD'
let roundRng: Rng = Math.random; // board, refills, shuffles and cast: seeded in a daily
let roundBombChance = BOMB_SPAWN_CHANCE;
let streakCount = 0; // the streak shown on a daily's game-over card
let grid: Grid = [];
let score = 0;
let roundLimit: TimeLimit = DEFAULT_SETTINGS.timeLimit; // this round's length; set by setRoundLimit()
let roundDiagonal = DEFAULT_SETTINGS.diagonal; // this round's mode (issue #30); set by setRoundLimit()
let best = 0; // free play: best for roundLimit minutes in this mode (issues #22, #30); daily: today's best
let busy = false;
let selected: Pos | null = null;
let hintTimer = 0;
let gameToken = 0; // bumps on new game so in-flight cascades stop touching the board
const clock = new Countdown(0); // round timer; starts on the first swap
let timeUp = false; // the clock ran out: no more input
let paused = false; // the player paused (or the page was hidden): no input, clock held
let bestAtStart = 0; // to tell whether this round set a new best
const els = new Map<number, HTMLDivElement>();
let drag: Drag | null = null; // the press in progress: one pointer at a time (issue #38)
let focusPos: Pos = { row: 0, col: 0 }; // the board's one tab stop (roving tabindex)
let keyboardMode = false; // the last input was the keyboard: keep focus on the board
let announcedScore = 0; // what the score live region last said

/** True while a swap/cascade runs, time is up or the game is paused. */
const blocked = (): boolean => inputBlocked({ busy, timeUp, paused });

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const storage = () => window.localStorage;

// ---- Settings ----
// Created before anything that reads `settings`, so no function can run ahead of it.
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
  // A daily is always 3 minutes: the limit waits for the next free-play game.
  onTimeLimitChange(minutes) {
    if (mode === 'free' && !clock.isStarted && !timeUp) {
      clock.reset(minutes * 60_000);
      setRoundLimit(minutes);
      updateClock();
    }
  },
  // Diagonal matches: the next game, or a fresh board right away if this one hasn't started.
  // A daily's twist decides diagonal matches, so the setting waits for free play.
  onDiagonalChange() {
    if (mode === 'free' && !clock.isStarted && !timeUp && !busy) newGame('free');
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
    for (const el of els.values()) labelGem(el);
    if (!gameOverEl.hidden) {
      finalScoreEl.textContent = score.toLocaleString(settings.language);
      fillDailyCard();
    }
  },
});

/** The match rules of this round: diagonal matches on or off (issue #30). */
const matchOpts = (): MatchOptions => ({ diagonal: roundDiagonal });

/** Sets the round length and match mode; the HUD then shows the best this round can beat. */
function setRoundLimit(minutes: TimeLimit, diagonal = roundDiagonal): void {
  roundLimit = minutes;
  roundDiagonal = diagonal;
  setRoundBest();
}

/**
 * Loads the best this round can beat: the free-play best for its length and mode, or
 * today's daily best. Best's icon is a trophy in free play and a calendar in a daily.
 */
function setRoundBest(): void {
  best = mode === 'daily' ? dailyBest(loadDaily(storage), roundDate) : loadBest(storage, roundLimit, roundDiagonal);
  bestAtStart = best;
  const label: MessageKey = mode === 'daily' ? 'todayBestLabel' : 'best';
  bestLabel.dataset.mode = mode;
  bestLabel.dataset.i18nLabel = label; // a language switch re-translates it
  bestLabel.setAttribute('aria-label', t(settings.language, label));
  setScore(score);
}

// ---- Rendering ----
/** This game's animals (Animals gem style): drawn afresh by newGame(). */
let animalCast: AnimalCast = DEFAULT_CAST;

function createGemEl(gem: Gem, row: number, col: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'gem';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-pressed', 'false');
  el.tabIndex = -1;
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
  labelGem(el, style);
}

/** The gem's accessible name: what it is, its special kind and where it is (issue #38). */
function labelGem(el: HTMLDivElement, style = settings.gemStyle): void {
  if (el.dataset.row === undefined) return; // not placed yet; place() labels it
  const name = gemName(settings.language, Number(el.dataset.type), style, animalCast);
  el.setAttribute('aria-label', gemLabel(settings.language, name, markOf(el), Number(el.dataset.row), Number(el.dataset.col)));
}

function place(el: HTMLDivElement, row: number, col: number): void {
  const prevRow = Number(el.dataset.row ?? row);
  const drop = Math.max(0, row - prevRow);
  el.style.transitionDuration = drop > 0 ? `${motion.fallBaseMs + drop * motion.fallPerRowMs}ms` : '';
  el.dataset.row = String(row);
  el.dataset.col = String(col);
  el.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
  labelGem(el);
}

/** Moves every gem element to its grid position (CSS transitions animate it). */
function render(): void {
  for (let r = 0; r < rowsOf(grid); r++) {
    for (let c = 0; c < colsOf(grid); c++) {
      const gem = grid[r][c];
      if (!gem) continue;
      const el = els.get(gem.id) ?? createGemEl(gem, r, c);
      if (el.dataset.row !== String(r) || el.dataset.col !== String(c)) place(el, r, c);
      el.tabIndex = r === focusPos.row && c === focusPos.col ? 0 : -1;
    }
  }
}

function addSpawns(spawns: Spawn[]): void {
  for (const s of spawns) createGemEl(s.gem, s.fromRow, s.pos.col);
  void boardEl.offsetHeight; // commit start positions so the fall animates
}

function rebuildBoard(): void {
  boardEl.querySelectorAll('.gem, .blast, .beam, .float').forEach((el) => el.remove());
  els.clear();
  render();
}

function elAt(p: Pos): HTMLDivElement | undefined {
  const gem = grid[p.row]?.[p.col];
  return gem ? els.get(gem.id) : undefined;
}

/** Tells screen readers the score once per move, politely, apart from the callout toast. */
function announceScore(): void {
  if (score === announcedScore) return;
  announcedScore = score;
  scoreLiveEl.textContent = t(settings.language, 'scoreAnnounce', { n: score.toLocaleString(settings.language) });
}

function setScore(value: number): void {
  score = value;
  scoreEl.textContent = score.toLocaleString(settings.language);
  if (score > best) {
    best = score;
    // A daily's result is saved at game over (recordDaily), never as a free-play best.
    if (mode === 'free') saveBest(storage, roundLimit, best, roundDiagonal);
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
function setSelectedEl(el: HTMLDivElement | undefined, on: boolean): void {
  el?.classList.toggle('selected', on);
  el?.setAttribute('aria-pressed', String(on));
}

function select(p: Pos | null): void {
  if (selected) setSelectedEl(elAt(selected), false);
  selected = p;
  if (selected) setSelectedEl(elAt(selected), true);
}

function clearHint(): void {
  boardEl.querySelectorAll('.hint').forEach((el) => el.classList.remove('hint'));
}

function showHint(): void {
  if (blocked()) return;
  clearHint();
  const move = findMove(grid, matchOpts());
  if (!move) return;
  for (const p of move) elAt(p)?.classList.add('hint');
}

/** Drops any hint and stops the idle timer that would show the next one. */
function clearIdle(): void {
  clearTimeout(hintTimer);
  clearHint();
}

/** Drops the selection, the press in progress and the hint: round over, paused, or a new game. */
function clearInteraction(): void {
  select(null);
  drag = null;
  clearIdle();
}

function resetIdle(): void {
  clearIdle();
  hintTimer = window.setTimeout(showHint, HINT_DELAY_MS);
}

// ---- Game flow ----
async function trySwap(a: Pos, b: Pos): Promise<void> {
  updateClock(); // the tick may lag the clock by up to TICK_MS
  if (blocked()) return;
  busy = true;
  const token = gameToken;
  clock.start(performance.now());
  syncPauseButton();
  select(null);
  resetIdle();

  swap(grid, a, b);
  render();
  await wait(motion.swapMs);
  if (token !== gameToken) return;

  if (findRuns(grid, matchOpts()).length === 0) {
    // Not a match: bounce back.
    swap(grid, a, b);
    render();
    elAt(a)?.classList.add('nope');
    elAt(b)?.classList.add('nope');
    await wait(motion.swapMs);
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
  announceScore();
  // A keyboard player's focused gem may have been replaced during the cascade.
  if (keyboardMode) elAt(focusPos)?.focus({ preventScroll: true });
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
      setTimeout(() => el.classList.remove('special-made'), motion.popMs);
    }

    // Beamed gems pop as the beam's front reaches them (issue #32): the strip
    // (1.5 board widths each way) grows over 75% of motion.popMs.
    const reach = motion.reduced ? new Map<string, number>() : beamReach(grid, plan.fired);
    const { delays, lastPop } = popDelays(cells, reach, msPerCell(motion.popMs, colsOf(grid)));
    const popping: HTMLDivElement[] = [];
    cells.forEach((p, i) => {
      const el = elAt(p);
      if (!el) return;
      el.style.setProperty('--pop-delay', `${delays[i]}ms`);
      el.classList.add('pop');
      popping.push(el);
    });
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

    // A blast (and, under reduced motion, a beam's flash) runs motion.blastMs; a beam's
    // sweep takes one pop, and its farthest gem pops lastPop ms in.
    const flashing = plan.detonated.length > 0 || (motion.reduced && plan.fired.length > 0);
    await wait(stepWaitMs(motion.popMs, lastPop, flashing, motion.blastMs));
    if (token !== gameToken) return false;

    for (const el of popping) {
      els.delete(Number(el.dataset.id));
      el.remove();
    }
    clearCells(grid, cells);
    const spawns = collapse(grid, roundRng, roundBombChance);
    addSpawns(spawns);
    render();
    await wait(motion.fallBaseMs + rowsOf(grid) * motion.fallPerRowMs);
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
    // false: it had to make a new board, whose gems have no elements yet (issue #38).
    const kept = shuffle(grid, roundRng, matchOpts());
    boardEl.classList.add('shuffling');
    if (kept) render();
    else rebuildBoard();
    await wait(motion.swapMs * 2);
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
  clearInteraction();
  if (!busy) showGameOver();
}

function showGameOver(): void {
  clearIdle();
  announceScore();
  finalScoreEl.textContent = score.toLocaleString(settings.language);
  newBestEl.hidden = !(score > bestAtStart && score > 0);
  const daily = mode === 'daily';
  if (daily) {
    // A finished daily counts for the day it started on, even after midnight.
    const rec = recordDaily(loadDaily(storage), roundDate, score);
    saveDaily(storage, rec);
    streakCount = streakOn(rec, roundDate);
  }
  // Describe the card by what it shows: the daily lines only in a daily.
  gameOverEl.setAttribute('aria-describedby', daily ? 'daily-title final-score-line new-best today-best streak' : 'final-score-line new-best');
  dailyTitleEl.hidden = !daily;
  todayBestEl.hidden = !daily;
  streakEl.hidden = !daily;
  freePlayBtn.hidden = !daily;
  fillDailyCard();
  gameOverEl.hidden = false;
  syncDailyButton();
  playAgainBtn.focus();
}

/** The daily lines of the game-over card, in the current language. */
function fillDailyCard(): void {
  if (mode !== 'daily') return;
  const lang = settings.language;
  dailyTitleText.textContent = t(lang, 'dailyTitle', { day: formatDay(roundDate, lang, 'short') });
  todayBestEl.textContent = t(lang, 'todayBest', { n: best.toLocaleString(lang) });
  streakText.textContent = t(lang, 'streak', { n: streakCount });
}

const TWIST_KEYS: Record<Twist, MessageKey> = {
  classic: 'twistClassic',
  diagonal: 'twistDiagonal',
  bombRain: 'twistBombRain',
  both: 'twistBoth',
};
const twistKey = (twist: Twist): MessageKey => TWIST_KEYS[twist];

/** A daily's start callout: "Daily · Tuesday" over the day's twist. */
function announceDaily(): void {
  const lang = settings.language;
  toast(
    { word: t(lang, 'dailyTitle', { day: formatDay(roundDate, lang, 'long') }), tier: '0', extra: t(lang, twistKey(twistFor(roundDate))) },
    LONG_CALLOUT_MS,
  );
}

/**
 * Daily button: highlighted while a daily is on (data-mode; not aria-pressed, since
 * pressing it again restarts the daily rather than turning it off), and a dot until
 * today's daily has been finished, which its label says too.
 */
function syncDailyButton(): void {
  const unplayed = !playedOn(loadDaily(storage), dailyDate(new Date()));
  const label: MessageKey = unplayed ? 'dailyUnplayed' : 'dailyChallenge';
  dailyBtn.dataset.mode = mode;
  dailyBtn.dataset.unplayed = String(unplayed);
  dailyBtn.dataset.i18nLabel = label; // a language switch re-translates it
  dailyBtn.setAttribute('aria-label', t(settings.language, label));
  dailyBtn.title = t(settings.language, label);
}

/**
 * Starts a round. Free play takes its length and match mode from the Settings; a daily
 * (issue #36) is 3 minutes with the weekday's twist, and its cast, board, refills and
 * shuffles all come from the day's seeded generator, so every player gets the same.
 */
function newGame(next: Mode = 'free'): void {
  gameToken++;
  busy = false;
  timeUp = false;
  clearInteraction();
  announcedScore = 0;
  scoreLiveEl.textContent = '';
  gameOverEl.hidden = true;
  mode = next;
  const { rows, cols } = currentLayout();
  let minutes: TimeLimit = settings.timeLimit;
  let diagonal = settings.diagonal;
  if (mode === 'daily') {
    roundDate = dailyDate(new Date());
    const rules = twistRules(twistFor(roundDate));
    roundRng = seededRng(roundDate, rows, cols);
    roundBombChance = rules.bombChance;
    minutes = DAILY_MINUTES;
    diagonal = rules.diagonal;
  } else {
    roundRng = Math.random;
    roundBombChance = BOMB_SPAWN_CHANCE;
  }
  // Reset the clock before unpausing: setPaused() runs updateClock(), which would
  // otherwise see the previous round's expired clock and end this one at once.
  clock.reset(minutes * 60_000);
  setPaused(false);
  // Seven of the eight animals, in a random order, for every new game (issue #20).
  animalCast = drawCast(roundRng);
  // Score first: setRoundLimit() shows it, and could save the old one as a best.
  // The mode is fixed for the round before the board is made (issue #30).
  score = 0;
  setRoundLimit(minutes, diagonal);
  grid = createBoard(rows, cols, roundRng, matchOpts());
  document.body.style.setProperty('--rows', String(rows));
  document.body.style.setProperty('--cols', String(cols));
  rebuildBoard();
  resetIdle();
  updateClock();
  syncPauseButton();
  syncDailyButton();
  if (mode === 'daily') announceDaily();
  else toastEl.classList.remove('show');
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
  const label = t(settings.language, paused ? 'resume' : 'pause');
  pauseBtn.setAttribute('aria-label', label);
  pauseBtn.title = label;
}

function setPaused(on: boolean): void {
  paused = on;
  if (on) {
    clock.hold('paused', performance.now());
    clearInteraction();
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

// ---- Input: tap-to-select, swipe, or the keyboard ----
// Rules live in input.ts. One pointer owns a press at a time, and only the primary
// button starts one (issue #38).
function gemEl(target: EventTarget | null): HTMLDivElement | null {
  return target instanceof Element ? target.closest<HTMLDivElement>('.gem') : null;
}

const cellOf = (el: HTMLDivElement): Pos => ({ row: Number(el.dataset.row), col: Number(el.dataset.col) });

function posFromEvent(e: PointerEvent): Pos | null {
  const el = gemEl(e.target);
  if (!el || el.classList.contains('pop')) return null;
  return cellOf(el);
}

/** Picks a gem: selects it, unselects it, or swaps it with the adjacent selected one. */
function choose(pos: Pos): void {
  resetIdle();
  const action = pickAction(selected, pos);
  if (action.kind === 'deselect') select(null);
  else if (action.kind === 'swap') void trySwap(action.from, action.to);
  else select(action.pos);
}

function focusCell(p: Pos): void {
  focusPos = p;
  render(); // moves the roving tab stop
  elAt(p)?.focus({ preventScroll: true });
}

boardEl.addEventListener('pointerdown', (e) => {
  const pos = posFromEvent(e);
  if (!pos || blocked()) return;
  const next = beginDrag(drag, e, pos);
  if (!next || next === drag) return;
  drag = next;
  keyboardMode = false;
  focusPos = pos;
  boardEl.setPointerCapture(e.pointerId);
});

boardEl.addEventListener('pointermove', (e) => {
  if (!ownsDrag(drag, e.pointerId)) return;
  const threshold = boardEl.clientWidth / colsOf(grid) / 3;
  const to = swipeTarget(drag.pos, e.clientX - drag.x, e.clientY - drag.y, threshold, rowsOf(grid), colsOf(grid));
  if (to === undefined) return;
  const from = drag.pos;
  drag = null;
  if (to) void trySwap(from, to);
});

boardEl.addEventListener('pointerup', (e) => {
  if (!ownsDrag(drag, e.pointerId)) return; // a swipe already handled it, or another pointer
  const pos = drag.pos;
  drag = null;
  if (blocked()) return;
  choose(pos);
});

boardEl.addEventListener('pointercancel', (e) => {
  if (ownsDrag(drag, e.pointerId)) drag = null;
});

boardEl.addEventListener('keydown', (e) => {
  const el = gemEl(e.target);
  if (!el || e.altKey || e.ctrlKey || e.metaKey) return;
  const from = cellOf(el);
  const next = moveFocus(from, e.key, rowsOf(grid), colsOf(grid));
  if (next) {
    e.preventDefault();
    keyboardMode = true;
    focusCell(next);
  } else if (isActivateKey(e.key)) {
    e.preventDefault(); // Space would scroll the page
    keyboardMode = true;
    if (!blocked() && !el.classList.contains('pop')) choose(from);
  } else if (e.key === 'Escape' && selected) {
    select(null);
  }
});

hintBtn.addEventListener('click', showHint);
newGameBtn.addEventListener('click', () => newGame('free'));
dailyBtn.addEventListener('click', () => newGame('daily'));
playAgainBtn.addEventListener('click', () => newGame(mode));
freePlayBtn.addEventListener('click', () => newGame('free'));
pauseBtn.addEventListener('click', () => (paused ? resume() : pause()));
resumeBtn.addEventListener('click', resume);

// Crossing the phone/desktop breakpoint swaps the board shape, but only before the
// first move, so resizing or rotating never throws away a game in progress.
compactQuery.addEventListener('change', () => {
  if (!clock.isStarted && !busy) newGame(mode);
});

// The clock pauses while the settings dialog is open or the page is hidden. Hiding the
// page (switching tabs, minimising the home-screen app) also pauses a running round,
// so coming back shows the Paused screen instead of jumping straight into play.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clock.hold('hidden', performance.now());
  else clock.release('hidden', performance.now());
  if (!document.hidden) syncDailyButton(); // the date may have moved on
  if (shouldAutoPause(roundState(), document.hidden)) pause();
  updateClock();
});
// iOS home-screen apps may skip visibilitychange when backgrounded; pagehide still fires.
window.addEventListener('pagehide', () => {
  if (shouldAutoPause(roundState(), true)) pause();
});

if (document.hidden) clock.hold('hidden', performance.now());
setInterval(updateClock, TICK_MS);
setInterval(syncDailyButton, 60_000); // a new day brings the dot back, even with the tab left open

newGame();
