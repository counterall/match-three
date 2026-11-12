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
  - Board shape is responsive: `compactQuery` (`max-width: 600px`) picks 6 cols × 8 rows, otherwise 8×8. `newGame()` writes `--rows`/`--cols` on `<body>`; CSS sizes gems, grid lines and the column width from them. Crossing the breakpoint only rebuilds the board before the first move. The breakpoint is duplicated in the compact `@media` block in `style.css`, so keep the two in sync.
  - `.app` width is capped so the board's height fits the viewport (`--chrome` ≈ height of header + controls + padding). Retune `--chrome` if those change height.
  - `busy` blocks input while a swap or cascade is running. `gameToken` is bumped by `newGame()` so cascades still in flight stop touching the board.
  - Animation timings are TS constants pushed to CSS as `--swap-ms` / `--pop-ms`. Keep TS waits and CSS durations in sync through these, and respect `prefers-reduced-motion`.
- `src/gems.ts`: SVG shape per gem type (count must match `GEM_TYPES` in `board.ts`), drawn in 3D-style layers: a coloured body, then (clipped to the shape) a diagonal light/shadow overlay and a gloss highlight. Those layers use colour-independent gradients and per-type clip paths defined **once per page** by `gemDefsSvg()`/`installGemDefs()` (called in `main.ts` before any gem renders). `gemSvg()` must not define ids, since it's repeated for every gem. No theme colours here. The only colours are the neutral white/black luminance stops in those shared gradients, a deliberate exception to the token rule. Themes tune their strength via tokens.
- `src/settings.ts`: settings model (`THEMES`, `parseSettings`, load/save under `neon-cascade:settings`). Pure, tested in `settings.test.ts`. `settings-ui.ts` wires the native `<dialog>` in `index.html`; add new settings as extra `<section>`s and fields on `Settings`.
- `src/style.css`: **themes are token sets** on `[data-theme="…"]` (neon, pastel, dark). `<html data-theme>` holds the active one; theme preview cards set their own `data-theme` to preview locally. Gem colours are `--gem-0…6`, mapped to `--c` (outline) and `--fc` (body fill; optional per-theme `--gem-N-body` override) by `[data-type="N"]` rules. 3D strength per theme: `--gem-shade`, `--gem-gloss`, plus `--gem-fill-opacity`. Gems at rest have **no CSS `filter`** (no glow or drop shadow) so they stay crisp. Only the selected and pop animations add a temporary highlight glow. Glows scale with `--glow` (0 = flat). Never hard-code colours outside the token blocks, and when adding a token define it in **every** theme. A small inline script in `index.html` applies the saved theme before first paint.

## Static assets and icons

- `public/` is copied as-is into `dist/`. In `index.html`, reference these files with root-absolute paths (`/icon.svg`); Vite rewrites them to `./icon.svg` because of `base: './'`. Inside `manifest.webmanifest`, use paths relative to the manifest (`icon-192.png`, `start_url: "./"`), never `/…`, so the site works under the Pages sub-path.
- `public/icon.svg` is the source for the favicon and the PNG app icons. After editing it, run `scripts/icons.sh` (headless Chrome, no dependencies) and commit the PNGs. Keep the background opaque and full-bleed and the artwork within the central 80% circle (maskable safe zone).

## Conventions

- `strict` TypeScript with `verbatimModuleSyntax`: use `import type` for type-only imports.
- Keep logic testable: no DOM in `board.ts`; helper functions should take a grid and mutate it or return results.
- Use percentage sizes inside the board so it scales. Beware that percentage `padding`/`margin` is measured against the *board's* width, not the gem's.
- Wrap `localStorage` access in try/catch.
- Mobile zoom: `html { touch-action: manipulation }` stops double-tap zoom page-wide, and `.board` keeps `touch-action: none` for swipes. Don't add `user-scalable=no`/`maximum-scale` to the viewport meta, since pinch zoom must keep working for accessibility (it works outside the board). `src/zoom.test.ts` guards all three. It reads `style.css?raw`, which only works because `vite.config.ts` opts `style.css` into Vitest's CSS handling (`test.css.include`).
- Commit or push only when asked.
