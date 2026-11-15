import { describe, expect, it } from 'vitest';
import { ANIMALS } from './animals';
import { GEM_TYPES } from './board';
import { gemDefsSvg, gemSvg } from './gems';
import css from './style.css?raw';

const types = Array.from({ length: GEM_TYPES }, (_, t) => t);

describe('animal gem style', () => {
  it('has one animal per gem type', () => {
    expect(ANIMALS).toHaveLength(GEM_TYPES);
    expect(ANIMALS.map((a) => a.name)).toEqual([
      'Wire fox terrier',
      'Husky',
      'Frog',
      'Golden retriever',
      'Shiba',
      'Penguin',
      'Bear',
    ]);
  });

  it('keeps the shapes style as the default drawing', () => {
    for (const t of types) {
      expect(gemSvg(t)).toBe(gemSvg(t, 'shapes'));
      expect(gemSvg(t, 'animals')).not.toBe(gemSvg(t, 'shapes'));
    }
  });

  it('draws a theme-coloured tile behind each animal', () => {
    for (const t of types) {
      const svg = gemSvg(t, 'animals');
      // The tile takes its colour from CSS (the gem type's theme colour), so no fill here.
      expect(svg).toMatch(/<rect class="gem-tile"(?![^>]*fill=)[^>]*\/>/);
      // Tile first, so the animal sits on top of it.
      expect(svg.indexOf('gem-tile')).toBeLessThan(svg.indexOf('<g'));
    }
  });

  it('draws the face once lit and once shaded, clipped to its right half', () => {
    for (const t of types) {
      const svg = gemSvg(t, 'animals');
      expect(svg).toContain('clip-path="url(#gem-half-right)"');
      const lit = svg.match(/<g class="animal-lit"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? '';
      const shaded = svg.match(/<g class="animal-shaded"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? '';
      const count = (s: string) => (s.match(/<(path|polygon|rect|circle|ellipse)\b/g) ?? []).length;
      expect(count(lit)).toBeGreaterThan(3);
      expect(count(shaded)).toBe(count(lit));
    }
  });

  it('defines no ids of its own, and every url(#…) it uses is in the shared defs', () => {
    const defs = gemDefsSvg();
    expect(defs.split('id="gem-half-right"')).toHaveLength(2);
    for (const t of types) {
      const svg = gemSvg(t, 'animals');
      expect(svg).not.toMatch(/\sid=/);
      for (const [, id] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(defs).toContain(`id="${id}"`);
    }
  });

  it('is decorative to screen readers, like the shapes', () => {
    for (const t of types) expect(gemSvg(t, 'animals')).toMatch(/^<svg[^>]*aria-hidden="true"/);
  });
});

describe('animal tile styles', () => {
  /** Body of the first rule whose selector list is exactly `selector`. */
  const ruleBody = (selector: string) => {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return css.match(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  };

  it('colours the tile with the gem type body colour', () => {
    // --fc, not --c: the Dark theme's --c is white for every type, and only its
    // per-type body greys (--gem-N-body) tell the tiles apart.
    const tile = ruleBody('.gem-tile');
    expect(tile).toMatch(/fill:\s*var\(--fc\)/);
    expect(tile).toMatch(/fill-opacity:\s*var\(--gem-tile-opacity\)/);
  });

  it('defines the tile strength in every theme', () => {
    for (const theme of ['neon', 'pastel', 'dark']) {
      const block = css.match(new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`))?.[1] ?? '';
      expect(block, theme).toMatch(/--gem-tile-opacity:\s*[\d.]+\s*;/);
    }
  });
});

describe('gem style picker in settings', () => {
  it('has a labelled radio group in the settings dialog', async () => {
    const html = (await import('../index.html?raw')).default;
    expect(html).toMatch(/<h3 id="gem-style-title" data-i18n="gemStyle">Gem style<\/h3>/);
    expect(html).toMatch(/<div id="gem-style-options"[^>]*role="radiogroup"[^>]*aria-labelledby="gem-style-title"/);
  });
});
