import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import { LANGUAGES, MESSAGES, detectLanguage, isLanguage, t, type MessageKey } from './i18n';

const keys = Object.keys(MESSAGES.en) as MessageKey[];

describe('languages', () => {
  it('offers English and Simplified Chinese, each named in its own language', () => {
    expect(LANGUAGES.map((l) => l.id)).toEqual(['en', 'zh-CN']);
    expect(LANGUAGES.find((l) => l.id === 'en')!.label).toBe('English');
    expect(LANGUAGES.find((l) => l.id === 'zh-CN')!.label).toBe('简体中文');
  });

  it('validates language ids', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('zh-CN')).toBe(true);
    for (const v of ['zh', 'zh-TW', 'EN', 'fr', '', null, 3, undefined]) expect(isLanguage(v)).toBe(false);
  });
});

describe('messages', () => {
  it('translates every key into every language, with no blanks', () => {
    for (const { id } of LANGUAGES) {
      expect(Object.keys(MESSAGES[id]).sort()).toEqual([...keys].sort());
      for (const k of keys) expect(MESSAGES[id][k].trim(), `${id}.${k}`).not.toBe('');
    }
  });

  it('actually translates into Chinese (no English left over)', () => {
    for (const k of keys) expect(MESSAGES['zh-CN'][k], k).toMatch(/[一-鿿]/);
  });

  it('keeps the same {placeholders} in every language', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of keys) expect(ph(MESSAGES['zh-CN'][k]), k).toEqual(ph(MESSAGES.en[k]));
  });

  it('fills placeholders', () => {
    expect(t('en', 'cascade', { n: 3 })).toBe('Cascade ×3');
    expect(t('zh-CN', 'cascade', { n: 3 })).toBe('连锁 ×3');
    expect(t('en', 'bonusTime', { s: 20 })).toBe('+20s');
    expect(t('zh-CN', 'bonusTime', { s: 20 })).toBe('+20秒');
    expect(t('en', 'minutes', { n: 5 })).toBe('5 min');
    expect(t('zh-CN', 'minutes', { n: 5 })).toBe('5 分钟');
    expect(t('en', 'pause')).toBe('Pause');
  });
});

describe('index.html', () => {
  // No DOM in the test environment, so read the markup with patterns. Translated
  // elements hold plain text only: <tag ... data-i18n="key">Text</tag>.
  const body = html.slice(html.indexOf('<body'), html.indexOf('<script type="module"'));
  const tagged = [...body.matchAll(/<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>([^<]*)<\/\1>/g)].map((m) => ({ key: m[2], text: m[3] }));
  const labelled = [...body.matchAll(/<[^>]*\saria-label="([^"]*)"[^>]*>/g)].map((m) => ({
    tag: m[0],
    label: m[1],
    key: m[0].match(/data-i18n-label="([^"]+)"/)?.[1],
  }));

  it('tags every visible text with a known message key', () => {
    expect(tagged.length).toBeGreaterThan(15);
    expect(body.match(/data-i18n="/g)!.length).toBe(tagged.length); // all tagged elements are text-only
    for (const { key } of tagged) expect(keys).toContain(key);
  });

  it('ships the English text, so the page reads right before scripts run', () => {
    for (const { key, text } of tagged) expect(text, key).toBe(MESSAGES.en[key as MessageKey]);
    for (const { tag, label, key } of labelled) {
      if (tag.includes('id="pause"')) continue; // main.ts owns it (Pause/Resume)
      expect(key, tag).toBeDefined();
      expect(label, tag).toBe(MESSAGES.en[key as MessageKey]);
    }
  });

  it('leaves no untranslated text outside tagged elements (except the game name)', () => {
    const rest = body
      .replace(/<h1 class="title">.*?<\/h1>/s, '')
      .replace(/<svg[\s\S]*?<\/svg>/g, '')
      .replace(/<(\w+)[^>]*\sdata-i18n="[^"]+"[^>]*>[^<]*<\/\1>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&times;|[\s0-9:]/g, '');
    expect(rest).toBe('');
  });
});

describe('detectLanguage', () => {
  it('picks Chinese for any Chinese browser language', () => {
    for (const l of ['zh-CN', 'zh', 'zh-Hans', 'zh-SG', 'zh-Hans-CN', 'zh-TW', 'ZH-cn']) expect(detectLanguage([l]), l).toBe('zh-CN');
  });

  it('defaults to English otherwise', () => {
    expect(detectLanguage([])).toBe('en');
    expect(detectLanguage(['fr-FR', 'de'])).toBe('en');
    expect(detectLanguage(['en-GB'])).toBe('en');
  });

  it('follows the first listed language it supports', () => {
    expect(detectLanguage(['fr', 'zh-CN', 'en'])).toBe('zh-CN');
    expect(detectLanguage(['en-US', 'zh-CN'])).toBe('en');
  });
});

describe('index.html head script (language before first paint)', () => {
  const source = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  function run(saved: unknown, languages: string[], language = languages[0]) {
    const root = { dataset: {} as Record<string, string>, lang: '' };
    const storage = { getItem: () => (saved === undefined ? null : JSON.stringify(saved)) };
    new Function('document', 'localStorage', 'navigator', source)({ documentElement: root }, storage, { languages, language });
    return root;
  }

  it('agrees with detectLanguage when nothing is saved', () => {
    for (const prefs of [[], ['zh-CN'], ['zh-TW'], ['en-US', 'zh-CN'], ['fr', 'zh-Hans'], ['fr', 'de'], ['ZH']]) {
      expect(run(undefined, prefs).lang, prefs.join()).toBe(detectLanguage(prefs));
    }
  });

  it('prefers a valid saved language and ignores an invalid one', () => {
    expect(run({ language: 'en' }, ['zh-CN']).lang).toBe('en');
    expect(run({ language: 'zh-CN' }, ['en']).lang).toBe('zh-CN');
    expect(run({ language: 'klingon' }, ['zh-CN']).lang).toBe('zh-CN');
    expect(run(null, ['zh-CN']).lang).toBe('zh-CN');
  });

  it('hides the page until translated only when the language is not English', () => {
    expect('i18nPending' in run(undefined, ['zh-CN']).dataset).toBe(true);
    expect('i18nPending' in run(undefined, ['en']).dataset).toBe(false);
    expect('i18nPending' in run({ language: 'en' }, ['zh-CN']).dataset).toBe(false);
  });

  it('still applies the saved theme', () => {
    expect(run({ theme: 'dark' }, ['en']).dataset.theme).toBe('dark');
  });

  it('pairs the pending flag with a rule that hides the body', () => {
    expect(html).toMatch(/html\[data-i18n-pending\] body \{ visibility: hidden; \}/);
  });
});
