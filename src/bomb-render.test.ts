// Issue #28: how bombs are drawn and wired into the game.
import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import mainSrc from './main.ts?raw';
import { GEM_TYPES } from './board';
import { gemDefsSvg, gemSvg } from './gems';
import { THEMES } from './settings';

const types = Array.from({ length: GEM_TYPES }, (_, t) => t);
const tokenBlock = (theme: string): string =>
  css.match(new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`))?.[1] ?? '';
const BOMB_TOKENS = [
  '--bomb-body', '--bomb-rim', '--bomb-cap', '--bomb-fuse', '--bomb-fuse-band',
  '--bomb-face', '--bomb-eye', '--bomb-mouth', '--bomb-tint', '--blast-core', '--blast-edge',
];

describe('bomb artwork', () => {
  for (const style of ['shapes', 'animals'] as const) {
    it(`(${style}) defines no ids and uses only shared defs`, () => {
      const defs = gemDefsSvg();
      for (const t of types) {
        const svg = gemSvg(t, style, undefined, true);
        expect(svg).toContain('bomb-spark');
        expect(svg).not.toMatch(/\sid=/);
        for (const [, id] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(defs).toContain(`id="${id}"`);
      }
    });
  }

  it('shows the colour a shapes bomb matches (tint + coloured rim)', () => {
    const svg = gemSvg(2, 'shapes', undefined, true);
    expect(svg).toContain('class="bomb-tint"');
    expect(svg).toContain('class="bomb-ring"');
    expect(css).toMatch(/\.bomb-tint\s*\{[^}]*fill:\s*var\(--fc\)/);
    expect(css).toMatch(/\.bomb-ring\s*\{[^}]*stroke:\s*var\(--c\)/);
  });

  it('keeps the animal face and adds a bomb badge in Animals style', () => {
    const plain = gemSvg(4, 'animals');
    const bomb = gemSvg(4, 'animals', undefined, true);
    expect(bomb.startsWith(plain.replace(/<\/svg>$/, ''))).toBe(true);
    expect(bomb).toContain('class="bomb-badge"');
    // One <svg> only, so the `.gem svg` rules don't scale the badge twice.
    expect(bomb.match(/<svg/g)).toHaveLength(1);
  });

  it('draws normal gems unchanged when not a bomb', () => {
    for (const t of types) expect(gemSvg(t, 'shapes')).not.toContain('bomb');
  });

  it('defines every bomb token in every theme', () => {
    for (const { id } of THEMES) for (const token of BOMB_TOKENS) expect(tokenBlock(id)).toContain(`${token}:`);
  });

  it('respects reduced motion: no spark flicker or pop-in, blast is a plain flash', () => {
    const reduced = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
    expect(reduced).toMatch(/\.bomb-spark/);
    expect(reduced).toMatch(/\.gem\.bomb-made svg/);
    expect(reduced).toMatch(/\.blast\s*\{\s*animation-name:\s*blast-flash/);
    expect(css).toMatch(/@keyframes blast-flash\s*\{[^@]*opacity/);
    expect(css.match(/@keyframes blast-flash\s*\{([\s\S]*?)\n\}/)?.[1]).not.toContain('transform');
  });
});

describe('main.ts wiring', () => {
  it('passes the swap to the first clearing step and refills with the bomb chance', () => {
    expect(mainSrc).toMatch(/resolveCascades\(token, \[a, b\]\)/);
    expect(mainSrc).toMatch(/planClear\(grid, runs, cascade === 1 \? swapped : \[\]\)/);
    expect(mainSrc).toMatch(/collapse\(grid, Math\.random, BOMB_SPAWN_CHANCE\)/);
  });

  it('adds blast points to the step score, so they count toward bonus time', () => {
    expect(mainSrc).toMatch(/const points = scoreFor\(runs, cascade\) \+ blastScore\(plan, cascade\)/);
    expect(mainSrc).toMatch(/bonusSeconds\(score, score \+ points\)/);
  });

  it('keeps the blast duration in sync with CSS', () => {
    expect(mainSrc).toContain("setProperty('--blast-ms'");
    expect(css).toMatch(/\.blast\s*\{[^}]*var\(--blast-ms\)/);
  });
});
