// Combo callouts (issue #34): which word, tags and time a cascade step shows.
// Pure: main.ts turns a Callout into text with t() and puts it in the toast.
import type { Special } from './board';
import type { MessageKey } from './i18n';

/** 0 = no word (step 1); 1–4 = Nice!, Great!, Superb!, Incredible!. */
export type ComboTier = 0 | 1 | 2 | 3 | 4;

/** How long a callout stays up; tier 4 and the move total stay longer. */
export const CALLOUT_MS = 1100;
export const LONG_CALLOUT_MS = 1400;
/** A move that ran at least this many steps shows its total once the board settles. */
export const MOVE_TOTAL_MIN_STEPS = 3;

const TIER_KEYS: Record<Exclude<ComboTier, 0>, MessageKey> = {
  1: 'comboNice',
  2: 'comboGreat',
  3: 'comboSuperb',
  4: 'comboIncredible',
};

/** The tier of cascade step `step` (1 = the move's first clear). */
export function comboTier(step: number): ComboTier {
  if (step < 2) return 0;
  return Math.min(step - 1, 4) as ComboTier;
}

/** The message key of a tier's word, or null for tier 0. */
export function calloutKey(tier: ComboTier): MessageKey | null {
  return tier === 0 ? null : TIER_KEYS[tier];
}

export function calloutMs(tier: ComboTier): number {
  return tier === 4 ? LONG_CALLOUT_MS : CALLOUT_MS;
}

export function showMoveTotal(steps: number): boolean {
  return steps >= MOVE_TOTAL_MIN_STEPS;
}

/** What one cascade step announces. */
export interface Callout {
  step: number;
  tier: ComboTier;
  /** The kinds of special the step made, each once, bomb first. */
  tags: Special[];
  /** Bonus seconds the step actually added (0 = none). */
  bonus: number;
}

/** The callout for a cascade step, or null when it has nothing to say. */
export function stepCallout(step: number, made: readonly { special: Special }[], bonus: number): Callout | null {
  const tier = comboTier(step);
  const tags = (['bomb', 'line'] as const).filter((kind) => made.some((m) => m.special === kind));
  if (tier === 0 && tags.length === 0 && bonus <= 0) return null;
  return { step, tier, tags, bonus: Math.max(0, bonus) };
}
