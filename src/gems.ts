// Neon gem artwork: one SVG outline shape + colour per gem type.

interface GemStyle {
  color: string;
  shape: string; // SVG markup inside a 100x100 viewBox
}

const STYLES: GemStyle[] = [
  { color: '#ff2bd6', shape: '<circle cx="50" cy="50" r="34"/>' },
  { color: '#00f0ff', shape: '<polygon points="50,12 88,50 50,88 12,50"/>' },
  { color: '#39ff14', shape: '<polygon points="50,14 88,82 12,82"/>' },
  { color: '#fff200', shape: '<rect x="20" y="20" width="60" height="60" rx="8"/>' },
  { color: '#ff8c1a', shape: '<polygon points="50,12 83,31 83,69 50,88 17,69 17,31"/>' },
  {
    color: '#b44dff',
    shape: '<polygon points="50,10 61,38 90,38 66,56 75,86 50,68 25,86 34,56 10,38 39,38"/>',
  },
  { color: '#ff3b5c', shape: '<path d="M50 84 L18 52 A17 17 0 0 1 50 26 A17 17 0 0 1 82 52 Z"/>' },
];

export function gemColor(type: number): string {
  return STYLES[type].color;
}

export function gemSvg(type: number): string {
  const { color, shape } = STYLES[type];
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <g fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="6" stroke-linejoin="round">${shape}</g>
    <g fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="2" stroke-linejoin="round" transform="translate(50 50) scale(0.55) translate(-50 -50)">${shape}</g>
  </svg>`;
}
