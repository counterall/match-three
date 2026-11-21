// Input rules for the board, pure and tested in input.test.ts (issue #38): when input is
// blocked, which pointer owns a drag, where a swipe goes, and keyboard navigation.

import type { Pos } from './board';

export interface RoundGate {
  busy: boolean;
  timeUp: boolean;
  paused: boolean;
}

/** True while a swap/cascade runs, time is up, or the game is paused. */
export const inputBlocked = (g: RoundGate): boolean => g.busy || g.timeUp || g.paused;

/** A press on a gem: where it started and which pointer made it. */
export interface Drag {
  pointerId: number;
  pos: Pos;
  x: number;
  y: number;
}

export interface PointerInfo {
  pointerId: number;
  button: number;
  isPrimary: boolean;
  clientX: number;
  clientY: number;
}

/**
 * The drag after a pointerdown: only the primary button of a primary pointer starts one,
 * and while one is in progress another pointer (a second finger, a right-click) is ignored.
 */
export function beginDrag(current: Drag | null, e: PointerInfo, pos: Pos): Drag | null {
  if (current) return current;
  if (e.button !== 0 || !e.isPrimary) return null;
  return { pointerId: e.pointerId, pos, x: e.clientX, y: e.clientY };
}

/** Whether an event belongs to the pointer that owns the drag. */
export const ownsDrag = (drag: Drag | null, pointerId: number): drag is Drag => drag !== null && drag.pointerId === pointerId;

/**
 * Where a swipe of (dx, dy) from `from` leads: undefined while it is shorter than
 * `threshold` (keep dragging), null when it points off the board, else the target cell.
 */
export function swipeTarget(from: Pos, dx: number, dy: number, threshold: number, rows: number, cols: number): Pos | null | undefined {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return undefined;
  const to = Math.abs(dx) > Math.abs(dy) ? { row: from.row, col: from.col + Math.sign(dx) } : { row: from.row + Math.sign(dy), col: from.col };
  return to.row >= 0 && to.row < rows && to.col >= 0 && to.col < cols ? to : null;
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/** The cell an arrow key moves keyboard focus to (stopping at the edges), or null for other keys. */
export function moveFocus(pos: Pos, key: string, rows: number, cols: number): Pos | null {
  const step = ARROWS[key];
  if (!step) return null;
  return {
    row: Math.min(rows - 1, Math.max(0, pos.row + step[0])),
    col: Math.min(cols - 1, Math.max(0, pos.col + step[1])),
  };
}

/** Enter and Space pick up or put down the focused gem. */
export const isActivateKey = (key: string): boolean => key === 'Enter' || key === ' ' || key === 'Spacebar';

/** What choosing `pos` does given the current selection: select, deselect, or swap with it. */
export type PickAction = { kind: 'select'; pos: Pos } | { kind: 'deselect' } | { kind: 'swap'; from: Pos; to: Pos };

export function pickAction(selected: Pos | null, pos: Pos): PickAction {
  if (selected && selected.row === pos.row && selected.col === pos.col) return { kind: 'deselect' };
  if (selected && Math.abs(selected.row - pos.row) + Math.abs(selected.col - pos.col) === 1) return { kind: 'swap', from: selected, to: pos };
  return { kind: 'select', pos };
}
