// UI text in every supported language. Pure data plus lookup/detection, tested in
// i18n.test.ts; applyLanguage() is the only DOM code.
//
// Static text in index.html carries data-i18n="key" (its text) or
// data-i18n-label="key" (its aria-label) and ships the English text, so the page reads
// right before scripts run. Dynamic text (toasts, button labels) goes through t().
// The game's name, Neon Cascade, is a brand and stays untranslated.

export const LANGUAGES = [
  // Each language is named in itself, so players can find theirs whatever is active.
  { id: 'en', label: 'English' },
  { id: 'zh-CN', label: '简体中文' },
] as const;

export type Language = (typeof LANGUAGES)[number]['id'];

const en = {
  score: 'Score',
  best: 'Best',
  time: 'Time',
  gameBoard: 'Game board',
  paused: 'Paused',
  clockStopped: 'The clock is stopped.',
  resume: 'Resume',
  pause: 'Pause',
  timesUp: "Time's up",
  finalScore: 'Final score',
  newBest: 'New best!',
  playAgain: 'Play again',
  hint: 'Hint',
  newGame: 'New game',
  settings: 'Settings',
  closeSettings: 'Close settings',
  theme: 'Theme',
  themeNeon: 'Neon',
  themePastel: 'Pastel',
  themeDark: 'Dark',
  timeLimit: 'Time limit',
  timeLimitNote:
    "Applies from the next game, or straight away if you haven't moved yet. Every 1,000 points adds 20 seconds.",
  minutes: '{n} min',
  language: 'Language',
  done: 'Done',
  cascade: 'Cascade ×{n}',
  bonusTime: '+{s}s',
  noMoves: 'No moves left · shuffling',
};

export type MessageKey = keyof typeof en;

export const MESSAGES: Record<Language, Record<MessageKey, string>> = {
  en,
  'zh-CN': {
    score: '得分',
    best: '最高分',
    time: '时间',
    gameBoard: '游戏棋盘',
    paused: '已暂停',
    clockStopped: '计时已停止。',
    resume: '继续',
    pause: '暂停',
    timesUp: '时间到',
    finalScore: '最终得分',
    newBest: '新纪录！',
    playAgain: '再来一局',
    hint: '提示',
    newGame: '新游戏',
    settings: '设置',
    closeSettings: '关闭设置',
    theme: '主题',
    themeNeon: '霓虹',
    themePastel: '柔彩',
    themeDark: '深色',
    timeLimit: '时间限制',
    timeLimitNote: '从下一局开始生效；如果本局还没走第一步，则立即生效。每得 1,000 分加 20 秒。',
    minutes: '{n} 分钟',
    language: '语言',
    done: '完成',
    cascade: '连锁 ×{n}',
    bonusTime: '+{s}秒',
    noMoves: '无路可走 · 重新洗牌',
  },
};

export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((l) => l.id === value);
}

/** The message for `key` in `lang`, with {name} placeholders filled from `params`. */
export function t(lang: Language, key: MessageKey, params: Record<string, string | number> = {}): string {
  return MESSAGES[lang][key].replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/**
 * Picks a language from the browser's preference list (navigator.languages): the first
 * entry we support wins. Any Chinese variant maps to Simplified Chinese, the only
 * Chinese we have; anything else falls through to English.
 */
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'zh') return 'zh-CN';
    if (base === 'en') return 'en';
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Translates the page (or `root`): text of [data-i18n] elements, aria-label of
 * [data-i18n-label] ones, and the lang attribute. A data-i18n-n attribute fills {n}.
 */
export function applyLanguage(lang: Language, root: ParentNode = document): void {
  if (root === document) document.documentElement.lang = lang;
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const n = el.dataset.i18nN;
    el.textContent = t(lang, el.dataset.i18n as MessageKey, n === undefined ? {} : { n });
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    el.setAttribute('aria-label', t(lang, el.dataset.i18nLabel as MessageKey));
  }
}
