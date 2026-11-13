import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, TIME_LIMITS, parseSettings } from './settings';

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

describe('time limit setting', () => {
  it('offers 3, 5 and 10 minutes, defaulting to 3', () => {
    expect(TIME_LIMITS.map((t) => t.minutes)).toEqual([3, 5, 10]);
    expect(DEFAULT_SETTINGS.timeLimit).toBe(3);
    expect(parseSettings(null).timeLimit).toBe(3);
  });

  it('keeps a valid time limit', () => {
    expect(parseSettings('{"timeLimit":5}').timeLimit).toBe(5);
    expect(parseSettings('{"timeLimit":10}').timeLimit).toBe(10);
  });

  it('falls back to 3 minutes for invalid values', () => {
    for (const v of ['4', '"5"', '0', '-3', '1e9', 'null', 'true', '[5]', '5.5']) {
      expect(parseSettings(`{"timeLimit":${v}}`).timeLimit).toBe(3);
    }
  });

  it('keeps settings saved before time limits existed working', () => {
    expect(parseSettings('{"theme":"pastel"}')).toEqual({ theme: 'pastel', timeLimit: 3, language: 'en' });
  });

  it('parses theme and time limit independently', () => {
    expect(parseSettings('{"theme":"rainbow","timeLimit":10}')).toMatchObject({ theme: 'neon', timeLimit: 10 });
    expect(parseSettings('{"theme":"dark","timeLimit":7}')).toMatchObject({ theme: 'dark', timeLimit: 3 });
  });
});

describe('language setting', () => {
  it('defaults to English', () => {
    expect(DEFAULT_SETTINGS.language).toBe('en');
    expect(parseSettings(null).language).toBe('en');
  });

  it('keeps a valid saved language', () => {
    expect(parseSettings('{"language":"zh-CN"}').language).toBe('zh-CN');
    expect(parseSettings('{"language":"en"}', 'zh-CN').language).toBe('en');
  });

  it('uses the given fallback (the browser language) when nothing valid is saved', () => {
    expect(parseSettings(null, 'zh-CN').language).toBe('zh-CN');
    expect(parseSettings('{"language":"klingon"}', 'zh-CN').language).toBe('zh-CN');
    expect(parseSettings('{"language":"fr"}').language).toBe('en');
  });

  it('keeps older saved settings working, and parses language independently', () => {
    expect(parseSettings('{"theme":"dark","timeLimit":5}', 'zh-CN')).toEqual({ theme: 'dark', timeLimit: 5, language: 'zh-CN' });
    expect(parseSettings('{"theme":"rainbow","language":"zh-CN"}')).toEqual({ theme: 'neon', timeLimit: 3, language: 'zh-CN' });
  });
});
