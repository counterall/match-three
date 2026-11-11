// Player settings: pure parsing/validation here, DOM wiring in settings-ui.ts.

export const THEMES = [
  { id: 'neon', label: 'Neon' },
  { id: 'pastel', label: 'Pastel' },
  { id: 'dark', label: 'Dark' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export interface Settings {
  theme: ThemeId;
}

export const SETTINGS_KEY = 'neon-cascade:settings';

export const DEFAULT_SETTINGS: Settings = { theme: 'neon' };

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/** Parses stored settings, falling back to defaults for anything missing or invalid. */
export function parseSettings(raw: string | null): Settings {
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  const obj = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  return {
    theme: isThemeId(obj.theme) ? obj.theme : DEFAULT_SETTINGS.theme,
  };
}

export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
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
