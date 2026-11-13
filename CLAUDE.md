# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Neon Cascade: an original match-3 browser game. It's a single page application in TypeScript and Vite with **no UI framework**, using plain DOM, CSS and inline SVG. The package manager is **pnpm**; don't use npm or yarn.

This is an original game in the match-3 genre. Don't copy names, art, sounds or visual style from existing commercial games (e.g. Bejeweled).

## Commands

```bash
pnpm dev          # dev server
pnpm test         # Vitest unit tests (src/**/*.test.ts)
pnpm typecheck    # tsc, no emit
pnpm build        # tsc && vite build -> dist/
```

Before calling a change done, run `pnpm typecheck && pnpm test && pnpm build`. For visual or UI changes, also check the game in a browser at desktop and phone width (~390px).

## Deployment

Pushes to `main` deploy to GitHub Pages (https://counterall.github.io/match-three/) via `.github/workflows/deploy.yml`, which runs typecheck, tests and build first, so a red CI means no deploy. pnpm's version is pinned by `packageManager` in `package.json`; keep it in sync with the lockfile. Keep `base: './'` in `vite.config.ts`.

## Architecture

- `src/board.ts`: **pure game logic**, with no DOM access. The grid is `grid[row][col]` of `Gem | null`, of any size (`rowsOf`/`colsOf`; never assume square or 8×8) (`null` only between clearing and refilling). Randomness is injected as an `Rng` so tests can be deterministic. Put new rules (special gems, modes, scoring) here and add tests in `src/board.test.ts`.
- `src/main.ts`: rendering, input and game flow.
  - Each gem has a stable `id`, and its DOM element lives in the `els` map. `render()` moves elements to their grid positions with `transform: translate(col*100%, row*100%)`, and CSS transitions do the animation.
  - New gems from `collapse()` are created above the board (`fromRow < 0`) and then fall in.
  - Board shape is responsive: `compactQuery` (`max-width: 600px`) picks 6 cols × 8 rows, otherwise 8×8. `newGame()` writes `--rows`/`--cols` on `<body>`; CSS sizes gems, grid lines and the column width from them. Crossing the breakpoint only rebuilds the board before the first move (while the round clock hasn't started). The breakpoint is duplicated in the compact `@media` block in `style.css`, so keep the two in sync.
  - `.app` width is capped so the board's height fits the viewport (`--chrome` ≈ height of header + controls + padding). Retune `--chrome` if those change height. The HUD (title + Score, Best, Time) never wraps, since a second row would break that budget. `.app` is a size container, and when the column is narrow (`@container (max-width: 540px)`: phones, short desktop windows) the title words stack. Check desktop, a short window and ~320–390px with a six-digit score if you add to it.
  - `busy` blocks input while a swap or cascade is running. `gameToken` is bumped by `newGame()` so cascades still in flight stop touching the board.
  - Animation timings are TS constants pushed to CSS as `--swap-ms` / `--pop-ms`. Keep TS waits and CSS durations in sync through these, and respect `prefers-reduced-motion`.
- `src/gems.ts`: SVG shape per gem type (count must match `GEM_TYPES` in `board.ts`), drawn in 3D-style layers: a coloured body, then (clipped to the shape) a diagonal light/shadow overlay and a gloss highlight. Those layers use colour-independent gradients and per-type clip paths defined **once per page** by `gemDefsSvg()`/`installGemDefs()` (called in `main.ts` before any gem renders). `gemSvg()` must not define ids, since it's repeated for every gem. No theme colours here. The only colours are the neutral white/black luminance stops in those shared gradients, a deliberate exception to the token rule. Themes tune their strength via tokens.
- `src/settings.ts`: settings model (`THEMES`, `TIME_LIMITS`, `language`, `parseSettings`, load/save under `neon-cascade:settings`). Pure, tested in `settings.test.ts`. `parseSettings` validates each field on its own and falls back to its default, so older saved settings keep working. `settings-ui.ts` wires the native `<dialog>` in `index.html` and returns the live `Settings`. It reports dialog open/close, time-limit and language changes through hooks (`initSettings({ onOpenChange, onTimeLimitChange, onLanguageChange })`). Add new settings as extra `<section>`s and fields on `Settings`.
- `src/i18n.ts`: UI text, **English and Simplified Chinese** (`LANGUAGES`, `MESSAGES`, `t(lang, key, params)` with `{name}` placeholders, `detectLanguage(navigator.languages)`: any `zh*` → `zh-CN`, else English). Pure apart from `applyLanguage()`, tested in `i18n.test.ts`. Static text in `index.html` carries `data-i18n="key"` (text) or `data-i18n-label="key"` (`aria-label`) and ships the **English** text, and the tests enforce both, plus that no untagged text is left. Text built in TS goes through `t(settings.language, …)` (toasts, the pause button's label); generated markup adds `data-i18n` (and `data-i18n-n` for `{n}`) so a language switch re-translates it live, and `onLanguageChange` in `main.ts` refreshes what it wrote itself. Add every new string to **every** language. The game's name stays untranslated. The saved `language` setting falls back to the browser's language. The inline script in `index.html` repeats that choice before first paint (a test keeps it in step with `detectLanguage`), sets `<html lang>`, and for non-English marks `<html data-i18n-pending>`, which hides the body until `applyLanguage()` has replaced the shipped English text. The pause button's `aria-label` is the one untagged label: `syncPauseButton()` owns it.
- `src/timer.ts`: round timer rules, pure and tested in `timer.test.ts`, with time passed in as `now` (ms). `Countdown` starts on demand and is paused by named holds (`hold`/`release`, e.g. `'settings'`, `'hidden'`). `bonusSeconds(prev, next)` gives +20s per 1000-point threshold crossed. In `main.ts` the clock starts on the first swap and is read with `performance.now()` on a `TICK_MS` interval. When it hits zero, `timeUp` blocks input like `busy`. A cascade already running finishes and scores, but earns no more bonus time, then the game-over overlay shows. A new time limit applies at the next `newGame()`, or straight away while the clock hasn't started.
- `src/pause.ts`: pause rules, pure and tested in `pause.test.ts`. `canPause` allows it only after the clock has started and before time's up. `shouldAutoPause` covers a page/app becoming hidden. In `main.ts`, `paused` blocks input like `busy`/`timeUp`, and `setPaused()` holds the clock (`'paused'`), clears selection/hints, disables Hint and shows the `#paused` overlay, which blurs the board so it can't be studied. `visibilitychange` (hidden) and `pagehide` auto-pause. Coming back stays paused until **Resume**. `newGame()` always unpauses, but only *after* `clock.reset()`, since `setPaused()` runs `updateClock()`, which would end the new round on the old expired clock. `pause()` refreshes the clock first, so a pause in the last tick can't overlap game over. A cascade running when you pause still finishes and scores behind the overlay. `syncPauseButton()` keeps the `#pause` icon button's `disabled`, `data-paused` (icon swap) and `aria-label` (Pause/Resume; deliberately no `aria-pressed`) in step. Call it whenever `clock.isStarted`, `timeUp` or `paused` changes. The game-over and paused overlays share the `.overlay` styles.
- `src/style.css`: **themes are token sets** on `[data-theme="…"]` (neon, pastel, dark). `<html data-theme>` holds the active one; theme preview cards set their own `data-theme` to preview locally. Gem colours are `--gem-0…6`, mapped to `--c` (outline) and `--fc` (body fill; optional per-theme `--gem-N-body` override) by `[data-type="N"]` rules. 3D strength per theme: `--gem-shade`, `--gem-gloss`, plus `--gem-fill-opacity`. Gems at rest have **no CSS `filter`** (no glow or drop shadow) so they stay crisp. Only the selected and pop animations add a temporary highlight glow. Glows scale with `--glow` (0 = flat). Never hard-code colours outside the token blocks, and when adding a token define it in **every** theme. A small inline script in `index.html` applies the saved theme before first paint.

## Static assets and icons

- `public/` is copied as-is into `dist/`. In `index.html`, reference these files with root-absolute paths (`/icon.svg`); Vite rewrites them to `./icon.svg` because of `base: './'`. Inside `manifest.webmanifest`, use paths relative to the manifest (`icon-192.png`, `start_url: "./"`), never `/…`, so the site works under the Pages sub-path.
- `public/icon.svg` is the source for the favicon and the PNG app icons. After editing it, run `scripts/icons.sh` (headless Chrome, no dependencies) and commit the PNGs. Keep the background opaque and full-bleed and the artwork within the central 80% circle (maskable safe zone).

## Conventions

- `strict` TypeScript with `verbatimModuleSyntax`: use `import type` for type-only imports.
- Keep logic testable: no DOM in `board.ts`; helper functions should take a grid and mutate it or return results.
- Use percentage sizes inside the board so it scales. Beware that percentage `padding`/`margin` is measured against the *board's* width, not the gem's.
- Wrap `localStorage` access in try/catch.
- Mobile zoom: `html { touch-action: manipulation }` stops double-tap zoom page-wide, and `.board` keeps `touch-action: none` for swipes. Don't add `user-scalable=no`/`maximum-scale` to the viewport meta in `index.html`, since pinch zoom must keep working in a browser tab for accessibility (it works outside the board). `src/zoom.test.ts` guards all three. It reads `style.css?raw`, which only works because `vite.config.ts` opts `style.css` into Vitest's CSS handling (`test.css.include`).
- iOS home-screen app: double-tap zoom was reported to still happen there despite `touch-action` (issue #9). So `src/tap-guard.ts` (`installStandaloneZoomGuards()`, called at startup in `main.ts`) runs **only when `navigator.standalone === true`**, which is iOS-only, so Android installs and browser tabs keep pinch zoom. It locks the viewport scale at runtime, then cancels any `touchend` that comes within `DOUBLE_TAP_MS` of the previous one and replays `click()` on the control it hit (`CLICKABLE`). Board input uses pointer events, which a cancelled touchend doesn't affect. The logic, including the handler (on fake events), is tested in `tap-guard.test.ts`.
- Commit or push only when asked.
