// Gem artwork: one SVG shape per gem type. Colours come from the active theme in CSS
// (an element with data-type="N" gets --c: var(--gem-N)), so gems recolour on theme change.

const SHAPES: string[] = [
  '<circle cx="50" cy="50" r="34"/>',
  '<polygon points="50,12 88,50 50,88 12,50"/>',
  '<polygon points="50,14 88,82 12,82"/>',
  '<rect x="20" y="20" width="60" height="60" rx="8"/>',
  '<polygon points="50,12 83,31 83,69 50,88 17,69 17,31"/>',
  '<polygon points="50,10 61,38 90,38 66,56 75,86 50,68 25,86 34,56 10,38 39,38"/>',
  '<path d="M50 84 L18 52 A17 17 0 0 1 50 26 A17 17 0 0 1 82 52 Z"/>',
];

export function gemSvg(type: number): string {
  const shape = SHAPES[type];
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <g class="gem-body">${shape}</g>
    <g class="gem-inner" transform="translate(50 50) scale(0.55) translate(-50 -50)">${shape}</g>
  </svg>`;
}
