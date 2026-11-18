// Issue #34: combo callouts (tiered words per cascade step, special tags, move total).
import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import mainSrc from './main.ts?raw';
import {
  CALLOUT_MS,
  LONG_CALLOUT_MS,
  calloutKey,
  calloutMs,
  comboTier,
  showMoveTotal,
  stepCallout,
} from './combo';
import { MESSAGES, t } from './i18n';
import { THEMES } from './settings';

const tokenBlock = (theme: string): string =>
  css.match(new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`))?.[1] ?? '';
const reducedCss = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
  .map((m) => m[1])
  .join('\n');

describe('comboTier', () => {
  it('gives no word on step 1 and climbs to tier 4 from step 5', () => {
    expect(comboTier(1)).toBe(0);
    expect(comboTier(2)).toBe(1);
    expect(comboTier(3)).toBe(2);
    expect(comboTier(4)).toBe(3);
    expect(comboTier(5)).toBe(4);
    expect(comboTier(12)).toBe(4);
  });

  it('maps each tier to its word', () => {
    expect(calloutKey(0)).toBeNull();
    expect(calloutKey(1)).toBe('comboNice');
    expect(calloutKey(2)).toBe('comboGreat');
    expect(calloutKey(3)).toBe('comboSuperb');
    expect(calloutKey(4)).toBe('comboIncredible');
  });
});

describe('showMoveTotal', () => {
  it('shows the move total from 3 steps, not at 2', () => {
    expect(showMoveTotal(1)).toBe(false);
    expect(showMoveTotal(2)).toBe(false);
    expect(showMoveTotal(3)).toBe(true);
    expect(showMoveTotal(9)).toBe(true);
  });
});

describe('stepCallout', () => {
  it('shows nothing for a plain step 1', () => {
    expect(stepCallout(1, [], 0)).toBeNull();
  });

  it('shows the tag alone on step 1 when it makes a special', () => {
    expect(stepCallout(1, [{ special: 'bomb' }], 0)).toEqual({ step: 1, tier: 0, tags: ['bomb'], bonus: 0 });
    expect(stepCallout(1, [{ special: 'line' }], 0)).toEqual({ step: 1, tier: 0, tags: ['line'], bonus: 0 });
  });

  it('shows each kind once, bomb first, when a step makes several', () => {
    const made = [{ special: 'line' as const }, { special: 'bomb' as const }, { special: 'bomb' as const }];
    expect(stepCallout(3, made, 0)?.tags).toEqual(['bomb', 'line']);
  });

  it('shows a lone time bonus on step 1', () => {
    expect(stepCallout(1, [], 20)).toEqual({ step: 1, tier: 0, tags: [], bonus: 20 });
  });

  it('carries the tier, tags and bonus of a chain step', () => {
    expect(stepCallout(3, [{ special: 'bomb' }], 20)).toEqual({ step: 3, tier: 2, tags: ['bomb'], bonus: 20 });
    expect(stepCallout(2, [], 0)).toEqual({ step: 2, tier: 1, tags: [], bonus: 0 });
  });

  it('holds tier 4 and the move total longer', () => {
    expect(CALLOUT_MS).toBe(1100);
    expect(LONG_CALLOUT_MS).toBe(1400);
    for (const tier of [0, 1, 2, 3] as const) expect(calloutMs(tier)).toBe(CALLOUT_MS);
    expect(calloutMs(4)).toBe(LONG_CALLOUT_MS);
  });
});

describe('callout text', () => {
  it('has every word, tag and the move total in both languages', () => {
    expect(t('en', 'comboNice', { n: 2 })).toBe('Nice! ×2');
    expect(t('en', 'comboGreat', { n: 3 })).toBe('Great! ×3');
    expect(t('en', 'comboSuperb', { n: 4 })).toBe('Superb! ×4');
    expect(t('en', 'comboIncredible', { n: 12 })).toBe('Incredible! ×12');
    expect(t('en', 'tagBomb')).toBe('Bomb!');
    expect(t('en', 'tagLine')).toBe('Line!');
    expect(t('en', 'moveTotal', { n: '1,240' })).toBe('Move +1,240');
    expect(t('zh-CN', 'comboNice', { n: 2 })).toBe('不错！×2');
    expect(t('zh-CN', 'comboGreat', { n: 3 })).toBe('很棒！×3');
    expect(t('zh-CN', 'comboSuperb', { n: 4 })).toBe('超赞！×4');
    expect(t('zh-CN', 'comboIncredible', { n: 12 })).toBe('不可思议！×12');
    expect(t('zh-CN', 'tagBomb')).toBe('炸弹！');
    expect(t('zh-CN', 'tagLine')).toBe('直线！');
    expect(t('zh-CN', 'moveTotal', { n: '1,240' })).toBe('本步 +1,240');
  });

  it('drops the old plain cascade message', () => {
    for (const messages of Object.values(MESSAGES)) expect(messages).not.toHaveProperty('cascade');
  });
});

describe('callout look', () => {
  it('defines the four tier colours in every theme', () => {
    for (const { id } of THEMES) {
      for (const token of ['--callout-1', '--callout-2', '--callout-3', '--callout-4', '--callout-word', '--callout-tint', '--callout-border']) {
        expect(tokenBlock(id), `${id} ${token}`).toContain(`${token}:`);
      }
    }
  });

  it('styles each tier and the move total from the tokens', () => {
    for (const n of [1, 2, 3, 4]) {
      expect(css).toMatch(new RegExp(`\\.toast\\[data-tier='${n}'\\]\\s*\\{[^}]*--callout:\\s*var\\(--callout-${n}\\)`));
    }
    expect(css).toMatch(/\.toast\[data-tier='total'\]\s*\{[^}]*--callout:\s*var\(--accent\)/);
    expect(css).toMatch(/\.callout-chip\s*\{[^}]*var\(--line-badge-bg\)/);
  });

  it('shows a word-less callout (lone tag or bonus) larger', () => {
    expect(css).toMatch(/\.callout-sub:only-child\s*\{[^}]*font-size:\s*0\.8em/);
  });

  it('only fades under reduced motion', () => {
    expect(reducedCss).toMatch(/\.toast/);
    expect(reducedCss).toMatch(/\.toast[^{]*\{[^}]*animation:\s*none/);
  });
});

describe('main.ts wiring', () => {
  it('builds callouts from the step, the specials made and the bonus', () => {
    expect(mainSrc).toContain('stepCallout(cascade, plan.made,');
    expect(mainSrc).toContain('showMoveTotal(');
    expect(mainSrc).not.toContain("'cascade'");
    // Every callout gets a tier, '0' included, so even a lone tag pops in.
    expect(mainSrc).toContain('tier: String(c.tier)');
    // Time up during a long chain: the move total shows before the game-over overlay.
    expect(mainSrc).toMatch(/if \(timeUp && totalShown\) \{\s*await wait\(LONG_CALLOUT_MS\);/);
  });
});
