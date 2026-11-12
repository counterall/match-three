// The settings popup (a native <dialog>). Add new settings as extra <section>s.

import { gemSvg } from './gems';
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
}

/** Wires up the settings dialog and returns the live settings object. */
export function initSettings(hooks: SettingsHooks = {}): Readonly<Settings> {
  const settings: Settings = loadSettings();
  applyTheme(settings.theme);

  const dialog = document.querySelector<HTMLDialogElement>('#settings')!;
  const openBtn = document.querySelector<HTMLButtonElement>('#open-settings')!;
  const themeGrid = dialog.querySelector<HTMLDivElement>('#theme-options')!;
  const timeGroup = dialog.querySelector<HTMLDivElement>('#time-options')!;

  themeGrid.innerHTML = THEMES.map(
    (t) => `
      <label class="theme-option" data-theme="${t.id}">
        <input type="radio" name="theme" value="${t.id}" ${t.id === settings.theme ? 'checked' : ''} />
        <span class="theme-preview">
          ${PREVIEW_TYPES.map((type) => `<span class="mini-gem" data-type="${type}">${gemSvg(type)}</span>`).join('')}
        </span>
        <span class="theme-name">${t.label}</span>
      </label>`,
  ).join('');

  timeGroup.innerHTML = TIME_LIMITS.map(
    (t) => `
      <label class="pill-option">
        <input type="radio" name="time-limit" value="${t.minutes}" ${t.minutes === settings.timeLimit ? 'checked' : ''} />
        <span>${t.label}</span>
      </label>`,
  ).join('');

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
