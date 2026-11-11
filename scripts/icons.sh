#!/usr/bin/env sh
# Regenerate the PNG app icons in public/ from public/icon.svg.
# Uses headless Chrome/Chromium only (no project dependencies).
# Usage: scripts/icons.sh   (set CHROME=/path/to/chrome to override)
set -eu
cd "$(dirname "$0")/../public"
CHROME="${CHROME:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}"
if [ -z "$CHROME" ]; then
  echo "Chrome/Chromium not found; set CHROME=/path/to/browser" >&2
  exit 1
fi
render() { # size outfile
  rm -f "$2"
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --window-size="$1,$1" \
    --screenshot="$PWD/$2" "file://$PWD/icon.svg" >/dev/null 2>&1 || true
  if [ ! -s "$2" ]; then
    echo "failed to render public/$2 with $CHROME" >&2
    exit 1
  fi
  echo "wrote public/$2 (${1}x$1)"
}
render 180 apple-touch-icon.png
render 192 icon-192.png
render 512 icon-512.png
