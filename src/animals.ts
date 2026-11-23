// Animal gem style: flat, geometric animal faces. A pool of eight; each game draws
// seven of them at random (drawCast), one per gem type.
//
// Each face is drawn twice: once in its lit colours, then again in shaded colours
// clipped to the right half (#gem-half-right, defined once in gemDefsSvg()), which
// gives the flat "lit from the left" look. Unlike the shapes, the animals keep
// natural fur colours in every theme and sit straight on the board, with no tile in
// the gem's theme colour (issue #20: with a random draw, a tile colour would mean a
// different animal each game). These hex colours are a deliberate exception to the
// "colours only in theme tokens" rule.

import { GEM_TYPES, type Rng } from './board';

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

const TERRIER: Animal = {
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
};


const HUSKY: Animal = {
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
};


const FROG: Animal = {
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
};


const GOLDEN_RETRIEVER: Animal = {
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
};


const PENGUIN: Animal = {
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
};


// Replaced the penguin in the pool (issue #40). No tusks: ivory read as vague on Pastel.
const ELE_SKIN = ['#a7b2bd', '#8f9ba7'] as const;
const ELE_EAR = ['#97a3af', '#808c98'] as const;
const ELE_PINK = ['#eab4b4', '#d79e9f'] as const;
const ELE_LINES = ['#8b97a3', '#77838f'] as const;
const ELEPHANT: Animal = {
  name: 'Elephant',
  parts: [
    [P('M32 20 C14 10 2 26 3 46 C4 64 16 74 32 68 Z'), ...ELE_EAR],
    [P('M68 20 C86 10 98 26 97 46 C96 64 84 74 68 68 Z'), ...ELE_EAR],
    [P('M30 27 C18 21 10 32 11 46 C12 59 20 64 30 61 Z'), ...ELE_PINK],
    [P('M70 27 C82 21 90 32 89 46 C88 59 80 64 70 61 Z'), ...ELE_PINK],
    [P('M50 8 C68 8 77 22 77 40 C77 55 69 64 60 66 L40 66 C31 64 23 55 23 40 C23 22 32 8 50 8 Z'), ...ELE_SKIN],
    // Trunk: symmetric about x=50 (43..57 mid-way, 45..55 at the tip), so its lit and
    // shaded halves match; only the curl turns right.
    [P('M41 50 L59 50 Q57 70 55 82 Q55 88 60 88 Q64 88 64 84 L69 85 Q68 94 59 94 Q46 94 45 84 Q43 70 41 50 Z'), ...ELE_SKIN],
    [R(44, 66, 12, 1.8, 0.9), ...ELE_LINES],
    [R(45, 72, 10, 1.8, 0.9), ...ELE_LINES],
    [R(46, 78, 8, 1.8, 0.9), ...ELE_LINES],
    [R(34, 38, 7, 7), ...INK],
    [R(59, 38, 7, 7), ...INK],
  ],
};


const BEAR: Animal = {
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
};

const BLACK = ['#4a4f57', '#3a3e45'] as const;
const TAN = ['#d9a066', '#c68b50'] as const;
const CREAM = ['#fbf3e8', '#eee3d3'] as const;
const BLACK_SHIBA: Animal = {
  name: 'Black Shiba',
  parts: [
    [POLY('22,8 45,26 26,40'), ...BLACK],
    [POLY('78,8 55,26 74,40'), ...BLACK],
    [POLY('26,16 38,27 28,34'), ...CREAM],
    [POLY('74,16 62,27 72,34'), ...CREAM],
    [POLY('30,24 70,24 84,44 87,62 75,80 50,89 25,80 13,62 16,44'), ...BLACK],
    [POLY('50,52 62,48 79,52 87,61 75,80 50,89 25,80 13,61 21,52 38,48'), ...TAN],
    [POLY('50,58 61,55 77,59 83,65 72,80 50,89 28,80 17,65 23,59 39,55'), ...CREAM],
    [R(33, 37, 8, 3.6), ...TAN],
    [R(59, 37, 8, 3.6), ...TAN],
    // Darker than the coat, with a white glint, so the eyes read on black fur.
    [R(34, 45, 7, 5), '#1b1e22', '#16181b'],
    [R(59, 45, 7, 5), '#1b1e22', '#16181b'],
    [R(35, 45.6, 2.2, 2.2, 0.4), '#ffffff', '#e8e8e8'],
    [R(60, 45.6, 2.2, 2.2, 0.4), '#ffffff', '#e8e8e8'],
    [POLY('44,60 56,60 58,64 50,69 42,64'), ...NOSE],
    [POLY('49,69 51,69 51,73 49,73'), ...INK],
  ],
};

const RED = ['#e5463c', '#c9352c'] as const;
const BLUE = ['#3b82d6', '#2f6fbd'] as const;
const YELLOW = ['#f5c842', '#e2b22c'] as const;
const PARROT_FACE = ['#f7f3ee', '#e7dfd6'] as const;
const PARROT_LINES = ['#c9a99c', '#b8988b'] as const;
const PARROT: Animal = {
  name: 'Parrot',
  parts: [
    [POLY('44,10 50,2 56,10'), ...RED],
    [P('M50 8 C72 8 86 26 86 50 C86 72 74 86 50 93 C26 86 14 72 14 50 C14 26 28 8 50 8 Z'), ...RED],
    [P('M14 62 C16 76 26 86 40 91 L30 74 Z'), ...BLUE],
    [P('M86 62 C84 76 74 86 60 91 L70 74 Z'), ...BLUE],
    [P('M17 60 L24 66 L22 72 Z'), ...YELLOW],
    [P('M83 60 L76 66 L78 72 Z'), ...YELLOW],
    [E(31, 47, 12, 14), ...PARROT_FACE],
    [E(69, 47, 12, 14), ...PARROT_FACE],
    [R(24, 54, 7, 1.6, 0.8), ...PARROT_LINES],
    [R(25, 58, 8, 1.6, 0.8), ...PARROT_LINES],
    [R(69, 54, 7, 1.6, 0.8), ...PARROT_LINES],
    [R(67, 58, 8, 1.6, 0.8), ...PARROT_LINES],
    [C(31, 44, 5.5), '#f5d547', '#e3c133'],
    [C(69, 44, 5.5), '#f5d547', '#e3c133'],
    [R(29.3, 42.3, 3.4, 3.4, 0.6), ...INK],
    [R(67.3, 42.3, 3.4, 3.4, 0.6), ...INK],
    // Lower beak first, so the hooked upper beak overlaps it.
    [P('M43 64 Q50 84 57 64 Q57 78 50 83 Q43 78 43 64 Z'), '#3f454b', '#2d3136'],
    [P('M41 42 Q50 36 59 42 Q63 58 54 72 Q50 77 46 72 Q37 58 41 42 Z'), '#efe6d6', '#ddd2c0'],
  ],
};

const ORANGE = ['#f08a2c', '#d9741a'] as const;
const STRIPES = ['#3a3f45', '#2b2f34'] as const;
const TIGER_WHITE = ['#fbf6ee', '#ece4d8'] as const;
const TIGER: Animal = {
  name: 'Tiger',
  parts: [
    [C(24, 24, 12), ...ORANGE],
    [C(76, 24, 12), ...ORANGE],
    [C(24, 24, 6), ...TIGER_WHITE],
    [C(76, 24, 6), ...TIGER_WHITE],
    [POLY('30,18 70,18 84,32 90,54 82,74 64,88 50,92 36,88 18,74 10,54 16,32'), ...ORANGE],
    [POLY('50,60 64,54 80,58 87,66 72,80 50,92 28,80 13,66 20,58 36,54'), ...TIGER_WHITE],
    [E(36, 39, 7, 4), ...TIGER_WHITE],
    [E(64, 39, 7, 4), ...TIGER_WHITE],
    [POLY('46,19 54,19 52,33 50,36 48,33'), ...STRIPES],
    [POLY('36,20 42,20 40,29'), ...STRIPES],
    [POLY('64,20 58,20 60,29'), ...STRIPES],
    [POLY('11,48 24,51 24,54 11,53'), ...STRIPES],
    [POLY('13,57 25,58 24,61 15,62'), ...STRIPES],
    [POLY('89,48 76,51 76,54 89,53'), ...STRIPES],
    [POLY('87,57 75,58 76,61 85,62'), ...STRIPES],
    [R(33, 45, 7, 6), ...INK],
    [R(60, 45, 7, 6), ...INK],
    [POLY('44,61 56,61 58,65 50,70 42,65'), '#e08585', '#cc6f6f'],
    [POLY('49,70 51,70 51,76 49,76'), ...INK],
  ],
};

/**
 * Every animal that can appear on the board: one more than GEM_TYPES, so each game
 * draws GEM_TYPES of them (drawCast) and one sits out.
 */
export const ANIMAL_POOL: readonly Animal[] = [TERRIER, HUSKY, FROG, PARROT, BLACK_SHIBA, ELEPHANT, BEAR, TIGER];

/**
 * Finished drawings kept for later but not used on the board: the golden retriever
 * (issue #20) and the penguin, which the elephant replaced (issue #40).
 */
export const SPARE_ANIMALS: readonly Animal[] = [GOLDEN_RETRIEVER, PENGUIN];

/** Which pool animal (index into ANIMAL_POOL) draws each gem type; index = gem type. */
export type AnimalCast = readonly number[];

/** The first GEM_TYPES animals in pool order: used where no game has drawn a cast. */
export const DEFAULT_CAST: AnimalCast = Array.from({ length: GEM_TYPES }, (_, t) => t);

/** Draw a random cast for a new game: GEM_TYPES distinct pool animals, in random order. */
export function drawCast(rng: Rng): number[] {
  const order = ANIMAL_POOL.map((_, i) => i);
  // Partial Fisher-Yates: shuffle only the slots we keep.
  for (let i = 0; i < GEM_TYPES; i++) {
    const j = i + Math.min(Math.floor(rng() * (order.length - i)), order.length - i - 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, GEM_TYPES);
}

const paint = (el: string, fill: string) => el.replace(/^<(\w+)/, `<$1 fill="${fill}"`);

/** SVG for one animal gem: lit face, then its shaded right half. No ids. */
export function animalSvg({ parts, transform }: Animal): string {
  const lit = parts.map(([el, c]) => paint(el, c)).join('');
  const shaded = parts.map(([el, , c]) => paint(el, c)).join('');
  const tf = transform ? ` transform="${transform}"` : '';
  // The viewBox margin keeps the faces the size they were drawn at with the old tiles.
  return `<svg viewBox="-6 -6 112 112" aria-hidden="true"><g class="animal-lit"${tf}>${lit}</g><g clip-path="url(#gem-half-right)"><g class="animal-shaded"${tf}>${shaded}</g></g></svg>`;
}
