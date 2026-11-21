import { describe, expect, it } from 'vitest';
import { beginDrag, inputBlocked, isActivateKey, moveFocus, ownsDrag, pickAction, swipeTarget, type PointerInfo } from './input';

const down = (o: Partial<PointerInfo> = {}): PointerInfo => ({ pointerId: 1, button: 0, isPrimary: true, clientX: 10, clientY: 20, ...o });
const pos = { row: 2, col: 3 };

describe('inputBlocked', () => {
  it('blocks when busy, time is up or paused, and only then', () => {
    expect(inputBlocked({ busy: false, timeUp: false, paused: false })).toBe(false);
    expect(inputBlocked({ busy: true, timeUp: false, paused: false })).toBe(true);
    expect(inputBlocked({ busy: false, timeUp: true, paused: false })).toBe(true);
    expect(inputBlocked({ busy: false, timeUp: false, paused: true })).toBe(true);
  });
});

describe('beginDrag', () => {
  it('starts a drag with the primary button of a primary pointer', () => {
    expect(beginDrag(null, down(), pos)).toEqual({ pointerId: 1, pos, x: 10, y: 20 });
  });

  it('ignores the right and middle buttons and non-primary pointers', () => {
    expect(beginDrag(null, down({ button: 2 }), pos)).toBeNull();
    expect(beginDrag(null, down({ button: 1 }), pos)).toBeNull();
    expect(beginDrag(null, down({ isPrimary: false, pointerId: 2 }), pos)).toBeNull();
  });

  it('keeps the first pointer when a second one presses', () => {
    const first = beginDrag(null, down(), pos)!;
    expect(beginDrag(first, down({ pointerId: 2, isPrimary: false }), { row: 0, col: 0 })).toBe(first);
    expect(beginDrag(first, down({ pointerId: 2 }), { row: 0, col: 0 })).toBe(first);
  });
});

describe('ownsDrag', () => {
  it('matches only the pointer that started the drag', () => {
    const d = beginDrag(null, down({ pointerId: 7 }), pos);
    expect(ownsDrag(d, 7)).toBe(true);
    expect(ownsDrag(d, 8)).toBe(false);
    expect(ownsDrag(null, 7)).toBe(false);
  });
});

describe('swipeTarget', () => {
  it('waits below the threshold', () => {
    expect(swipeTarget(pos, 5, -4, 10, 8, 8)).toBeUndefined();
  });
  it('picks the dominant axis and its sign', () => {
    expect(swipeTarget(pos, 12, 3, 10, 8, 8)).toEqual({ row: 2, col: 4 });
    expect(swipeTarget(pos, -12, 3, 10, 8, 8)).toEqual({ row: 2, col: 2 });
    expect(swipeTarget(pos, 3, 12, 10, 8, 8)).toEqual({ row: 3, col: 3 });
    expect(swipeTarget(pos, 3, -12, 10, 8, 8)).toEqual({ row: 1, col: 3 });
  });
  it('is null off the board', () => {
    expect(swipeTarget({ row: 0, col: 0 }, -20, 0, 10, 8, 8)).toBeNull();
    expect(swipeTarget({ row: 0, col: 0 }, 0, -20, 10, 8, 8)).toBeNull();
    expect(swipeTarget({ row: 7, col: 5 }, 0, 20, 10, 8, 6)).toBeNull();
    expect(swipeTarget({ row: 7, col: 5 }, 20, 0, 10, 8, 6)).toBeNull();
  });
});

describe('moveFocus', () => {
  it('moves one cell per arrow and stops at the edges', () => {
    expect(moveFocus(pos, 'ArrowUp', 8, 6)).toEqual({ row: 1, col: 3 });
    expect(moveFocus(pos, 'ArrowDown', 8, 6)).toEqual({ row: 3, col: 3 });
    expect(moveFocus(pos, 'ArrowLeft', 8, 6)).toEqual({ row: 2, col: 2 });
    expect(moveFocus(pos, 'ArrowRight', 8, 6)).toEqual({ row: 2, col: 4 });
    expect(moveFocus({ row: 0, col: 0 }, 'ArrowUp', 8, 6)).toEqual({ row: 0, col: 0 });
    expect(moveFocus({ row: 7, col: 5 }, 'ArrowRight', 8, 6)).toEqual({ row: 7, col: 5 });
  });
  it('ignores other keys', () => {
    expect(moveFocus(pos, 'a', 8, 6)).toBeNull();
    expect(moveFocus(pos, 'Enter', 8, 6)).toBeNull();
  });
});

describe('activation and picking', () => {
  it('Enter and Space activate', () => {
    expect(isActivateKey('Enter')).toBe(true);
    expect(isActivateKey(' ')).toBe(true);
    expect(isActivateKey('a')).toBe(false);
  });
  it('selects, deselects and swaps with an adjacent selection', () => {
    expect(pickAction(null, pos)).toEqual({ kind: 'select', pos });
    expect(pickAction(pos, pos)).toEqual({ kind: 'deselect' });
    expect(pickAction(pos, { row: 2, col: 4 })).toEqual({ kind: 'swap', from: pos, to: { row: 2, col: 4 } });
    expect(pickAction(pos, { row: 3, col: 4 })).toEqual({ kind: 'select', pos: { row: 3, col: 4 } });
    expect(pickAction(pos, { row: 2, col: 5 })).toEqual({ kind: 'select', pos: { row: 2, col: 5 } });
  });
});
