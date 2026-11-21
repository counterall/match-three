// Issue #32: how line gems (and, now, every special) are drawn and wired into the game.
import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import mainSrc from './main.ts?raw';
import { GEM_TYPES, type LineDir } from './board';
import { gemDefsSvg, gemSvg, LINE_BADGE_ANGLE } from './gems';
import { THEMES } from './settings';

const types = Array.from({ length: GEM_TYPES }, (_, t) => t);
const DIRS: LineDir[] = ['row', 'col', 'diag', 'anti'];
const tokenBlock = (theme: string): string =>
  css.match(new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`))?.[1] ?? '';
const reducedCss = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');

describe('line gem artwork', () => {
  it('points the badge arrow the way the gem fires', () => {
    expect(LINE_BADGE_ANGLE).toEqual({ row: 0, col: 90, diag: 45, anti: -45 });
  });

  for (const style of ['shapes', 'animals'] as const) {
    it(`(${style}) keeps the plain gem and adds a corner badge for each direction`, () => {
      for (const t of types) {
        const plain = gemSvg(t, style);
        for (const dir of DIRS) {
          const svg = gemSvg(t, style, undefined, { special: 'line', dir });
          expect(svg.startsWith(plain.replace(/<\/svg>\s*$/, ''))).toBe(true);
          expect(svg).toContain('class="line-badge"');
          expect(svg).toContain(`rotate(${LINE_BADGE_ANGLE[dir]})`);
          expect(svg.match(/<svg/g)).toHaveLength(1);
          expect(svg).not.toMatch(/\sid=/);
          expect(svg).not.toContain('bomb');
        }
      }
    });
  }

  it('uses only shared defs', () => {
    const defs = gemDefsSvg();
    for (const dir of DIRS) {
      for (const [, id] of gemSvg(3, 'shapes', undefined, { special: 'line', dir }).matchAll(/url\(#([\w-]+)\)/g)) {
        expect(defs).toContain(`id="${id}"`);
      }
    }
  });

  it('colours the badge from theme tokens defined in every theme', () => {
    for (const { id } of THEMES) {
      for (const token of ['--line-badge-bg', '--line-badge-fg', '--beam-core']) expect(tokenBlock(id)).toContain(`${token}:`);
    }
    expect(css).toMatch(/\.line-badge-disc\s*\{[^}]*fill:\s*var\(--line-badge-bg\)/);
    expect(css).toMatch(/\.line-badge-disc\s*\{[^}]*stroke:\s*var\(--line-badge-fg\)/);
    expect(css).toMatch(/\.line-badge-head\s*\{[^}]*fill:\s*var\(--line-badge-fg\)/);
  });
});

describe('bombs in Shapes style (issue #32: badge, like Animals)', () => {
  it('keep the shape and add the bomb badge', () => {
    for (const t of types) {
      const plain = gemSvg(t, 'shapes');
      const svg = gemSvg(t, 'shapes', undefined, { special: 'bomb' });
      expect(svg.startsWith(plain.replace(/<\/svg>\s*$/, ''))).toBe(true);
      expect(svg).toContain('class="bomb-badge"');
      expect(svg).not.toContain('bomb-tint');
      expect(svg.match(/<svg/g)).toHaveLength(1);
    }
  });
});

describe('main.ts wiring', () => {
  it('applies the step’s new specials and redraws them with their direction', () => {
    expect(mainSrc).toMatch(/applySpecials\(grid, plan\.made\)/);
    expect(mainSrc).toContain('el.dataset.dir');
    expect(mainSrc).toMatch(/plan\.fired\.forEach\(/);
  });

  it('pops beamed gems as the beam passes and waits for the last one (or the flash)', () => {
    expect(mainSrc).toMatch(/beamReach\(grid, plan\.fired\)/);
    expect(mainSrc).toContain("setProperty('--pop-delay'");
    expect(mainSrc).toMatch(/await wait\(stepWaitMs\(motion\.popMs, lastPop, flashing, motion\.blastMs\)\)/);
    expect(mainSrc).toMatch(/const flashing = plan\.detonated\.length > 0 \|\| \(motion\.reduced && plan\.fired\.length > 0\)/);
    expect(css).toMatch(/\.gem\.pop svg\s*\{[^}]*var\(--pop-delay, 0ms\)/);
  });
});

describe('beam', () => {
  it('sweeps out from the gem (scaleX from 0) over one pop, glowing in the gem colour', () => {
    expect(css).toMatch(/\.beam\s*\{[^}]*animation:\s*beam var\(--pop-ms\)/);
    expect(css).toMatch(/\.beam\s*\{[^}]*var\(--c\)/);
    expect(css).toMatch(/\.beam\s*\{[^}]*var\(--beam-core\)/);
    expect(css).toMatch(/@keyframes beam\s*\{[\s\S]*?scaleX\(0\)/);
  });

  it('is a plain flash under reduced motion', () => {
    expect(reducedCss).toMatch(/\.beam\s*\{\s*animation-name:\s*beam-flash;\s*animation-duration:\s*var\(--blast-ms\)/);
    const flash = css.match(/@keyframes beam-flash\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(flash).toContain('opacity');
    expect(flash).not.toContain('scaleX(0)');
  });

  it('pops fresh specials in (and not under reduced motion)', () => {
    expect(mainSrc).toContain("classList.add('special-made')");
    expect(css).toMatch(/\.gem\.special-made svg\s*\{[^}]*animation/);
    expect(reducedCss).toMatch(/\.gem\.special-made svg/);
  });
});
