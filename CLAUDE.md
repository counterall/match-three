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

## Architecture

- `src/board.ts`: **pure game logic**, with no DOM access. The grid is `grid[row][col]` of `Gem | null` (`null` only between clearing and refilling). Randomness is injected as an `Rng` so tests can be deterministic. Put new rules (special gems, modes, scoring) here and add tests in `src/board.test.ts`.
- `src/main.ts`: rendering, input and game flow.
  - Each gem has a stable `id`, and its DOM element lives in the `els` map. `render()` moves elements to their grid positions with `transform: translate(col*100%, row*100%)`, and CSS transitions do the animation.
  - New gems from `collapse()` are created above the board (`fromRow < 0`) and then fall in.
  - `busy` blocks input while a swap or cascade is running. `gameToken` is bumped by `newGame()` so cascades still in flight stop touching the board.
  - Animation timings are TS constants pushed to CSS as `--swap-ms` / `--pop-ms`. Keep TS waits and CSS durations in sync through these, and respect `prefers-reduced-motion`.
- `src/gems.ts`: SVG shape per gem type (count must match `GEM_TYPES` in `board.ts`). No colours here.
- `src/settings.ts`: settings model (`THEMES`, `parseSettings`, load/save under `neon-cascade:settings`). Pure, tested in `settings.test.ts`. `settings-ui.ts` wires the native `<dialog>` in `index.html`; add new settings as extra `<section>`s and fields on `Settings`.
- `src/style.css`: **themes are token sets** on `[data-theme="…"]` (neon, pastel, dark). `<html data-theme>` holds the active one; theme preview cards set their own `data-theme` to preview locally. Gem colours are `--gem-0…6`, mapped to `--c`/`--f` by `[data-type="N"]` rules. Glows scale with `--glow` (0 = flat). Never hard-code colours outside the token blocks, and when adding a token define it in **every** theme. A small inline script in `index.html` applies the saved theme before first paint.

## Conventions

- `strict` TypeScript with `verbatimModuleSyntax`: use `import type` for type-only imports.
- Keep logic testable: no DOM in `board.ts`; helper functions should take a grid and mutate it or return results.
- Use percentage sizes inside the board so it scales. Beware that percentage `padding`/`margin` is measured against the *board's* width, not the gem's.
- Wrap `localStorage` access in try/catch.
- Commit or push only when asked.
