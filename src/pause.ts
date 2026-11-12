// Pause rules: pure, so main.ts only wires them to the DOM.
//
// A round can be paused once its clock has started (the first swap) and until time
// runs out. Pausing holds the countdown (Countdown hold "paused"), blocks board input
// and hints, and covers the board. Hiding the page (switching tabs, minimising the
// home-screen app) pauses automatically; coming back does not resume on its own,
// the player taps Resume.

export interface RoundState {
  /** The clock has started (first swap made). */
  started: boolean;
  /** The clock ran out. */
  timeUp: boolean;
  paused: boolean;
}

export function canPause(s: RoundState): boolean {
  return s.started && !s.timeUp && !s.paused;
}

/** Whether a visibility change to `hidden` should pause the round. */
export function shouldAutoPause(s: RoundState, hidden: boolean): boolean {
  return hidden && canPause(s);
}
