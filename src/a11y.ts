// Accessible names for gems (issue #38), pure and tested in a11y.test.ts.

import type { AnimalCast } from './animals';
import type { LineDir } from './board';
import type { GemMark } from './gems';
import { t, type Language, type MessageKey } from './i18n';
import type { GemStyleId } from './settings';

/** One name per gem type, in the order of SHAPES in gems.ts. */
export const SHAPE_NAME_KEYS: readonly MessageKey[] = [
  'shapeCircle',
  'shapeDiamond',
  'shapeTriangle',
  'shapeSquare',
  'shapeHexagon',
  'shapeStar',
  'shapeHeart',
];

/** One name per entry of ANIMAL_POOL, in its order. */
export const ANIMAL_NAME_KEYS: readonly MessageKey[] = [
  'animalTerrier',
  'animalHusky',
  'animalFrog',
  'animalParrot',
  'animalShiba',
  'animalPenguin',
  'animalBear',
  'animalTiger',
];

const DIR_KEYS: Record<LineDir, MessageKey> = {
  row: 'lineDirRow',
  col: 'lineDirCol',
  diag: 'lineDirDiag',
  anti: 'lineDirAnti',
};

/** What a gem of this type is called in this style: its shape, or the animal drawn for it. */
export function gemName(lang: Language, type: number, style: GemStyleId, cast: AnimalCast): string {
  const key = style === 'animals' ? ANIMAL_NAME_KEYS[cast[type] ?? type] : SHAPE_NAME_KEYS[type];
  return t(lang, key ?? 'shapeCircle');
}

/** The full accessible name: what it is, its special kind and direction, and where (1-based). */
export function gemLabel(lang: Language, name: string, mark: GemMark, row: number, col: number): string {
  const params = { name, row: row + 1, col: col + 1 };
  if (mark.special === 'bomb') return t(lang, 'gemLabelBomb', params);
  if (mark.special === 'line') return t(lang, 'gemLabelLine', { ...params, dir: t(lang, DIR_KEYS[mark.dir ?? 'row']) });
  return t(lang, 'gemLabel', params);
}
