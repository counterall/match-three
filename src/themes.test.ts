// Issue #24: the Dark (black & white) theme was removed; Neon and Pastel remain.
import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import { MESSAGES } from './i18n';
import { DEFAULT_SETTINGS, THEMES, parseSettings } from './settings';

describe('themes', () => {
  it('offers only Neon and Pastel', () => {
    expect(THEMES.map((th) => th.id)).toEqual(['neon', 'pastel']);
  });

  it('has a token block for every theme and none for removed ones', () => {
    const blocks = [...css.matchAll(/\[data-theme='([\w-]+)'\]\s*\{/g)].map((m) => m[1]);
    expect(blocks.sort()).toEqual(THEMES.map((th) => th.id).sort());
  });

  it('lays the theme picker out in as many columns as there are themes', () => {
    const grid = css.match(/\.theme-grid\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(grid).toMatch(new RegExp(`grid-template-columns:\\s*repeat\\(${THEMES.length},`));
  });

  it('drops the Dark label from every language', () => {
    for (const messages of Object.values(MESSAGES)) {
      expect(messages).not.toHaveProperty('themeDark');
    }
  });

  it('moves players who saved Dark to Neon and keeps their other settings', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('neon');
    expect(parseSettings('{"theme":"dark","timeLimit":10,"language":"zh-CN","gemStyle":"animals"}', 'en')).toEqual({
      theme: 'neon',
      timeLimit: 10,
      language: 'zh-CN',
      gemStyle: 'animals',
    });
  });
});
