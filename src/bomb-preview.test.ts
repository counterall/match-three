// Issue #26: a standalone preview page for the planned bomb gem, served from
// public/ (copied as-is into dist/) so it can be reviewed on a phone via Pages.
import { describe, expect, it } from 'vitest';
import html from '../public/previews/bomb.html?raw';
import css from './style.css?raw';
import { GEM_TYPES } from './board';
import { gemSvg } from './gems';
import { THEMES } from './settings';

const tokenBlock = (src: string, theme: string): string =>
  src.match(new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`))?.[1] ?? '';

const gemColours = (block: string): string[] =>
  Array.from({ length: GEM_TYPES }, (_, i) => block.match(new RegExp(`--gem-${i}:\\s*(#[0-9a-fA-F]+)`))?.[1] ?? '');

describe('bomb preview page', () => {
  it('has a token block and a section for every theme', () => {
    for (const { id } of THEMES) {
      expect(tokenBlock(html, id)).not.toBe('');
      expect(html).toContain(`['${id}', '`);
    }
  });

  it('draws gems the way the board does (80% of the cell, same outline width)', () => {
    const outline = (src: string) => src.match(/\.gem-body\s*\{[^}]*stroke-width:\s*(\d+)/)?.[1];
    expect(outline(html)).toBe(outline(css));
    expect(html).toMatch(/\.cell svg\s*\{[^}]*width:\s*80%;\s*height:\s*80%/);
  });

  it("uses each theme's real gem colours", () => {
    for (const { id } of THEMES) {
      expect(gemColours(tokenBlock(html, id))).toEqual(gemColours(tokenBlock(css, id)));
    }
  });

  it('draws the real gem shapes', () => {
    for (let t = 0; t < GEM_TYPES; t++) {
      const shape = gemSvg(t).match(/<g class="gem-body">(.*?)<\/g>/s)?.[1];
      expect(shape).toBeTruthy();
      expect(html).toContain(shape);
    }
  });

  it('shows desktop and phone cell sizes', () => {
    expect(html).toMatch(/--cell:\s*91px/);
    expect(html).toMatch(/--cell:\s*58px/);
  });

  it('is self-contained: no external requests', () => {
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/<(script|link)[^>]+(src|href)=/i);
  });

  it('stops the spark animation under reduced motion', () => {
    expect(html).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.spark\s*\{\s*animation:\s*none/);
  });

  it('has a mobile viewport and lists the planned rules', () => {
    expect(html).toContain('name="viewport"');
    expect(html).toMatch(/5\+? in a row/i);
    expect(html).toMatch(/3×3/);
  });
});
