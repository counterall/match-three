// Animation timings, pure so tests can check them. main.ts re-reads them whenever the
// reduced-motion preference changes (issue #38) and pushes them to CSS custom properties.

export interface Timings {
  reduced: boolean;
  swapMs: number;
  popMs: number;
  fallBaseMs: number;
  fallPerRowMs: number;
  /** Reduced motion: a plain flash, still long enough to see. */
  blastMs: number;
}

export function timingsFor(reduced: boolean): Timings {
  return {
    reduced,
    swapMs: reduced ? 60 : 200,
    popMs: reduced ? 60 : 280,
    fallBaseMs: reduced ? 60 : 160,
    fallPerRowMs: reduced ? 0 : 45,
    blastMs: reduced ? 220 : 340,
  };
}

/** The CSS custom properties that mirror the timings, so TS waits and CSS durations agree. */
export function timingProperties(t: Timings): Record<string, string> {
  return { '--swap-ms': `${t.swapMs}ms`, '--pop-ms': `${t.popMs}ms`, '--blast-ms': `${t.blastMs}ms` };
}
