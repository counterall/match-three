# Neon Cascade

A neon-styled match-3 puzzle game that runs in the browser, built with TypeScript and Vite.

Swap neighbouring gems to line up three or more of the same kind. Matched gems burst, the gems above fall into the gaps, and new matches made by the fall cascade for bigger scores.

## How to play

- **Swap:** click or tap a gem, then click a neighbouring gem. You can also drag a gem up, down, left or right.
- **Match:** a swap only counts if it makes a line of 3 or more. Otherwise the gems slide back.
- **Score:** 10 points per gem cleared, plus 20 for each gem beyond 3 in a line. Every cascade step multiplies the points (×2, ×3, …).
- **Time limit:** each round lasts 3 minutes by default (5 or 10 in Settings). The clock starts with your first move and pauses while Settings is open or the tab is hidden. Every 1,000 points adds 20 seconds. When time runs out, a cascade already falling still scores, then the round ends and **Play again** starts a new one.
- **Pause:** once the clock is running, tap the pause button (left of **Hint**) to stop it. The board is hidden while paused; tap **Resume** (or the button again) to carry on. Switching away (another tab, or minimising the home-screen app on iOS/Android) pauses automatically.
- **Hint:** press **Hint**, or wait a few seconds, and two gems you can swap will bounce.
- **Stuck?** When no moves are left, the board shuffles itself.
- **Board size** adapts to the screen: 8×8 on desktops and tablets, 6 columns × 8 rows on phones for bigger gems.
- **No accidental zoom:** tapping quickly on a phone never zooms the page. In a browser tab, pinch zoom still works outside the board. In the home-screen app, the page doesn't zoom at all, like a native app.
- Your best score is saved in the browser.
- **Settings:** pick a colour theme (Neon, Pastel or Dark, black & white), the round's time limit and the language. Your choices are remembered. A new time limit applies from the next game, or straight away if you haven't moved yet.
- **Languages:** English and Simplified Chinese (简体中文). The first visit follows your browser's language (any Chinese variant gets Simplified Chinese, everything else English). Switching in Settings changes the page straight away.
- **Home screen:** on a phone, use *Share → Add to Home Screen* (iOS) or *Add to Home screen / Install app* (Android) to get a Neon Cascade app icon that opens full screen.

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
index.html          Page shell: header, board container, buttons, icon/manifest links
public/             Static files copied as-is into dist/
  icon.svg          App icon source (also the favicon)
  apple-touch-icon.png, icon-192.png, icon-512.png   PNGs generated from icon.svg
  manifest.webmanifest   Web app manifest for "Add to Home Screen"
scripts/icons.sh    Regenerates the PNG icons from icon.svg
src/
  board.ts          Pure game logic: matching, gravity, refill, moves, shuffle
  board.test.ts     Unit tests for the game logic
  gems.ts           Gem SVG shapes (colours come from the theme)
  settings.ts       Settings model: themes, time limits, language, parsing, persistence
  i18n.ts           UI text in English and Simplified Chinese, browser-language detection
  pause.ts          Pause rules (when pausing is allowed, auto-pause on hide)
  settings-ui.ts    Settings popup (theme, time-limit and language pickers)
  timer.ts          Round timer rules: countdown with pauses, time bonus, m:ss
  main.ts           Rendering, input, animations and game flow
  style.css         Theme tokens, layout and animations
```

## App icons

`public/icon.svg` is the single source for every icon. After editing it, regenerate and commit the PNGs:

```bash
scripts/icons.sh    # needs Google Chrome or Chromium; set CHROME=/path/to/browser to override
```

It writes `apple-touch-icon.png` (180×180, iOS home screen), `icon-192.png` and `icon-512.png` (manifest; the 512 is also the Android maskable icon). Keep the background full-bleed and opaque, since iOS and Android apply their own rounded masks, and keep the artwork inside the central circle of radius 40% so maskable crops don't clip it.

## Deploying

**Live:** https://counterall.github.io/match-three/

Every push to `main` runs `.github/workflows/deploy.yml`: it installs dependencies, type-checks, runs the tests, builds and publishes `dist/` to GitHub Pages. Pull requests run the same checks without deploying. A deploy can also be started by hand from the repo's **Actions** tab (*Run workflow*).

The build uses relative asset paths (`base: './'` in `vite.config.ts`), so `dist/` also works on any other static host.

## Roadmap

- Special gems for 4- and 5-in-a-row matches
- Sound effects
- Levels
- Keyboard controls
