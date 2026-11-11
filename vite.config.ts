/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the build works from any sub-path,
  // e.g. https://counterall.github.io/match-three/ on GitHub Pages.
  base: './',
  test: {
    // Vitest blanks CSS imports by default; let tests read style.css (via ?raw)
    // so CSS-level guarantees like touch-action can be asserted.
    css: { include: [/style\.css/] },
  },
});
