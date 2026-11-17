// Best scores, kept separately for each round length (issue #22): a best set in a
// 10-minute game says nothing about a 3-minute one. Pure apart from the storage
// passed in, tested in best.test.ts.

import type { TimeLimit } from './settings';

/**
 * The single best score saved before issue #22. Its round length is unknown, so it
 * is not carried over to any limit; it is left in storage untouched.
 */
export const LEGACY_BEST_KEY = 'neon-cascade:best';

/** Storage key for the best score of rounds of `minutes` minutes. */
export function bestKey(minutes: TimeLimit): string {
  return `neon-cascade:best:${minutes}m`;
}

/** The parts of `Storage` used here. */
export interface BestStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** A saved best as a whole, non-negative number; anything else counts as 0. */
export function parseBest(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * `getStore` is a function because merely reading `window.localStorage` can throw
 * (e.g. storage blocked), and that must be caught too.
 */
export function loadBest(getStore: () => BestStore, minutes: TimeLimit): number {
  try {
    return parseBest(getStore().getItem(bestKey(minutes)));
  } catch {
    return 0;
  }
}

export function saveBest(getStore: () => BestStore, minutes: TimeLimit, value: number): void {
  try {
    getStore().setItem(bestKey(minutes), String(value));
  } catch {
    /* storage unavailable; the best score just won't persist */
  }
}
