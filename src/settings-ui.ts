// The settings popup (a native <dialog>). Add new settings as extra <section>s;
// tag their text with data-i18n (see i18n.ts).

import { gemSvg } from './gems';
import { LANGUAGES, applyLanguage, isLanguage, t, type Language } from './i18n';
import {
  THEMES,
  TIME_LIMITS,
  applyTheme,
  isThemeId,
  isTimeLimit,
  loadSettings,
  saveSettings,
  type Settings,
  type TimeLimit,
} from './settings';

const PREVIEW_TYPES = [0, 1, 2, 5];

export interface SettingsHooks {
  /** The dialog opened (true) or closed (false). */
  onOpenChange?: (open: boolean) => void;
  onTimeLimitChange?: (minutes: TimeLimit) => void;
  /** The page has already been translated when this runs. */
  onLanguageChange?: (language: Language) => void;
}

/** Wires up the settings dialog and returns the live settings object. */
export function initSettings(hooks: SettingsHooks = {}): Readonly<Settings> {
  const settings: Settings = loadSettings();
  applyTheme(settings.theme);
  const lang = settings.language;

  const dialog = document.querySelector<HTMLDialogElement>('#settings')!;
  const openBtn = document.querySelector<HTMLButtonElement>('#open-settings')!;
  const themeGrid = dialog.querySelector<HTMLDivElement>('#theme-options')!;
  const timeGroup = dialog.querySelector<HTMLDivElement>('#time-options')!;
  const languageGroup = dialog.querySelector<HTMLDivElement>('#language-options')!;

  themeGrid.innerHTML = THEMES.map(
    (th) => `
      <label class="theme-option" data-theme="${th.id}">
        <input type="radio" name="theme" value="${th.id}" ${th.id === settings.theme ? 'checked' : ''} />
        <span class="theme-preview">
          ${PREVIEW_TYPES.map((type) => `<span class="mini-gem" data-type="${type}">${gemSvg(type)}</span>`).join('')}
        </span>
        <span class="theme-name" data-i18n="${th.labelKey}">${t(lang, th.labelKey)}</span>
      </label>`,
  ).join('');

  timeGroup.innerHTML = TIME_LIMITS.map(
    ({ minutes }) => `
      <label class="pill-option">
        <input type="radio" name="time-limit" value="${minutes}" ${minutes === settings.timeLimit ? 'checked' : ''} />
        <span data-i18n="minutes" data-i18n-n="${minutes}">${t(lang, 'minutes', { n: minutes })}</span>
      </label>`,
  ).join('');

  // Each language is named in itself (and tagged with its lang), so it never changes.
  languageGroup.innerHTML = LANGUAGES.map(
    (l) => `
      <label class="pill-option">
        <input type="radio" name="language" value="${l.id}" ${l.id === settings.language ? 'checked' : ''} />
        <span lang="${l.id}">${l.label}</span>
      </label>`,
  ).join('');

  applyLanguage(settings.language);

  themeGrid.addEventListener('change', (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (!isThemeId(value)) return;
    settings.theme = value;
    applyTheme(value);
    saveSettings(settings);
  });

  timeGroup.addEventListener('change', (e) => {
    const value = Number((e.target as HTMLInputElement).value);
    if (!isTimeLimit(value)) return;
    settings.timeLimit = value;
    saveSettings(settings);
    hooks.onTimeLimitChange?.(value);
  });

  languageGroup.addEventListener('change', (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (!isLanguage(value)) return;
    settings.language = value;
    applyLanguage(value);
    saveSettings(settings);
    hooks.onLanguageChange?.(value);
  });

  openBtn.addEventListener('click', () => {
    dialog.showModal();
    hooks.onOpenChange?.(true);
    themeGrid.querySelector<HTMLInputElement>('input:checked')?.focus();
  });

  // Fires for the buttons, Escape and backdrop clicks alike.
  dialog.addEventListener('close', () => hooks.onOpenChange?.(false));

  // Clicking the dimmed backdrop (outside the panel) closes the dialog.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  return settings;
}
