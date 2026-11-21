import { describe, expect, it } from 'vitest';
import { timingProperties, timingsFor } from './motion';

describe('timingsFor (issue #38)', () => {
  it('is short but non-zero under reduced motion, longer otherwise', () => {
    const full = timingsFor(false);
    const reduced = timingsFor(true);
    expect(reduced.reduced).toBe(true);
    for (const k of ['swapMs', 'popMs', 'fallBaseMs', 'blastMs'] as const) {
      expect(reduced[k], k).toBeGreaterThan(0);
      expect(reduced[k], k).toBeLessThan(full[k]);
    }
    expect(reduced.fallPerRowMs).toBe(0);
  });

  it('mirrors the timings into CSS custom properties', () => {
    expect(timingProperties(timingsFor(false))).toEqual({ '--swap-ms': '200ms', '--pop-ms': '280ms', '--blast-ms': '340ms' });
    expect(timingProperties(timingsFor(true))['--pop-ms']).toBe('60ms');
  });
});
