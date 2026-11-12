import { describe, expect, it } from 'vitest';
import { canPause, shouldAutoPause } from './pause';
import { Countdown } from './timer';

const round = { started: true, timeUp: false, paused: false };

describe('canPause', () => {
  it('is allowed once the round has started', () => {
    expect(canPause(round)).toBe(true);
  });

  it('is not allowed before the first move', () => {
    expect(canPause({ ...round, started: false })).toBe(false);
  });

  it('is not allowed once time is up', () => {
    expect(canPause({ ...round, timeUp: true })).toBe(false);
  });

  it('is not allowed when already paused', () => {
    expect(canPause({ ...round, paused: true })).toBe(false);
  });
});

describe('shouldAutoPause', () => {
  it('pauses a running round when the page/app is hidden (e.g. app minimised)', () => {
    expect(shouldAutoPause(round, true)).toBe(true);
  });

  it('does nothing when the page becomes visible again (the player resumes)', () => {
    expect(shouldAutoPause(round, false)).toBe(false);
  });

  it('does nothing for a round that has not started or is over', () => {
    expect(shouldAutoPause({ ...round, started: false }, true)).toBe(false);
    expect(shouldAutoPause({ ...round, timeUp: true }, true)).toBe(false);
  });
});

describe('Countdown with a pause hold', () => {
  it('stays frozen while paused, even after the page becomes visible again', () => {
    const c = new Countdown(60_000);
    c.start(0);
    c.hold('hidden', 10_000);
    c.hold('paused', 10_000); // auto-pause on hide
    c.release('hidden', 30_000); // app back in front, but still paused
    expect(c.remaining(50_000)).toBe(50_000);
    c.release('paused', 50_000); // player taps Resume
    expect(c.remaining(55_000)).toBe(45_000);
  });
});
