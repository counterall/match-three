// Zoom guards for the iOS home-screen app ("Add to Home Screen").
//
// In a Safari tab, `html { touch-action: manipulation }` (style.css) already stops
// double-tap zoom, but double-tap zoom was reported to still happen in the iOS
// home-screen app (issue #9). So there, and only there, we also:
//   1. cancel the second touchend of a quick double tap (that's what triggers the zoom),
//      re-dispatching the click for buttons/controls so fast taps still register, and
//   2. lock the viewport scale (maximum-scale=1, user-scalable=no), as a native app would.
// Browser tabs and other installed apps (e.g. Android, where touch-action works) are
// untouched and keep pinch zoom.

/** Max gap between two taps for iOS to treat them as a double tap. */
export const DOUBLE_TAP_MS = 350;

/**
 * Returns a stateful check: call it with the timestamp of every single-finger
 * touchend; it returns true when that tap follows the previous one quickly enough
 * to count as a double tap and should be cancelled. Position is ignored on purpose:
 * blocking a few extra taps costs nothing (controls get their click replayed), while
 * letting one through can zoom.
 */
export function createDoubleTapGuard(): (t: number) => boolean {
  let last = -Infinity;
  return (t) => {
    const isDouble = t - last < DOUBLE_TAP_MS;
    last = t; // always track the latest tap, so rapid triple taps stay blocked
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

/** True only for an iOS home-screen web app (`navigator.standalone` is iOS-only). */
export function isIosHomeScreenApp(nav: { standalone?: boolean }): boolean {
  return nav.standalone === true;
}

/** Elements whose click a cancelled touchend would otherwise swallow. */
export const CLICKABLE = 'button, a[href], label, input, select, textarea, [role="button"], [role="radio"]';

/** The parts of a TouchEvent the guard reads (so it can be tested without a DOM). */
export interface TouchEndLike {
  timeStamp: number;
  touches: { length: number };
  changedTouches: { length: number };
  target: unknown;
  preventDefault(): void;
}

interface ClosestCapable {
  closest(selector: string): { click(): void } | null;
}

/** Builds the document-level touchend handler used in the home-screen app. */
export function createTouchEndHandler(isDoubleTap = createDoubleTapGuard()): (e: TouchEndLike) => void {
  return (e) => {
    // Only plain single-finger taps; leave multi-touch to the browser.
    if (e.touches.length > 0 || e.changedTouches.length !== 1) return;
    if (!isDoubleTap(e.timeStamp)) return;
    e.preventDefault(); // stops the double-tap zoom, but also the synthetic click...
    const target = e.target as Partial<ClosestCapable> | null;
    // ...so replay it for controls. Board input uses pointer events, which a cancelled
    // touchend doesn't affect.
    target?.closest?.(CLICKABLE)?.click();
  };
}

/** Installs the guards when running as an iOS home-screen app. Call once at startup. */
export function installStandaloneZoomGuards(): void {
  if (!isIosHomeScreenApp(navigator as { standalone?: boolean })) return;

  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (meta) meta.content = lockViewportScale(meta.content);

  document.addEventListener('touchend', createTouchEndHandler(), { passive: false });
}
