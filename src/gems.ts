// Gem artwork: one SVG shape per gem type, drawn with 3D-style layers.
//
// Colours come from the active theme in CSS (an element with data-type="N" gets
// --c: var(--gem-N)), so gems recolour on theme change. The 3D layers (shading and
// gloss) are colour-independent white/black gradients, so they
// are defined once per document in gemDefsSvg() and shared by every gem. Those
// neutral white/black luminance gradients are the one deliberate exception to
// "no colours outside the theme tokens"; themes control their strength via
// --gem-shade / --gem-gloss. The bomb's spark (fire gradient) is the other
// fixed-colour exception: it is the same flame in every theme.

import { ANIMAL_POOL, DEFAULT_CAST, animalSvg, type AnimalCast } from './animals';
import type { GemStyleId } from './settings';

interface GemShape {
  /** SVG element(s) in a 100x100 viewBox. */
  shape: string;
  /** Visual centre of the shape (the centroid for the triangle etc.), used to place the gloss. */
  cx: number;
  cy: number;
  /** Gloss highlight centre; defaults to up-left of (cx, cy). Set it where that point
   *  would fall outside the shape (star notch, triangle edge). */
  gx?: number;
  gy?: number;
}

const SHAPES: GemShape[] = [
  { shape: '<circle cx="50" cy="50" r="34"/>', cx: 50, cy: 50 },
  { shape: '<polygon points="50,12 88,50 50,88 12,50"/>', cx: 50, cy: 50 },
  { shape: '<polygon points="50,14 88,82 12,82"/>', cx: 50, cy: 60, gx: 43, gy: 52 },
  { shape: '<rect x="20" y="20" width="60" height="60" rx="8"/>', cx: 50, cy: 50 },
  { shape: '<polygon points="50,12 83,31 83,69 50,88 17,69 17,31"/>', cx: 50, cy: 50 },
  {
    shape: '<polygon points="50,10 61,38 90,38 66,56 75,86 50,68 25,86 34,56 10,38 39,38"/>',
    cx: 50,
    cy: 52,
    gx: 45,
    gy: 44,
  },
  { shape: '<path d="M50 84 L18 52 A17 17 0 0 1 50 26 A17 17 0 0 1 82 52 Z"/>', cx: 50, cy: 55 },
];

export const GEM_DEFS_ID = 'gem-defs';

/**
 * SVG for one gem in the given style. For animals, `cast` says which pool animal
 * draws each gem type (see animals.ts); shapes ignore it.
 */
export function gemSvg(
  type: number,
  style: GemStyleId = 'shapes',
  cast: AnimalCast = DEFAULT_CAST,
  bomb = false,
): string {
  if (style === 'animals') {
    const animal = animalSvg(ANIMAL_POOL[cast[type]]);
    // Animals are told apart by the animal, so a bomb keeps its face and wears a
    // small (untinted) bomb badge in the corner.
    if (!bomb) return animal;
    // A <g>, not a nested <svg>: `.gem svg` rules (size, pop, pulse) must not apply twice.
    const badge = `<g class="bomb-badge" transform="translate(50 50) scale(0.58)">${bombLayers(false)}</g>`;
    return animal.replace(/<\/svg>$/, `${badge}</svg>`);
  }
  if (bomb) return `<svg viewBox="0 0 100 100" aria-hidden="true">${bombLayers(true)}</svg>`;
  const { shape, cx, cy, gx = cx - 13, gy = cy - 17 } = SHAPES[type];
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <g class="gem-body">${shape}</g>
    <g clip-path="url(#gem-clip-${type})">
      <rect class="gem-shade" x="0" y="0" width="100" height="100" fill="url(#gem-shade-grad)"/>
      <ellipse class="gem-gloss" cx="${gx}" cy="${gy}" rx="15" ry="8" transform="rotate(-30 ${gx} ${gy})" fill="url(#gem-gloss-grad)"/>
    </g>
  </svg>`;
}

/**
 * The bomb (issue #28; design from public/previews/bomb.html): round body, metal
 * cap, striped fuse with a flickering spark, and a wicked face. On the board the
 * body is tinted and rimmed with the gem colour (--fc/--c), since a bomb matches
 * by colour. Colours are --bomb-* theme tokens; the spark's fire gradient lives in
 * the shared defs.
 */
function bombLayers(tinted: boolean): string {
  const tint = tinted ? '<circle class="bomb-tint" cx="46" cy="58" r="31"/>' : '';
  return `<path d="M66 30 C 72 20, 76 22, 80 14" fill="none" stroke="var(--bomb-fuse)" stroke-width="4" stroke-linecap="round"/>
    <path d="M66 30 C 72 20, 76 22, 80 14" fill="none" stroke="var(--bomb-fuse-band)" stroke-width="4" stroke-dasharray="2 4"/>
    <rect x="56" y="24" width="16" height="12" rx="2.5" transform="rotate(38 64 30)" fill="var(--bomb-cap)" stroke="var(--bomb-rim)" stroke-width="2.5"/>
    <circle class="bomb-body" cx="46" cy="58" r="31"/>${tint}
    <circle class="${tinted ? 'bomb-ring' : 'bomb-rim'}" cx="46" cy="58" r="31"/>
    <g clip-path="url(#gem-clip-bomb)">
      <rect class="gem-shade" x="0" y="0" width="100" height="100" fill="url(#gem-shade-grad)"/>
      <ellipse class="gem-gloss" cx="30" cy="38" rx="11" ry="6" transform="rotate(-35 30 38)" fill="url(#gem-gloss-grad)"/>
    </g>
    <path d="M24 44 L41 51 M68 44 L51 51" stroke="var(--bomb-face)" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M27 54 Q34 50 40 56 Q33 60 27 54Z M65 54 Q58 50 52 56 Q59 60 65 54Z" fill="var(--bomb-face)"/>
    <circle cx="36" cy="55.5" r="2.2" fill="var(--bomb-eye)"/>
    <circle cx="56" cy="55.5" r="2.2" fill="var(--bomb-eye)"/>
    <path d="M24 64 Q46 72 68 64 Q62 84 46 84 Q30 84 24 64Z" fill="var(--bomb-mouth)"/>
    <path d="M26 65.5 Q46 73 66 65.5 L64 70 Q46 76 28 70Z" fill="var(--bomb-face)"/>
    <path d="M34 69 v3.5 M40 70.5 v4 M46 71 v4 M52 70.5 v4 M58 69 v3.5" stroke="var(--bomb-body)" stroke-width="1.2"/>
    <polygon class="bomb-spark" points="83,1 85.5,9 94,7 88,13 94,19 85.5,17 83,25 80.5,17 72,19 78,13 72,7 80.5,9" fill="url(#gem-fire-grad)"/>`;
}

/**
 * Shared <defs> for all gems: per-type clip paths, the shading and gloss
 * gradients, and the right-half clip for the animals' shaded side. Hidden with
 * zero size rather than display:none, which would stop gradients resolving in
 * some browsers.
 */
export function gemDefsSvg(): string {
  const clips = SHAPES.map((s, t) => `<clipPath id="gem-clip-${t}">${s.shape}</clipPath>`).join('');
  return `<svg id="${GEM_DEFS_ID}" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">
    <defs>
      ${clips}
      <clipPath id="gem-clip-bomb"><circle cx="46" cy="58" r="31"/></clipPath>
      <clipPath id="gem-half-right"><rect x="50" y="-10" width="70" height="130"/></clipPath>
      <linearGradient id="gem-shade-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.6"/>
        <stop offset="0.42" stop-color="#fff" stop-opacity="0"/>
        <stop offset="0.58" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.55"/>
      </linearGradient>
      <radialGradient id="gem-gloss-grad">
        <stop offset="0" stop-color="#fff" stop-opacity="1"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="gem-fire-grad">
        <stop offset="0" stop-color="#fff"/>
        <stop offset="0.35" stop-color="#ffe14d"/>
        <stop offset="1" stop-color="#ff5a1f"/>
      </radialGradient>
    </defs>
  </svg>`;
}

/** Adds the shared gem defs to the page once. Call before rendering any gem. */
export function installGemDefs(): void {
  if (!document.getElementById(GEM_DEFS_ID)) {
    document.body.insertAdjacentHTML('afterbegin', gemDefsSvg());
  }
}
