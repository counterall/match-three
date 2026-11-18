// Daily challenge (issue #36): one seeded 3-minute round per local date, with a
// weekday twist, a best score per day and a streak of consecutive days played.
// Pure apart from the storage passed in; tested in daily.test.ts.
//
// Dates are local calendar dates as 'YYYY-MM-DD' strings. Date arithmetic on them
// goes through UTC midnights, so it never depends on the time zone or DST.

import { BOMB_SPAWN_CHANCE, type Rng } from './board';
import type { Language } from './i18n';
import type { TimeLimit } from './settings';

/** Every daily round is this long, whatever the Settings say. */
export const DAILY_MINUTES: TimeLimit = 3;

/** Bomb rain days: random bombs three times as often as usual (1/4 per refill). */
export const BOMB_RAIN_CHANCE = BOMB_SPAWN_CHANCE * 3;

export type Twist = 'classic' | 'diagonal' | 'bombRain' | 'both';

/** Twist per weekday, Sunday first (Date#getUTCDay order). */
const WEEK: readonly Twist[] = ['both', 'classic', 'diagonal', 'bombRain', 'classic', 'diagonal', 'bombRain'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** Today's local calendar date (the daily's date) as 'YYYY-MM-DD'. */
export function dailyDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const utcMs = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));

/** True for a real calendar date written as 'YYYY-MM-DD'. */
export function isDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value) && new Date(utcMs(value)).toISOString().slice(0, 10) === value;
}

/** The date `n` days after `date` (negative: before). */
export function addDays(date: string, n: number): string {
  return new Date(utcMs(date) + n * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(utcMs(date)).getUTCDay();
}

export function twistFor(date: string): Twist {
  return WEEK[weekdayOf(date)];
}

export function twistRules(twist: Twist): { diagonal: boolean; bombChance: number } {
  return {
    diagonal: twist === 'diagonal' || twist === 'both',
    bombChance: twist === 'bombRain' || twist === 'both' ? BOMB_RAIN_CHANCE : BOMB_SPAWN_CHANCE,
  };
}

/**
 * The random numbers of `date`'s daily on a rows×cols board: the same for every
 * player, so everyone starts from the same board and gets the same refills for the
 * same moves. A 32-bit string hash (FNV-1a) seeds a mulberry32 generator.
 */
export function seededRng(date: string, rows: number, cols: number): Rng {
  let h = 0x811c9dc5;
  for (const ch of `neon-cascade:daily:${date}:${rows}x${cols}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The date in the UI language: 'long' = weekday ("Wednesday"), 'short' = "Wed 18 Nov". */
export function formatDay(date: string, lang: Language, style: 'long' | 'short'): string {
  const opts: Intl.DateTimeFormatOptions =
    style === 'long' ? { weekday: 'long', timeZone: 'UTC' } : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, opts).format(new Date(utcMs(date))).replace(',', '');
}

// ---- Saved results ----

/** Storage key for the daily results; nothing else of the game's is stored there. */
export const DAILY_KEY = 'neon-cascade:daily';
/** Days whose best is kept; older ones are dropped (the streak is kept on its own). */
export const DAILY_KEEP_DAYS = 60;

export interface DailyRecord {
  /** Best score per date played (a finished round, even with 0 points). */
  days: Record<string, number>;
  /** The latest run of consecutive days played. */
  streak: { last: string; count: number } | null;
}

export function parseDaily(raw: string | null): DailyRecord {
  const rec: DailyRecord = { days: {}, streak: null };
  let data: unknown;
  try {
    data = JSON.parse(raw ?? '');
  } catch {
    return rec;
  }
  if (!data || typeof data !== 'object' || (data as { v?: unknown }).v !== 1) return rec;
  const { days, streak } = data as { days?: unknown; streak?: unknown };
  if (days && typeof days === 'object') {
    for (const [date, score] of Object.entries(days)) {
      if (isDate(date) && typeof score === 'number' && Number.isFinite(score) && score >= 0) rec.days[date] = Math.floor(score);
    }
  }
  if (streak && typeof streak === 'object') {
    const { last, count } = streak as { last?: unknown; count?: unknown };
    if (isDate(last) && typeof count === 'number' && Number.isInteger(count) && count > 0) rec.streak = { last, count };
  }
  return rec;
}

export function serializeDaily(rec: DailyRecord): string {
  return JSON.stringify({ v: 1, days: rec.days, streak: rec.streak });
}

export function dailyBest(rec: DailyRecord, date: string): number {
  return rec.days[date] ?? 0;
}

export function playedOn(rec: DailyRecord, date: string): boolean {
  return date in rec.days;
}

/**
 * Records a finished daily round of `date` (the date it started on) and returns the
 * new record: the day's best only goes up, the streak grows by one on the day after
 * its last day, stays on a replay, and starts again at 1 after a gap. Days older than
 * DAILY_KEEP_DAYS before the latest one are dropped.
 */
export function recordDaily(rec: DailyRecord, date: string, score: number): DailyRecord {
  const days = { ...rec.days, [date]: Math.max(rec.days[date] ?? 0, Math.max(0, Math.floor(score))) };
  let streak = rec.streak;
  if (!streak || date > streak.last) {
    streak = { last: date, count: streak && addDays(streak.last, 1) === date ? streak.count + 1 : 1 };
  }
  const latest = Object.keys(days).reduce((a, b) => (b > a ? b : a));
  const oldest = addDays(latest, -(DAILY_KEEP_DAYS - 1));
  for (const d of Object.keys(days)) if (d < oldest) delete days[d];
  return { days, streak };
}

/** The streak as it stands on `today`: alive if its last day is today or yesterday, else 0. */
export function streakOn(rec: DailyRecord, today: string): number {
  const s = rec.streak;
  return s && (s.last === today || addDays(s.last, 1) === today) ? s.count : 0;
}

/** The parts of `Storage` used here. */
export interface DailyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** `getStore` is a function because merely reading `window.localStorage` can throw. */
export function loadDaily(getStore: () => DailyStore): DailyRecord {
  try {
    return parseDaily(getStore().getItem(DAILY_KEY));
  } catch {
    return parseDaily(null);
  }
}

export function saveDaily(getStore: () => DailyStore, rec: DailyRecord): void {
  try {
    getStore().setItem(DAILY_KEY, serializeDaily(rec));
  } catch {
    // Storage full or blocked: the result just isn't kept.
  }
}
