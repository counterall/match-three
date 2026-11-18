// Issue #36: daily challenge UI, icon-only controls and HUD, no diagonal badge, no
// Share. No DOM in Vitest, so markup, CSS and main.ts wiring are read as text.
import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import css from './style.css?raw';
import mainSrc from './main.ts?raw';
import i18nSrc from './i18n.ts?raw';
import { LANGUAGES, MESSAGES, type MessageKey } from './i18n';
import { THEMES } from './settings';

const body = html.slice(html.indexOf('<body'), html.indexOf('<script type="module"'));

/** The opening tag of the element with this id. */
const tag = (id: string) => body.match(new RegExp(`<[a-z]+[^>]*\\sid="${id}"[^>]*>`))?.[0] ?? '';
/** The element with this id, up to its closing tag (no nesting of the same tag inside). */
function element(id: string): string {
  const m = body.match(new RegExp(`<([a-z]+)[^>]*\\sid="${id}"[^>]*>[\\s\\S]*?</\\1>`));
  return m?.[0] ?? '';
}

/** Body of the `name(…) { … }` function or method declared in main.ts. */
function fn(name: string): string {
  const m = mainSrc.match(new RegExp(`\\n( *)(?:async )?(?:function )?${name}\\([^)]*\\)[^{;\\n]*\\{([\\s\\S]*?)\\n\\1\\}`));
  if (!m) throw new Error(`no ${name} in main.ts`);
  return m[2];
}

describe('controls: icon buttons only', () => {
  const ids = ['pause', 'daily', 'hint', 'new-game', 'open-settings'];
  const controls = body.match(/<footer class="controls">([\s\S]*?)<\/footer>/)?.[1] ?? '';

  it('has Pause, Daily, Hint, New game and Settings in that order', () => {
    const order = [...controls.matchAll(/<button[^>]*\sid="([\w-]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(ids);
  });

  it('draws each as an icon with a translated label and tooltip, and no visible text', () => {
    const keys: Record<string, MessageKey> = { daily: 'dailyUnplayed', hint: 'hint', 'new-game': 'newGame', 'open-settings': 'settings' };
    for (const id of ids) {
      const btn = element(id);
      expect(btn, id).toMatch(/class="icon-btn[ "]/);
      expect(btn, id).toMatch(/<svg[^>]*aria-hidden="true"/);
      expect(btn.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim(), id).toBe('');
      if (id === 'pause') continue; // main.ts owns its label (Pause/Resume)
      const open = tag(id);
      expect(open, id).toContain(`data-i18n-label="${keys[id]}"`);
      expect(open, id).toContain(`aria-label="${MESSAGES.en[keys[id]]}"`);
      expect(open, id).toContain(`title="${MESSAGES.en[keys[id]]}"`);
    }
  });

  it('highlights the Daily button in a daily, with a dot (and label) until today is played', () => {
    // Not a toggle: pressing it again restarts today's daily, so no aria-pressed.
    expect(tag('daily')).not.toMatch(/aria-pressed/);
    expect(element('daily')).toMatch(/class="daily-dot"/);
    expect(css).toMatch(/#daily\[data-mode='daily'\]/);
    expect(css).toMatch(/\[data-unplayed='true'\] \.daily-dot/);
    const sync = fn('syncDailyButton');
    expect(sync).toMatch(/playedOn\(/);
    expect(sync).toMatch(/dailyBtn\.dataset\.mode = mode/);
    expect(sync).toMatch(/'dailyUnplayed' : 'dailyChallenge'/);
    expect(mainSrc).toMatch(/setInterval\(syncDailyButton, 60_000\)/);
  });

  it('keeps the tooltip in the UI language', () => {
    expect(i18nSrc).toMatch(/hasAttribute\('title'\)/);
    expect(fn('syncPauseButton')).toMatch(/title/);
  });

  it('keeps the five controls on one line on phones', () => {
    const phone = css.slice(css.indexOf('@media (max-width: 600px)'));
    expect(phone).toMatch(/\.controls\s*\{[^}]*flex-wrap:\s*nowrap/);
  });
});

describe('HUD: icon labels', () => {
  const stat = (valueId: string) => body.match(new RegExp(`<div[^>]*class="stat"[^>]*>(?:(?!</div>)[\\s\\S])*id="${valueId}"[\\s\\S]*?</div>`))?.[0] ?? '';

  it('labels Score, Best and Time with icons, not words', () => {
    for (const [valueId, key] of [
      ['score', 'score'],
      ['best', 'best'],
      ['time', 'time'],
    ] as const) {
      const s = stat(valueId);
      expect(s, valueId).toMatch(new RegExp(`class="label stat-icon"[^>]*role="img"[^>]*aria-label="${MESSAGES.en[key]}"[^>]*data-i18n-label="${key}"`));
      expect(s, valueId).not.toMatch(/data-i18n="(score|best|time)"/);
    }
  });

  it('shows a trophy for Best in free play and a calendar in a daily', () => {
    const best = stat('best');
    expect(best).toMatch(/id="best-label"/);
    expect(best).toMatch(/class="icon-trophy"/);
    expect(best).toMatch(/class="icon-calendar"/);
    expect(css).toMatch(/#best-label\[data-mode='daily'\] \.icon-trophy/);
    expect(css).toMatch(/#best-label:not\(\[data-mode='daily'\]\) \.icon-calendar/);
    expect(fn('setRoundBest')).toMatch(/bestLabel\.dataset\.mode = mode/);
    expect(fn('setRoundBest')).toMatch(/'todayBestLabel'/);
  });

  it('removes the diagonal badge everywhere (owner decision)', () => {
    expect(html).not.toMatch(/diag-badge/);
    expect(mainSrc).not.toMatch(/diagBadge/);
    expect(css).not.toMatch(/diag-badge/);
    for (const { id } of LANGUAGES) expect(MESSAGES[id]).not.toHaveProperty('diagonalBadge');
  });
});

describe('game-over card in a daily', () => {
  const card = body.match(/<div id="game-over"[\s\S]*?<\/button>\s*<\/div>\s*<\/div>/)?.[0] ?? '';

  it('describes the card with the daily lines only in a daily', () => {
    expect(tag('game-over')).toContain('aria-describedby="final-score-line new-best"');
    expect(fn('showGameOver')).toMatch(/daily \? 'daily-title final-score-line new-best today-best streak' : 'final-score-line new-best'/);
  });

  it('has the date line, today’s best, the streak and a Free play button, hidden in free play', () => {
    for (const id of ['daily-title', 'today-best', 'streak', 'free-play']) {
      expect(card, id).toContain(`id="${id}"`);
      expect(tag(id), id).toMatch(/\shidden[\s>]/);
    }
    expect(tag('free-play')).toContain('data-i18n="freePlay"');
  });

  it('has no Share feature', () => {
    for (const src of [html, mainSrc, i18nSrc]) {
      expect(src).not.toMatch(/\bshare\b|navigator\.share|id="share/i);
      expect(src).not.toMatch(/clipboard/i);
    }
  });

  it('gets the streak colour from a theme token in every theme', () => {
    for (const { id } of THEMES) {
      const block = css.match(new RegExp(`\\[data-theme='${id}'\\]\\s*\\{([^}]*)\\}`))?.[1] ?? '';
      expect(block, id).toMatch(/--streak:/);
    }
    expect(css).toMatch(/\.streak[^{]*\{[^}]*var\(--streak\)/);
  });
});

describe('i18n', () => {
  it('has every daily string in every language', () => {
    const keys: MessageKey[] = [
      'dailyChallenge',
      'dailyUnplayed',
      'dailyTitle',
      'todayBest',
      'todayBestLabel',
      'streak',
      'freePlay',
      'twistClassic',
      'twistDiagonal',
      'twistBombRain',
      'twistBoth',
    ];
    for (const { id } of LANGUAGES) for (const k of keys) expect(MESSAGES[id][k], `${id}.${k}`).toBeTruthy();
  });
});

describe('main.ts wiring', () => {
  it('draws the board, refills, shuffles and the cast from the round’s generator', () => {
    expect(fn('newGame')).toMatch(/seededRng\(roundDate, rows, cols\)/);
    expect(fn('newGame')).toMatch(/drawCast\(roundRng\)/);
    expect(fn('newGame')).toMatch(/createBoard\(rows, cols, roundRng, matchOpts\(\)\)/);
    expect(mainSrc).toMatch(/collapse\(grid, roundRng, roundBombChance\)/);
    expect(mainSrc).toMatch(/shuffle\(grid, roundRng, matchOpts\(\)\)/);
    expect(mainSrc).not.toMatch(/collapse\(grid, Math\.random/);
  });

  it('a daily is 3 minutes with the weekday twist; free play uses the Settings', () => {
    const ng = fn('newGame');
    expect(ng).toMatch(/twistRules\(twistFor\(roundDate\)\)/);
    expect(ng).toMatch(/DAILY_MINUTES/);
    expect(ng).toMatch(/settings\.timeLimit/);
    expect(ng).toMatch(/settings\.diagonal/);
  });

  it('never saves a daily score as a free-play best; records it at game over', () => {
    expect(fn('setScore')).toMatch(/if \(mode === 'free'\) saveBest\(storage, roundLimit, best, roundDiagonal\)/);
    expect(fn('showGameOver')).toMatch(/recordDaily\(/);
    expect(fn('showGameOver')).toMatch(/saveDaily\(/);
  });

  it('wires the buttons to the right mode', () => {
    expect(mainSrc).toMatch(/dailyBtn\.addEventListener\('click', \(\) => newGame\('daily'\)\)/);
    expect(mainSrc).toMatch(/newGameBtn\.addEventListener\('click', \(\) => newGame\('free'\)\)/);
    expect(mainSrc).toMatch(/freePlayBtn\.addEventListener\('click', \(\) => newGame\('free'\)\)/);
    expect(mainSrc).toMatch(/playAgainBtn\.addEventListener\('click', \(\) => newGame\(mode\)\)/);
  });

  it('ignores the time limit and diagonal settings during a daily', () => {
    expect(fn('onTimeLimitChange')).toMatch(/mode === 'free'/);
    expect(fn('onDiagonalChange')).toMatch(/mode === 'free'/);
  });

  it('rebuilds a daily (not a free game) when the board shape changes before the first move', () => {
    expect(mainSrc).toMatch(/if \(!clock\.isStarted && !busy\) newGame\(mode\)/);
  });

  it('announces the daily with the weekday and the twist', () => {
    expect(fn('newGame')).toMatch(/announceDaily\(\)/);
    expect(fn('announceDaily')).toMatch(/'dailyTitle'/);
    expect(fn('announceDaily')).toMatch(/twistKey/);
  });
});
