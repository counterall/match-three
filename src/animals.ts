// Animal gem style: flat, geometric animal faces, one per gem type.
//
// Each face is drawn twice: once in its lit colours, then again in shaded colours
// clipped to the right half (#gem-half-right, defined once in gemDefsSvg()), which
// gives the flat "lit from the left" look. Unlike the shapes, the animals keep
// natural fur colours in every theme. These hex colours are a deliberate exception
// to the "colours only in theme tokens" rule; only the tile behind each animal
// follows the theme (CSS gives .gem-tile the gem type's --c).

export interface Animal {
  name: string;
  /** Optional transform for the face (e.g. to scale a drawing to match the others' height). */
  transform?: string;
  /** [SVG element without fill, lit colour, shaded colour], drawn in order. */
  parts: readonly (readonly [string, string, string])[];
}

const P = (d: string) => `<path d="${d}"/>`;
const POLY = (pts: string) => `<polygon points="${pts}"/>`;
const C = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
const R = (x: number, y: number, w: number, h: number, rx = 0.8) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
const E = (x: number, y: number, rx: number, ry: number) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`;

const INK = ['#454b52', '#2d3136'] as const;
const NOSE = ['#3f454b', '#26292d'] as const;

/** Index = gem type: matches the shapes (0 circle … 6 heart) and the theme colours. */
export const ANIMALS: readonly Animal[] = [
  {
    name: 'Wire fox terrier',
    // Drawn edge to edge; scaled about the centre line to the husky's height (y 6 to 92).
    transform: 'translate(7 6) scale(0.86)',
    parts: [
      [P('M31 1 Q38 9 42 11 L58 11 Q62 9 69 1 L79 24 L85 45 L80 49 L82 63 Q78 67 70 70 L30 70 Q22 67 18 63 L20 49 L15 45 L21 24 Z'), '#e0b977', '#c58a5b'],
      [P('M10 9 Q19 2 31 1 Q33 14 21 24 Z'), '#c58a5b', '#c58a5b'],
      [P('M90 9 Q81 2 69 1 Q67 14 79 24 Z'), '#a96d6a', '#a96d6a'],
      [P('M22 100 L22 80 Q22 55 50 55 Q78 55 78 80 L78 100 L62 100 Q54 98 50 90 Q46 98 38 100 Z'), '#f1ece7', '#e6d7cd'],
      [R(34, 35, 6, 6, 0), ...INK],
      [R(60, 35, 6, 6, 0), ...INK],
      [P('M50 69 Q58 69 58 75 Q57 80 50 84 Q43 80 42 75 Q42 69 50 69 Z'), ...NOSE],
    ],
  },
  {
    name: 'Husky',
    parts: [
      [POLY('20,6 44,28 24,44'), '#7c8893', '#66727c'],
      [POLY('80,6 56,28 76,44'), '#7c8893', '#66727c'],
      [POLY('24,15 37,28 26,36'), '#f2c8bf', '#e1b3a9'],
      [POLY('76,15 63,28 74,36'), '#f2c8bf', '#e1b3a9'],
      [POLY('26,28 74,28 86,56 78,80 50,93 22,80 14,56'), '#7c8893', '#66727c'],
      [POLY('50,47 59,38 73,45 81,60 73,80 50,93 27,80 19,60 27,45 41,38'), '#f4f6f8', '#e1e5ea'],
      [R(33, 39, 8, 3.2), '#f4f6f8', '#e1e5ea'],
      [R(59, 39, 8, 3.2), '#f4f6f8', '#e1e5ea'],
      [R(33, 51, 9, 7, 1.2), '#5aaee3', '#4697cc'],
      [R(58, 51, 9, 7, 1.2), '#5aaee3', '#4697cc'],
      [R(36, 53, 3.4, 3.4, 0.6), ...INK],
      [R(61, 53, 3.4, 3.4, 0.6), ...INK],
      [POLY('43,66 57,66 59,71 50,77 41,71'), ...NOSE],
    ],
  },
  {
    name: 'Frog',
    parts: [
      [P('M17 50 C14 40 18 26 30 24 C38 23 43 30 44 36 Q50 35 56 36 C57 30 62 23 70 24 C82 26 86 40 83 50 C90 58 90 74 80 80 C70 87 30 87 20 80 C10 74 10 58 17 50 Z'), '#8dc63f', '#74aa30'],
      [E(50, 72, 22, 11), '#c7e38c', '#b2d273'],
      [C(30, 37, 9), '#ffffff', '#ebeef0'],
      [C(70, 37, 9), '#ffffff', '#ebeef0'],
      [R(27, 34, 6, 7), ...INK],
      [R(67, 34, 6, 7), ...INK],
      [R(44, 53, 3, 3, 0.6), '#5e8a28', '#4f7520'],
      [R(53, 53, 3, 3, 0.6), '#5e8a28', '#4f7520'],
      [P('M30 62 Q50 74 70 62 L70 65 Q50 77 30 65 Z'), '#3f5f1c', '#34501a'],
    ],
  },
  {
    name: 'Golden retriever',
    parts: [
      [POLY('30,16 70,16 80,30 78,64 66,82 50,88 34,82 22,64 20,30'), '#e8bb68', '#d4a24f'],
      [POLY('22,24 8,36 5,62 13,78 27,72 29,40'), '#c98e3f', '#c98e3f'],
      [POLY('78,24 92,36 95,62 87,78 73,72 71,40'), '#b47c33', '#b47c33'],
      [POLY('38,55 62,55 69,70 61,84 50,88 39,84 31,70'), '#f6e1b6', '#ead0a0'],
      [R(33, 42, 7, 6), ...INK],
      [R(60, 42, 7, 6), ...INK],
      [POLY('42,56 58,56 60,61 50,67 40,61'), ...NOSE],
      [POLY('46,74 54,74 54,81 50,84 46,81'), '#ec8291', '#d86c7d'],
      [POLY('43,72 57,72 57,74 43,74'), '#8a5a2a', '#7a4e24'],
    ],
  },
  {
    name: 'Shiba',
    parts: [
      [POLY('22,8 45,26 26,40'), '#e0904a', '#cb7a35'],
      [POLY('78,8 55,26 74,40'), '#e0904a', '#cb7a35'],
      [POLY('26,16 38,27 28,34'), '#f7e6cf', '#ecd6b9'],
      [POLY('74,16 62,27 72,34'), '#f7e6cf', '#ecd6b9'],
      [POLY('30,24 70,24 84,44 87,62 75,80 50,89 25,80 13,62 16,44'), '#e0904a', '#cb7a35'],
      [POLY('50,57 62,53 79,57 86,64 73,80 50,89 27,80 14,64 21,57 38,53'), '#fbf3e8', '#eee3d3'],
      [R(33, 38, 8, 3.4), '#fbf3e8', '#eee3d3'],
      [R(59, 38, 8, 3.4), '#fbf3e8', '#eee3d3'],
      [R(34, 45, 7, 5), ...INK],
      [R(59, 45, 7, 5), ...INK],
      [POLY('44,59 56,59 58,63 50,68 42,63'), ...NOSE],
      [POLY('49,68 51,68 51,72 49,72'), ...INK],
    ],
  },
  {
    name: 'Penguin',
    parts: [
      [POLY('50,8 66,12 76,26 78,46 84,64 88,92 12,92 16,64 22,46 24,26 34,12'), '#3f464d', '#2d3338'],
      [POLY('32,60 68,60 78,74 80,92 20,92 22,74'), '#f4f6f8', '#e1e5ea'],
      [POLY('22,46 33,52 35,65 24,62'), '#f8c94a', '#e8b52f'],
      [POLY('78,46 67,52 65,65 76,62'), '#f8c94a', '#e8b52f'],
      [R(33, 31, 9, 8, 1.5), '#f4f6f8', '#e1e5ea'],
      [R(58, 31, 9, 8, 1.5), '#f4f6f8', '#e1e5ea'],
      [R(35.5, 33.5, 4.5, 4.5, 0.6), '#1d2125', '#1d2125'],
      [R(60, 33.5, 4.5, 4.5, 0.6), '#1d2125', '#1d2125'],
      [POLY('45,40 55,40 52,54 50,58 48,54'), '#f0893c', '#dc7428'],
    ],
  },
  {
    name: 'Bear',
    parts: [
      [C(25, 25, 12), '#9c6b45', '#87593a'],
      [C(75, 25, 12), '#9c6b45', '#87593a'],
      [C(25, 25, 6), '#c99a72', '#b5865f'],
      [C(75, 25, 6), '#c99a72', '#b5865f'],
      [C(50, 56, 33), '#9c6b45', '#87593a'],
      [E(50, 70, 16, 12), '#e3c4a3', '#d3b18e'],
      [R(35, 47, 7, 7), ...INK],
      [R(58, 47, 7, 7), ...INK],
      [POLY('43,62 57,62 59,66 50,71 41,66'), ...NOSE],
      [POLY('49,71 51,71 51,76 49,76'), ...INK],
    ],
  },
];

const paint = (el: string, fill: string) => el.replace(/^<(\w+)/, `<$1 fill="${fill}"`);

/** SVG for one animal gem: theme-coloured tile, lit face, shaded right half. No ids. */
export function animalSvg(type: number): string {
  const { parts, transform } = ANIMALS[type];
  const lit = parts.map(([el, c]) => paint(el, c)).join('');
  const shaded = parts.map(([el, , c]) => paint(el, c)).join('');
  const tf = transform ? ` transform="${transform}"` : '';
  // The extra viewBox margin leaves room for the tile's stroke.
  return `<svg viewBox="-6 -6 112 112" aria-hidden="true"><rect class="gem-tile" x="-4" y="-4" width="108" height="108" rx="20"/><g class="animal-lit"${tf}>${lit}</g><g clip-path="url(#gem-half-right)"><g class="animal-shaded"${tf}>${shaded}</g></g></svg>`;
}
