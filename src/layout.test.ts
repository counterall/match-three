import { describe, expect, it } from 'vitest';
import css from './style.css?raw';

/** Declarations of the first CSS rule whose selector list is exactly `selector`. */
function ruleBody(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : '';
}

describe('board size on larger screens', () => {
  const width = ruleBody('.app').match(/(?:^|\n)\s*width:\s*([^;]+);/)?.[1] ?? '';

  it('caps the column (and so the board) at 1.3x the original 560px', () => {
    expect(width).toMatch(/\b728px\b/);
    expect(width).not.toMatch(/\b560px\b/);
  });

  it('still shrinks to fit the viewport width and height', () => {
    expect(width).toMatch(/^min\(\s*100%/);
    expect(width).toMatch(/100dvh\s*-\s*var\(--chrome\)/);
  });
});
