// The settings popup (a native <dialog>). Add new settings as extra <section>s.

import { gemSvg } from './gems';
import { THEMES, applyTheme, isThemeId, loadSettings, saveSettings, type Settings } from './settings';

const PREVIEW_TYPES = [0, 1, 2, 5];

export function initSettings(): void {
  const settings: Settings = loadSettings();
  applyTheme(settings.theme);

  const dialog = document.querySelector<HTMLDialogElement>('#settings')!;
  const openBtn = document.querySelector<HTMLButtonElement>('#open-settings')!;
  const themeGrid = dialog.querySelector<HTMLDivElement>('#theme-options')!;

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

  themeGrid.addEventListener('change', (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (!isThemeId(value)) return;
    settings.theme = value;
    applyTheme(value);
    saveSettings(settings);
  });

  openBtn.addEventListener('click', () => {
    dialog.showModal();
    themeGrid.querySelector<HTMLInputElement>('input:checked')?.focus();
  });

  // Clicking the dimmed backdrop (outside the panel) closes the dialog.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}
