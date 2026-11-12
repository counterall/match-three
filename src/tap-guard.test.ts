import { describe, expect, it } from 'vitest';
import {
  CLICKABLE,
  DOUBLE_TAP_MS,
  createDoubleTapGuard,
  createTouchEndHandler,
  isIosHomeScreenApp,
  lockViewportScale,
} from './tap-guard';

describe('createDoubleTapGuard', () => {
  it('lets a single tap through', () => {
    expect(createDoubleTapGuard()(1000)).toBe(false);
  });

  it('blocks the second tap of a quick double tap', () => {
    const guard = createDoubleTapGuard();
    guard(1000);
    expect(guard(1000 + DOUBLE_TAP_MS - 1)).toBe(true);
  });

  it('lets slow taps through', () => {
    const guard = createDoubleTapGuard();
    guard(1000);
    expect(guard(1000 + DOUBLE_TAP_MS + 1)).toBe(false);
  });

  it('keeps blocking every tap in a rapid burst', () => {
    const guard = createDoubleTapGuard();
    expect(guard(1000)).toBe(false);
    expect(guard(1100)).toBe(true);
    expect(guard(1200)).toBe(true);
    expect(guard(1300)).toBe(true);
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

describe('isIosHomeScreenApp', () => {
  it('is true for an iOS home-screen app', () => {
    expect(isIosHomeScreenApp({ standalone: true })).toBe(true);
  });

  it('is false in a Safari tab and on other platforms (no navigator.standalone)', () => {
    expect(isIosHomeScreenApp({ standalone: false })).toBe(false);
    expect(isIosHomeScreenApp({})).toBe(false);
  });
});

describe('createTouchEndHandler', () => {
  /** A fake touchend whose target resolves `closest(CLICKABLE)` to `control` (or null). */
  function touchEnd(t: number, control: { click(): void } | null, opts: { touches?: number; changed?: number } = {}) {
    const ev = {
      timeStamp: t,
      touches: { length: opts.touches ?? 0 },
      changedTouches: { length: opts.changed ?? 1 },
      target: { closest: (sel: string) => (sel === CLICKABLE ? control : null) },
      prevented: false,
      preventDefault() {
        ev.prevented = true;
      },
    };
    return ev;
  }
  const control = () => {
    const c = { clicks: 0, click: () => c.clicks++ };
    return c;
  };

  it('does nothing to a single tap', () => {
    const handle = createTouchEndHandler();
    const btn = control();
    const ev = touchEnd(1000, btn);
    handle(ev);
    expect(ev.prevented).toBe(false);
    expect(btn.clicks).toBe(0); // the browser's own click still fires
  });

  it('cancels the second quick tap and replays the click on the control it hit', () => {
    const handle = createTouchEndHandler();
    const btn = control();
    handle(touchEnd(1000, btn));
    const second = touchEnd(1100, btn);
    handle(second);
    expect(second.prevented).toBe(true);
    expect(btn.clicks).toBe(1);
  });

  it('cancels a quick second tap on a non-control without clicking anything', () => {
    const handle = createTouchEndHandler();
    handle(touchEnd(1000, null));
    const second = touchEnd(1100, null);
    expect(() => handle(second)).not.toThrow();
    expect(second.prevented).toBe(true);
  });

  it('ignores multi-touch (pinch) ends', () => {
    const handle = createTouchEndHandler();
    handle(touchEnd(1000, null));
    const lifted = touchEnd(1100, null, { touches: 1 });
    handle(lifted);
    expect(lifted.prevented).toBe(false);
    const twoAtOnce = touchEnd(1150, null, { changed: 2 });
    handle(twoAtOnce);
    expect(twoAtOnce.prevented).toBe(false);
  });

  it('copes with a target that is not an element', () => {
    const handle = createTouchEndHandler();
    handle(touchEnd(1000, null));
    const ev = { ...touchEnd(1100, null), target: null };
    expect(() => handle(ev)).not.toThrow();
  });
});
