import { describe, expect, it } from 'vitest';
import { BONUS_EVERY, BONUS_SECONDS, Countdown, bonusSeconds, formatTime } from './timer';

describe('bonusSeconds', () => {
  it('awards 20 seconds for every 1000 points', () => {
    expect(BONUS_EVERY).toBe(1000);
    expect(BONUS_SECONDS).toBe(20);
  });

  it('gives nothing when no thousand is crossed', () => {
    expect(bonusSeconds(0, 0)).toBe(0);
    expect(bonusSeconds(0, 999)).toBe(0);
    expect(bonusSeconds(1000, 1990)).toBe(0);
  });

  it('gives a bonus when a thousand is reached or crossed', () => {
    expect(bonusSeconds(990, 1000)).toBe(20);
    expect(bonusSeconds(950, 1050)).toBe(20);
    expect(bonusSeconds(1999, 2010)).toBe(20);
  });

  it('counts every thousand crossed in one go', () => {
    expect(bonusSeconds(900, 3100)).toBe(60);
    expect(bonusSeconds(0, 2000)).toBe(40);
  });

  it('never goes negative (e.g. a score reset)', () => {
    expect(bonusSeconds(2500, 0)).toBe(0);
  });
});

describe('formatTime', () => {
  it('shows m:ss, rounding partial seconds up', () => {
    expect(formatTime(180_000)).toBe('3:00');
    expect(formatTime(600_000)).toBe('10:00');
    expect(formatTime(179_001)).toBe('3:00');
    expect(formatTime(179_000)).toBe('2:59');
    expect(formatTime(65_000)).toBe('1:05');
    expect(formatTime(1)).toBe('0:01');
  });

  it('clamps at zero', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(-500)).toBe('0:00');
  });
});

describe('Countdown', () => {
  it('does not run until started', () => {
    const c = new Countdown(60_000);
    expect(c.isStarted).toBe(false);
    expect(c.remaining(10_000)).toBe(60_000);
    c.start(10_000);
    expect(c.isStarted).toBe(true);
    expect(c.remaining(25_000)).toBe(45_000);
  });

  it('ignores a second start', () => {
    const c = new Countdown(60_000);
    c.start(0);
    c.start(30_000);
    expect(c.remaining(30_000)).toBe(30_000);
  });

  it('clamps at zero and reports expiry', () => {
    const c = new Countdown(1_000);
    c.start(0);
    expect(c.expired(999)).toBe(false);
    expect(c.expired(1_000)).toBe(true);
    expect(c.remaining(5_000)).toBe(0);
  });

  it('freezes while held and resumes when every hold is released', () => {
    const c = new Countdown(60_000);
    c.start(0);
    c.hold('settings', 10_000);
    expect(c.remaining(40_000)).toBe(50_000);
    c.hold('hidden', 40_000);
    c.release('settings', 50_000);
    expect(c.remaining(55_000)).toBe(50_000); // still hidden
    c.release('hidden', 60_000);
    expect(c.remaining(70_000)).toBe(40_000);
  });

  it('treats holds as idempotent', () => {
    const c = new Countdown(60_000);
    c.start(0);
    c.hold('hidden', 0);
    c.hold('hidden', 5_000);
    c.release('hidden', 10_000);
    expect(c.remaining(10_000)).toBe(60_000);
    c.release('hidden', 20_000);
    expect(c.remaining(20_000)).toBe(50_000);
  });

  it('stays frozen when started during a hold', () => {
    const c = new Countdown(60_000);
    c.hold('settings', 0);
    c.start(5_000);
    expect(c.remaining(20_000)).toBe(60_000);
    c.release('settings', 20_000);
    expect(c.remaining(30_000)).toBe(50_000);
  });

  it('adds bonus time while running', () => {
    const c = new Countdown(60_000);
    c.start(0);
    expect(c.add(20_000, 30_000)).toBe(true);
    expect(c.remaining(30_000)).toBe(50_000);
    expect(c.remaining(40_000)).toBe(40_000);
  });

  it('does not revive an expired countdown', () => {
    const c = new Countdown(1_000);
    c.start(0);
    expect(c.add(20_000, 2_000)).toBe(false); // so no "+20s" is announced
    expect(c.expired(2_000)).toBe(true);
  });

  it('resets to a new limit, keeping holds', () => {
    const c = new Countdown(60_000);
    c.start(0);
    c.hold('settings', 10_000);
    c.reset(300_000);
    expect(c.isStarted).toBe(false);
    expect(c.remaining(20_000)).toBe(300_000);
    c.start(20_000);
    expect(c.remaining(30_000)).toBe(300_000); // still held
    c.release('settings', 30_000);
    expect(c.remaining(40_000)).toBe(290_000);
  });
});
