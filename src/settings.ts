// Player settings: pure parsing/validation here, DOM wiring in settings-ui.ts.

import { DEFAULT_LANGUAGE, detectLanguage, isLanguage, type Language, type MessageKey } from './i18n';

export const THEMES = [
  { id: 'neon', labelKey: 'themeNeon' },
  { id: 'pastel', labelKey: 'themePastel' },
  { id: 'dark', labelKey: 'themeDark' },
] as const satisfies readonly { id: string; labelKey: MessageKey }[];

export type ThemeId = (typeof THEMES)[number]['id'];

/** Round length options, in minutes (labelled with the 'minutes' message). */
export const TIME_LIMITS = [{ minutes: 3 }, { minutes: 5 }, { minutes: 10 }] as const;

export type TimeLimit = (typeof TIME_LIMITS)[number]['minutes'];

export interface Settings {
  theme: ThemeId;
  /** Round length in minutes. */
  timeLimit: TimeLimit;
  language: Language;
}

export const SETTINGS_KEY = 'neon-cascade:settings';

export const DEFAULT_SETTINGS: Settings = { theme: 'neon', timeLimit: 3, language: DEFAULT_LANGUAGE };

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function isTimeLimit(value: unknown): value is TimeLimit {
  return TIME_LIMITS.some((t) => t.minutes === value);
}

/**
 * Parses stored settings, falling back to defaults for anything missing or invalid.
 * `fallbackLanguage` (normally the browser's language) is used when none is saved.
 */
export function parseSettings(raw: string | null, fallbackLanguage: Language = DEFAULT_SETTINGS.language): Settings {
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  const obj = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  return {
    theme: isThemeId(obj.theme) ? obj.theme : DEFAULT_SETTINGS.theme,
    timeLimit: isTimeLimit(obj.timeLimit) ? obj.timeLimit : DEFAULT_SETTINGS.timeLimit,
    language: isLanguage(obj.language) ? obj.language : fallbackLanguage,
  };
}

function browserLanguage(): Language {
  return detectLanguage(navigator.languages?.length ? navigator.languages : [navigator.language ?? '']);
}

export function loadSettings(): Settings {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SETTINGS_KEY);
  } catch {
    /* storage unavailable; use defaults */
  }
  return parseSettings(raw, browserLanguage());
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable; settings just won't persist */
  }
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
}
