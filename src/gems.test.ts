import { describe, expect, it } from 'vitest';
import { GEM_TYPES } from './board';
import { GEM_DEFS_ID, gemDefsSvg, gemSvg } from './gems';

const types = Array.from({ length: GEM_TYPES }, (_, t) => t);

describe('gemSvg', () => {
  // Regression guard on the markup only: the old contour was a separate stroked
  // `.gem-inner` layer styled from CSS.
  it('has no white inner contour (issue #2)', () => {
    for (const t of types) {
      const svg = gemSvg(t);
      expect(svg).not.toContain('gem-inner');
      expect(svg).not.toMatch(/stroke="#fff"/i);
    }
  });

  it('layers 3D shading and a gloss highlight, clipped to the shape, with no table facet', () => {
    for (const t of types) {
      const svg = gemSvg(t);
      expect(svg).toContain('class="gem-body"');
      expect(svg).toContain(`clip-path="url(#gem-clip-${t})"`);
      expect(svg).toContain('class="gem-shade"');
      expect(svg).not.toContain('gem-table');
      expect(svg).toContain('class="gem-gloss"');
    }
  });

  it('defines no ids of its own, so many gems can share one document', () => {
    for (const t of types) expect(gemSvg(t)).not.toMatch(/\sid=/);
  });
});

describe('gemDefsSvg', () => {
  const defs = gemDefsSvg();

  it('defines one clip path per gem type and the shared gradients exactly once', () => {
    for (const t of types) expect(defs.split(`id="gem-clip-${t}"`)).toHaveLength(2);
    expect(defs).not.toContain('gem-table');
    for (const id of ['gem-shade-grad', 'gem-gloss-grad']) {
      expect(defs.split(`id="${id}"`)).toHaveLength(2);
    }
  });

  it('is an invisible but not display:none svg (gradients must still resolve)', () => {
    expect(defs).toContain(`id="${GEM_DEFS_ID}"`);
    expect(defs).not.toContain('display:none');
    expect(defs).not.toContain('display: none');
  });

  it('every url(#…) a gem uses is defined', () => {
    for (const t of types) {
      for (const [, id] of gemSvg(t).matchAll(/url\(#([\w-]+)\)/g)) {
        expect(defs).toContain(`id="${id}"`);
      }
    }
  });
});
