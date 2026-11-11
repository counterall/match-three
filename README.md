# Neon Cascade

A neon-styled match-3 puzzle game that runs in the browser, built with TypeScript and Vite.

Swap neighbouring gems to line up three or more of the same kind. Matched gems burst, the gems above fall into the gaps, and new matches made by the fall cascade for bigger scores.

## How to play

- **Swap:** click or tap a gem, then click a neighbouring gem. You can also drag a gem up, down, left or right.
- **Match:** a swap only counts if it makes a line of 3 or more. Otherwise the gems slide back.
- **Score:** 10 points per gem cleared, plus 20 for each gem beyond 3 in a line. Every cascade step multiplies the points (×2, ×3, …).
- **Hint:** press **Hint**, or wait a few seconds, and two gems you can swap will bounce.
- **Stuck?** When no moves are left, the board shuffles itself.
- Your best score is saved in the browser.
- **Settings:** pick a colour theme: Neon, Pastel or Dark (black & white). Your choice is remembered.

## Getting started

Requires [Node.js](https://nodejs.org/) 20+ and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm dev        # start the dev server, then open the printed URL
```

## Scripts

| Command          | What it does                                   |
| ---------------- | ---------------------------------------------- |
| `pnpm dev`       | Start the Vite dev server with hot reload      |
| `pnpm build`     | Type-check and build a static site into `dist/` |
| `pnpm preview`   | Serve the production build locally             |
| `pnpm test`      | Run the unit tests (Vitest)                    |
| `pnpm typecheck` | Run the TypeScript compiler without emitting   |

## Project structure

```
index.html          Page shell: header, board container, buttons
src/
  board.ts          Pure game logic: matching, gravity, refill, moves, shuffle
  board.test.ts     Unit tests for the game logic
  gems.ts           Gem SVG shapes (colours come from the theme)
  settings.ts       Settings model: themes, parsing, persistence
  settings-ui.ts    Settings popup (theme picker)
  main.ts           Rendering, input, animations and game flow
  style.css         Theme tokens, layout and animations
```

## Deploying

**Live:** https://counterall.github.io/match-three/

Every push to `main` runs `.github/workflows/deploy.yml`: it installs dependencies, type-checks, runs the tests, builds and publishes `dist/` to GitHub Pages. Pull requests run the same checks without deploying. A deploy can also be started by hand from the repo's **Actions** tab (*Run workflow*).

The build uses relative asset paths (`base: './'` in `vite.config.ts`), so `dist/` also works on any other static host.

## Roadmap

- Special gems for 4- and 5-in-a-row matches
- Sound effects
- Timed mode and levels
- Keyboard controls
