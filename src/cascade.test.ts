import { describe, expect, it } from 'vitest';
import { msPerCell, popDelays, stepWaitMs } from './cascade';

describe('cascade timing (issue #38)', () => {
  it('msPerCell spreads 75% of a pop over 1.5 board widths', () => {
    expect(msPerCell(280, 8)).toBeCloseTo((280 * 0.75) / 12);
  });

  it('popDelays: gems with no beam pop at once, beamed ones wait for the front', () => {
    const cells = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }];
    const { delays, lastPop } = popDelays(cells, new Map([['0,1', 2], ['0,2', 4]]), 10);
    expect(delays).toEqual([0, 20, 40]);
    expect(lastPop).toBe(40);
  });

  it('popDelays copes with no cells', () => {
    expect(popDelays([], new Map(), 10)).toEqual({ delays: [], lastPop: 0 });
  });

  it('stepWaitMs waits a pop plus the last delay, or a flash if longer', () => {
    expect(stepWaitMs(280, 0, false, 340)).toBe(280);
    expect(stepWaitMs(280, 50, false, 340)).toBe(330);
    expect(stepWaitMs(280, 50, true, 340)).toBe(340);
    expect(stepWaitMs(60, 0, true, 220)).toBe(220);
  });
});
