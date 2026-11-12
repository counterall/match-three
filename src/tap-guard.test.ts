import { describe, expect, it } from 'vitest';
import { DOUBLE_TAP_MS, DOUBLE_TAP_PX, createDoubleTapGuard, isStandalone, lockViewportScale } from './tap-guard';

describe('createDoubleTapGuard', () => {
  it('lets a single tap through', () => {
    const guard = createDoubleTapGuard();
    expect(guard({ t: 1000, x: 50, y: 50 })).toBe(false);
  });

  it('blocks the second tap of a quick double tap at the same spot', () => {
    const guard = createDoubleTapGuard();
    guard({ t: 1000, x: 50, y: 50 });
    expect(guard({ t: 1000 + DOUBLE_TAP_MS - 1, x: 55, y: 48 })).toBe(true);
  });

  it('lets slow taps through', () => {
    const guard = createDoubleTapGuard();
    guard({ t: 1000, x: 50, y: 50 });
    expect(guard({ t: 1000 + DOUBLE_TAP_MS + 1, x: 50, y: 50 })).toBe(false);
  });

  it('lets quick taps at different spots through (e.g. two gems)', () => {
    const guard = createDoubleTapGuard();
    guard({ t: 1000, x: 50, y: 50 });
    expect(guard({ t: 1100, x: 50 + DOUBLE_TAP_PX + 1, y: 50 })).toBe(false);
  });

  it('treats a blocked tap as consumed, so a triple tap blocks taps 2 and 3 only in pairs', () => {
    const guard = createDoubleTapGuard();
    expect(guard({ t: 1000, x: 50, y: 50 })).toBe(false);
    expect(guard({ t: 1100, x: 50, y: 50 })).toBe(true);
    // The third tap starts a new pair: it is compared against the blocked one, which
    // iOS has already discarded as a zoom gesture, so it is let through.
    expect(guard({ t: 1200, x: 50, y: 50 })).toBe(false);
  });
});

describe('lockViewportScale', () => {
  it('adds maximum-scale and user-scalable=no', () => {
    expect(lockViewportScale('width=device-width, initial-scale=1.0')).toBe(
      'width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no',
    );
  });

  it('is idempotent and replaces existing values', () => {
    const once = lockViewportScale('width=device-width, maximum-scale=5, user-scalable=yes');
    expect(once).toBe('width=device-width, maximum-scale=1, user-scalable=no');
    expect(lockViewportScale(once)).toBe(once);
  });
});

describe('isStandalone', () => {
  it('detects iOS home-screen apps via navigator.standalone', () => {
    expect(isStandalone({ standalone: true }, () => false)).toBe(true);
  });

  it('detects installed apps via the display-mode media query', () => {
    expect(isStandalone({}, (q) => q === '(display-mode: standalone)')).toBe(true);
  });

  it('is false in a normal browser tab', () => {
    expect(isStandalone({ standalone: false }, () => false)).toBe(false);
  });
});
