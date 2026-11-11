import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

describe('parseSettings', () => {
  it('returns defaults for missing or malformed data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps a valid theme', () => {
    expect(parseSettings('{"theme":"pastel"}').theme).toBe('pastel');
    expect(parseSettings('{"theme":"dark"}').theme).toBe('dark');
  });

  it('rejects an unknown theme', () => {
    expect(parseSettings('{"theme":"rainbow"}').theme).toBe(DEFAULT_SETTINGS.theme);
    // "minimal" was removed; players who had it saved fall back to the default.
    expect(parseSettings('{"theme":"minimal"}').theme).toBe(DEFAULT_SETTINGS.theme);
  });
});
