import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import html from '../index.html?raw';

/** Declarations of the first CSS rule whose selector list is exactly `selector`. */
function ruleBody(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : '';
}

describe('double-tap zoom (issue #5)', () => {
  it('disables double-tap zoom page-wide with touch-action: manipulation on html', () => {
    // touch-action applies to an element and every descendant, so setting it on the
    // root covers the board gaps, HUD, buttons and the settings dialog.
    expect(ruleBody('html')).toMatch(/touch-action:\s*manipulation\s*;/);
  });

  it('keeps the board fully under script control for swipes', () => {
    expect(ruleBody('.board')).toMatch(/touch-action:\s*none\s*;/);
  });

  it('does not block pinch zoom in the viewport meta (accessibility)', () => {
    const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]*)"/)?.[1];
    expect(viewport).toBeDefined();
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(viewport).not.toMatch(/maximum-scale/);
  });
});
