import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import html from '../index.html?raw';

/** Declarations of the first CSS rule whose selector list is exactly `selector`. */
function ruleBody(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : '';
}

/** Opacity (0–100) of a `color-mix(in srgb, X N%, transparent)` background. */
function veilPercent(body: string): number {
  const m = body.match(/background:\s*color-mix\(in srgb,[^;]*?([\d.]+)%,\s*transparent\)/);
  if (!m) throw new Error(`no color-mix background in: ${body}`);
  return Number(m[1]);
}

/** Largest blur radius in px set by backdrop-filter or its -webkit- twin (0 for none). */
function blurPx(body: string): number {
  const decls = [...body.matchAll(/(?:^|[;\s])(?:-webkit-)?backdrop-filter:\s*([^;]+);/g)].map((m) => m[1].trim());
  if (decls.length < 2) throw new Error('set both backdrop-filter and -webkit-backdrop-filter, or the base .overlay blur applies');
  return Math.max(...decls.map((d) => (d === 'none' ? 0 : Number(d.match(/blur\(([\d.]+)px\)/)?.[1] ?? NaN))));
}

describe('pause screen lets the board show through (issue #15)', () => {
  const paused = ruleBody('.paused');

  it('only lightly tints the board', () => {
    expect(veilPercent(paused)).toBeLessThanOrEqual(60);
  });

  it('does not blur the board out of sight (overrides the shared overlay blur)', () => {
    expect(blurPx(paused)).toBeLessThanOrEqual(2); // checks the Safari-prefixed one too
  });

  it('keeps its text readable on a solid card', () => {
    const card = html.match(/<div id="paused"[^>]*>\s*<div class="overlay-card">([\s\S]*?)<\/div>/);
    expect(card, '#paused should open with a .overlay-card').not.toBeNull();
    expect(card![1]).toMatch(/id="paused-title"[\s\S]*id="resume"/);
    expect(ruleBody('.overlay-card')).toMatch(/(?:^|[;\s])background:\s*var\(--panel-solid\);/);
  });
});

describe('game-over screen is unchanged by issue #15', () => {
  it('still hides the board behind the shared overlay tint and blur', () => {
    const overlay = ruleBody('.overlay');
    expect(veilPercent(overlay)).toBeGreaterThanOrEqual(80);
    expect(blurPx(overlay)).toBeGreaterThanOrEqual(4);
    expect(html).not.toMatch(/<div id="game-over"[^>]*class="[^"]*paused/);
  });
});
