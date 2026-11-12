// Zoom guards for the iOS home-screen app ("Add to Home Screen", display: standalone).
//
// In a Safari tab, `html { touch-action: manipulation }` (style.css) already stops
// double-tap zoom. iOS home-screen web apps don't reliably honour it, so there we also:
//   1. cancel the second touchend of a quick double tap (that's what triggers the zoom),
//      re-dispatching the click for buttons/controls so fast taps still register, and
//   2. lock the viewport scale (maximum-scale=1, user-scalable=no), as a native app would.
// Nothing here runs in a normal browser tab, which keeps pinch zoom there.

/** Max gap between two taps for iOS to treat them as a double tap. */
export const DOUBLE_TAP_MS = 350;
/** Max distance between two taps (CSS px) for them to count as the same spot. */
export const DOUBLE_TAP_PX = 40;

export interface Tap {
  t: number;
  x: number;
  y: number;
}

/**
 * Returns a stateful check: call it for every single-finger touchend; it returns
 * true when that tap completes a double tap and should be cancelled.
 */
export function createDoubleTapGuard(): (tap: Tap) => boolean {
  let last: Tap | null = null;
  return (tap) => {
    const isDouble =
      last !== null &&
      tap.t - last.t < DOUBLE_TAP_MS &&
      Math.hypot(tap.x - last.x, tap.y - last.y) <= DOUBLE_TAP_PX;
    // A cancelled tap ends the pair, so the next tap starts fresh.
    last = isDouble ? null : tap;
    return isDouble;
  };
}

/** Viewport meta content with zooming disabled (idempotent). */
export function lockViewportScale(content: string): string {
  const parts = content
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^(maximum-scale|user-scalable)\s*=/i.test(p));
  return [...parts, 'maximum-scale=1', 'user-scalable=no'].join(', ');
}

/** True when running as an installed / home-screen app rather than in a browser tab. */
export function isStandalone(nav: { standalone?: boolean }, matches: (query: string) => boolean): boolean {
  return nav.standalone === true || matches('(display-mode: standalone)');
}

/** Elements whose click a cancelled touchend would otherwise swallow. */
const CLICKABLE = 'button, a[href], label, input, select, textarea, [role="button"], [role="radio"]';

/** Installs the guards when running as a home-screen app. Call once at startup. */
export function installStandaloneZoomGuards(): void {
  if (!isStandalone(navigator as { standalone?: boolean }, (q) => matchMedia(q).matches)) return;

  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (meta) meta.content = lockViewportScale(meta.content);

  const isDoubleTap = createDoubleTapGuard();
  document.addEventListener(
    'touchend',
    (e) => {
      // Only plain single-finger taps; leave multi-touch to the browser.
      if (e.touches.length > 0 || e.changedTouches.length !== 1) return;
      const touch = e.changedTouches[0];
      if (!isDoubleTap({ t: e.timeStamp, x: touch.clientX, y: touch.clientY })) return;
      e.preventDefault(); // stops the double-tap zoom, but also the synthetic click...
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>(CLICKABLE) : null;
      target?.click(); // ...so replay it for controls. Board input uses pointer events.
    },
    { passive: false },
  );
}
