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
  timeLimit: 'Time limit',
  timeLimitNote:
    "Applies from the next game, or straight away if you haven't moved yet. Every 1,000 points adds 20 seconds. The daily challenge is always 3 minutes.",
  minutes: '{n} min',
  language: 'Language',
  gemStyle: 'Gem style',
  gemStyleShapes: 'Shapes',
  gemStyleAnimals: 'Animals',
  diagonal: 'Diagonal matches',
  diagonalOff: 'Off',
  diagonalOn: 'On',
  diagonalNote:
    "Lines of 3 along a diagonal match too. Applies from the next game, or straight away if you haven't moved yet. Diagonal games keep their own best. The daily challenge follows its own twist.",
  done: 'Done',
  comboNice: 'Nice! ×{n}',
  comboGreat: 'Great! ×{n}',
  comboSuperb: 'Superb! ×{n}',
  comboIncredible: 'Incredible! ×{n}',
  tagBomb: 'Bomb!',
  tagLine: 'Line!',
  moveTotal: 'Move +{n}',
  bonusTime: '+{s}s',
  noMoves: 'No moves left · shuffling',
  dailyChallenge: 'Daily challenge',
  dailyUnplayed: 'Daily challenge (not played today)',
  dailyTitle: 'Daily · {day}',
  todayBest: "Today's best {n}",
  todayBestLabel: "Today's best",
  streak: '{n}-day streak',
  freePlay: 'Free play',
  twistClassic: 'Classic',
  twistDiagonal: 'Diagonal',
  twistBombRain: 'Bomb rain',
  twistBoth: 'Diagonal + Bomb rain',
  gemLabel: '{name}, row {row}, column {col}',
  gemLabelBomb: '{name}, bomb, row {row}, column {col}',
  gemLabelLine: '{name}, line gem {dir}, row {row}, column {col}',
  lineDirRow: 'horizontal',
  lineDirCol: 'vertical',
  lineDirDiag: 'diagonal down-right',
  lineDirAnti: 'diagonal up-right',
  shapeCircle: 'Circle',
  shapeDiamond: 'Diamond',
  shapeTriangle: 'Triangle',
  shapeSquare: 'Square',
  shapeHexagon: 'Hexagon',
  shapeStar: 'Star',
  shapeHeart: 'Heart',
  animalTerrier: 'Terrier',
  animalHusky: 'Husky',
  animalFrog: 'Frog',
  animalParrot: 'Parrot',
  animalShiba: 'Black Shiba',
  animalPenguin: 'Penguin',
  animalBear: 'Bear',
  animalTiger: 'Tiger',
  scoreAnnounce: 'Score {n}',
};

export type MessageKey = keyof typeof en;

export const MESSAGES: Record<Language, Record<MessageKey, string>> = {
  en,
  'zh-CN': {
    score: '得分',
    best: '最高分',
    time: '时间',
    gameBoard: '游戏面板',
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
    themePastel: '粉彩',
    timeLimit: '每局时长',
    timeLimitNote: '从下一局开始生效；如果本局还没走第一步，则立即生效。每得 1000 分加 20 秒。每日挑战固定为 3 分钟。',
    minutes: '{n} 分钟',
    language: '语言',
    gemStyle: '宝石样式',
    gemStyleShapes: '几何',
    gemStyleAnimals: '动物',
    diagonal: '斜线消除',
    diagonalOff: '关',
    diagonalOn: '开',
    diagonalNote: '斜线上连成 3 个也能消除。从下一局开始生效；如果本局还没走第一步，则立即生效。斜线模式单独记录最高分。每日挑战按当天的规则进行。',
    done: '完成',
    comboNice: '不错！×{n}',
    comboGreat: '很棒！×{n}',
    comboSuperb: '超赞！×{n}',
    comboIncredible: '不可思议！×{n}',
    tagBomb: '炸弹！',
    tagLine: '直线！',
    moveTotal: '本步 +{n}',
    bonusTime: '+{s}秒',
    noMoves: '没有可走的步了 · 重新洗牌',
    dailyChallenge: '每日挑战',
    dailyUnplayed: '每日挑战（今天还没完成）',
    dailyTitle: '每日挑战 · {day}',
    todayBest: '今日最佳 {n}',
    todayBestLabel: '今日最佳',
    streak: '连续 {n} 天',
    freePlay: '自由模式',
    twistClassic: '经典',
    twistDiagonal: '斜线',
    twistBombRain: '炸弹雨',
    twistBoth: '斜线 + 炸弹雨',
    gemLabel: '{name}，第 {row} 行，第 {col} 列',
    gemLabelBomb: '{name}，炸弹，第 {row} 行，第 {col} 列',
    gemLabelLine: '{name}，{dir}线宝石，第 {row} 行，第 {col} 列',
    lineDirRow: '横向',
    lineDirCol: '纵向',
    lineDirDiag: '向右下斜向',
    lineDirAnti: '向右上斜向',
    shapeCircle: '圆形',
    shapeDiamond: '菱形',
    shapeTriangle: '三角形',
    shapeSquare: '方形',
    shapeHexagon: '六边形',
    shapeStar: '星形',
    shapeHeart: '心形',
    animalTerrier: '梗犬',
    animalHusky: '哈士奇',
    animalFrog: '青蛙',
    animalParrot: '鹦鹉',
    animalShiba: '黑柴犬',
    animalPenguin: '企鹅',
    animalBear: '熊',
    animalTiger: '老虎',
    scoreAnnounce: '得分 {n}',
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
 * [data-i18n-label] ones (and their title, if they have one), and the lang attribute. A data-i18n-n attribute fills {n}.
 */
export function applyLanguage(lang: Language, root: ParentNode = document): void {
  if (root === document) {
    document.documentElement.lang = lang;
    // Set by the inline script in index.html to hide English text until translated.
    delete document.documentElement.dataset.i18nPending;
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const n = el.dataset.i18nN;
    el.textContent = t(lang, el.dataset.i18n as MessageKey, n === undefined ? {} : { n });
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    const label = t(lang, el.dataset.i18nLabel as MessageKey);
    el.setAttribute('aria-label', label);
    // Icon buttons repeat their label as a hover tooltip (issue #36).
    if (el.hasAttribute('title')) el.title = label;
  }
}
