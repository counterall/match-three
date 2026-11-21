// Timing choices for one clearing step, pure and tested in cascade.test.ts (issue #38).

import type { Pos } from './board';

/** A beam's strip grows over 75% of the pop and reaches 1.5 board widths each way. */
export function msPerCell(popMs: number, cols: number): number {
  return (popMs * 0.75) / (1.5 * cols);
}

/**
 * Each cleared cell's pop delay (ms): beamed gems wait for the beam's front (`reach`
 * is in cell widths, keyed "row,col"), the rest pop at once. `lastPop` is the longest delay.
 */
export function popDelays(cells: Pos[], reach: Map<string, number>, perCellMs: number): { delays: number[]; lastPop: number } {
  const delays = cells.map((p) => Math.round((reach.get(`${p.row},${p.col}`) ?? 0) * perCellMs));
  return { delays, lastPop: delays.reduce((m, d) => Math.max(m, d), 0) };
}

/**
 * How long a clearing step waits before removing its gems: a pop (plus the farthest
 * beamed gem's delay), or a blast's / reduced-motion beam's flash if that is longer.
 */
export function stepWaitMs(popMs: number, lastPop: number, flashing: boolean, blastMs: number): number {
  return Math.max(popMs + lastPop, flashing ? blastMs : 0);
}
