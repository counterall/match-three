import { describe, expect, it } from 'vitest';
import { ANIMAL_POOL, DEFAULT_CAST, SPARE_ANIMALS, animalSvg, drawCast, type Animal } from './animals';
import { GEM_TYPES, type Rng } from './board';
import { gemDefsSvg, gemSvg } from './gems';
import css from './style.css?raw';

const types = Array.from({ length: GEM_TYPES }, (_, t) => t);
const names = (animals: readonly Animal[]) => animals.map((a) => a.name);
/** Deterministic Rng (LCG) for repeatable draws. */
const seeded = (seed: number): Rng => {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
};

describe('animal pool', () => {
  it('has eight animals: one more than the gem types, so one sits out each game', () => {
    expect(names(ANIMAL_POOL)).toEqual([
      'Wire fox terrier',
      'Husky',
      'Frog',
      'Parrot',
      'Black Shiba',
      'Penguin',
      'Bear',
      'Tiger',
    ]);
    expect(ANIMAL_POOL).toHaveLength(GEM_TYPES + 1);
  });

  it('keeps the golden retriever as a spare, outside the pool (issue #20)', () => {
    expect(names(SPARE_ANIMALS)).toEqual(['Golden retriever']);
    expect(names(ANIMAL_POOL)).not.toContain('Golden retriever');
    expect(names(ANIMAL_POOL)).not.toContain('Shiba');
  });

  it('has a fixed default cast of the first seven, one per gem type', () => {
    expect(DEFAULT_CAST).toEqual(types);
  });
});

describe('drawCast', () => {
  it('picks one distinct pool animal per gem type', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const cast = drawCast(seeded(seed));
      expect(cast).toHaveLength(GEM_TYPES);
      expect(new Set(cast).size).toBe(GEM_TYPES);
      for (const i of cast) {
        expect(Number.isInteger(i)).toBe(true);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(ANIMAL_POOL.length);
      }
    }
  });

  it('is repeatable for the same random numbers', () => {
    expect(drawCast(seeded(7))).toEqual(drawCast(seeded(7)));
  });

  it('lets every animal sit out over many games', () => {
    const satOut = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const cast = drawCast(seeded(seed));
      for (let i = 0; i < ANIMAL_POOL.length; i++) if (!cast.includes(i)) satOut.add(i);
    }
    expect(satOut.size).toBe(ANIMAL_POOL.length);
  });

  it('copes with an Rng at the edges of [0, 1)', () => {
    for (const r of [0, 0.999999]) {
      const cast = drawCast(() => r);
      expect(new Set(cast).size).toBe(GEM_TYPES);
      expect(Math.max(...cast)).toBeLessThan(ANIMAL_POOL.length);
    }
  });
});

describe('animal gem style', () => {
  it('keeps the shapes style as the default drawing', () => {
    for (const t of types) {
      expect(gemSvg(t)).toBe(gemSvg(t, 'shapes'));
      expect(gemSvg(t, 'animals')).not.toBe(gemSvg(t, 'shapes'));
    }
  });

  it("draws each gem type as the game's cast says", () => {
    const cast = [7, 3, 0, 5, 1, 6, 4];
    for (const t of types) {
      expect(gemSvg(t, 'animals', cast)).toBe(animalSvg(ANIMAL_POOL[cast[t]]));
      // Shapes ignore the cast.
      expect(gemSvg(t, 'shapes', cast)).toBe(gemSvg(t, 'shapes'));
    }
    for (const t of types) expect(gemSvg(t, 'animals')).toBe(animalSvg(ANIMAL_POOL[DEFAULT_CAST[t]]));
  });

  it('draws no coloured tile behind the animals (issue #20)', () => {
    for (const a of ANIMAL_POOL) {
      const svg = animalSvg(a);
      expect(svg).not.toContain('gem-tile');
      // The first thing drawn is the face itself.
      expect(svg).toMatch(/^<svg[^>]*><g class="animal-lit"/);
    }
  });

  it('draws every face, spare included, once lit and once shaded, clipped to its right half', () => {
    for (const a of [...ANIMAL_POOL, ...SPARE_ANIMALS]) {
      const svg = animalSvg(a);
      expect(svg).toContain('clip-path="url(#gem-half-right)"');
      const lit = svg.match(/<g class="animal-lit"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? '';
      const shaded = svg.match(/<g class="animal-shaded"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? '';
      const count = (s: string) => (s.match(/<(path|polygon|rect|circle|ellipse)\b/g) ?? []).length;
      expect(count(lit), a.name).toBeGreaterThan(3);
      expect(count(shaded), a.name).toBe(count(lit));
    }
  });

  it('defines no ids of its own, and every url(#…) it uses is in the shared defs', () => {
    const defs = gemDefsSvg();
    expect(defs.split('id="gem-half-right"')).toHaveLength(2);
    for (const a of [...ANIMAL_POOL, ...SPARE_ANIMALS]) {
      const svg = animalSvg(a);
      expect(svg).not.toMatch(/\sid=/);
      for (const [, id] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(defs).toContain(`id="${id}"`);
    }
  });

  it('is decorative to screen readers, like the shapes', () => {
    for (const a of ANIMAL_POOL) expect(animalSvg(a)).toMatch(/^<svg[^>]*aria-hidden="true"/);
  });
});

describe('animal styles in CSS', () => {
  it('has no tile rule or tile token left', () => {
    expect(css).not.toContain('.gem-tile');
    expect(css).not.toContain('--gem-tile-opacity');
  });
});

describe('gem style picker in settings', () => {
  it('has a labelled radio group in the settings dialog', async () => {
    const html = (await import('../index.html?raw')).default;
    expect(html).toMatch(/<h3 id="gem-style-title" data-i18n="gemStyle">Gem style<\/h3>/);
    expect(html).toMatch(/<div id="gem-style-options"[^>]*role="radiogroup"[^>]*aria-labelledby="gem-style-title"/);
  });
});
