import { describe, expect, it } from 'vitest';
import { ANIMAL_POOL, DEFAULT_CAST } from './animals';
import { ANIMAL_NAME_KEYS, SHAPE_NAME_KEYS, gemLabel, gemName } from './a11y';
import { GEM_TYPES } from './board';
import { LANGUAGES, t } from './i18n';
import html from '../index.html?raw';
import mainSrc from './main.ts?raw';
import css from './style.css?raw';

describe('gem names (issue #38)', () => {
  it('has a shape name for every gem type and an animal name for every pool animal', () => {
    expect(SHAPE_NAME_KEYS).toHaveLength(GEM_TYPES);
    expect(ANIMAL_NAME_KEYS).toHaveLength(ANIMAL_POOL.length);
  });

  it('names are non-empty and distinct in every language', () => {
    for (const { id } of LANGUAGES) {
      for (const keys of [SHAPE_NAME_KEYS, ANIMAL_NAME_KEYS]) {
        const names = keys.map((k) => t(id, k));
        expect(names.every((n) => n.length > 0)).toBe(true);
        expect(new Set(names).size).toBe(names.length);
      }
    }
  });

  it('names a gem by its drawn animal through the cast', () => {
    const cast = [3, 0, 1, 2, 4, 5, 6];
    expect(gemName('en', 0, 'animals', cast)).toBe('Parrot');
    expect(gemName('en', 1, 'animals', cast)).toBe('Terrier');
    expect(gemName('en', 0, 'shapes', cast)).toBe('Circle');
    expect(gemName('zh-CN', 6, 'shapes', DEFAULT_CAST)).toBe('心形');
  });
});

describe('gemLabel', () => {
  it('says what, where (1-based), and the special kind with its direction', () => {
    expect(gemLabel('en', 'Frog', {}, 0, 2)).toBe('Frog, row 1, column 3');
    expect(gemLabel('en', 'Frog', { special: 'bomb' }, 1, 1)).toBe('Frog, bomb, row 2, column 2');
    expect(gemLabel('en', 'Frog', { special: 'line', dir: 'col' }, 0, 0)).toBe('Frog, line gem vertical, row 1, column 1');
    expect(gemLabel('en', 'Frog', { special: 'line', dir: 'anti' }, 0, 0)).toContain('up-right');
    expect(gemLabel('en', 'Frog', { special: 'line' }, 0, 0)).toContain('horizontal');
  });

  it('is translated, with every placeholder filled', () => {
    const label = gemLabel('zh-CN', '青蛙', { special: 'line', dir: 'diag' }, 3, 4);
    expect(label).toContain('第 4 行');
    expect(label).toContain('第 5 列');
    expect(label).not.toMatch(/[{}]/);
  });
});

describe('board markup and wiring (issue #38)', () => {
  it('no longer claims role=grid without rows/gridcells', () => {
    expect(html).not.toMatch(/id="board"[^>]*role="grid"/);
    expect(html).toMatch(/id="board"[^>]*role="group"/);
  });

  it('has a polite score live region separate from the toast', () => {
    expect(html).toMatch(/id="score-live"[^>]*role="status"/);
    expect(html).toMatch(/id="score-live"[^>]*class="sr-only"/);
    expect(css).toMatch(/\.sr-only\s*\{/);
  });

  it('gems are focusable buttons with a roving tabindex and a visible focus ring', () => {
    expect(mainSrc).toMatch(/setAttribute\('role', 'button'\)|role = 'button'/);
    expect(mainSrc).toMatch(/tabIndex/);
    expect(mainSrc).toMatch(/aria-pressed/);
    expect(mainSrc).toMatch(/addEventListener\('keydown'/);
    expect(css).toMatch(/\.gem:focus-visible/);
  });

  it('resets the keyboard tab stop for a new board shape', () => {
    expect(mainSrc).toMatch(/focusPos = \{ row: 0, col: 0 \};[^\n]*\n\s*let minutes/);
  });

  it('follows reduced motion live and accepts only the primary pointer', () => {
    expect(mainSrc).toMatch(/reducedQuery\.addEventListener\('change'/);
    expect(mainSrc).toMatch(/beginDrag\(/);
    expect(mainSrc).toMatch(/ownsDrag\(/);
    expect(mainSrc).not.toMatch(/^const reducedMotion = /m);
    expect(mainSrc).toContain("'lostpointercapture'");
  });
});
