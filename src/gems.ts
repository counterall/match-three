// Gem artwork: one SVG shape per gem type, drawn with 3D-style layers.
//
// Colours come from the active theme in CSS (an element with data-type="N" gets
// --c: var(--gem-N)), so gems recolour on theme change. The 3D layers (shading,
// raised table facet, gloss) are colour-independent white/black gradients, so they
// are defined once per document in gemDefsSvg() and shared by every gem. Those
// neutral white/black luminance gradients are the one deliberate exception to
// "no colours outside the theme tokens"; themes control their strength via
// --gem-shade / --gem-table / --gem-gloss.

interface GemShape {
  /** SVG element(s) in a 100x100 viewBox. */
  shape: string;
  /** Visual centre the table facet is scaled around (the centroid for the triangle etc.). */
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
const TABLE_SCALE = 0.55;

export function gemSvg(type: number): string {
  const { shape, cx, cy, gx = cx - 13, gy = cy - 17 } = SHAPES[type];
  const table = `translate(${cx} ${cy}) scale(${TABLE_SCALE}) translate(${-cx} ${-cy})`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <g class="gem-body">${shape}</g>
    <g clip-path="url(#gem-clip-${type})">
      <rect class="gem-shade" x="0" y="0" width="100" height="100" fill="url(#gem-shade-grad)"/>
      <g class="gem-table" fill="url(#gem-table-grad)" transform="${table}">${shape}</g>
      <ellipse class="gem-gloss" cx="${gx}" cy="${gy}" rx="15" ry="8" transform="rotate(-30 ${gx} ${gy})" fill="url(#gem-gloss-grad)"/>
    </g>
  </svg>`;
}

/**
 * Shared <defs> for all gems: per-type clip paths plus the shading, table and gloss
 * gradients. Hidden with zero size rather than display:none, which would stop
 * gradients resolving in some browsers.
 */
export function gemDefsSvg(): string {
  const clips = SHAPES.map((s, t) => `<clipPath id="gem-clip-${t}">${s.shape}</clipPath>`).join('');
  return `<svg id="${GEM_DEFS_ID}" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">
    <defs>
      ${clips}
      <linearGradient id="gem-shade-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.6"/>
        <stop offset="0.42" stop-color="#fff" stop-opacity="0"/>
        <stop offset="0.58" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.55"/>
      </linearGradient>
      <linearGradient id="gem-table-grad" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0.05"/>
      </linearGradient>
      <radialGradient id="gem-gloss-grad">
        <stop offset="0" stop-color="#fff" stop-opacity="1"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
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
