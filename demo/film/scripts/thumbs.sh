#!/usr/bin/env bash
# Renders the thumbnail design (composition Thumb, 1920×1080) once and writes the two upload sizes:
# out/thumb-youtube.png (1280×720) and out/thumb-x.png (1600×900). Local still render with the installed Chrome.
set -euo pipefail
cd "$(dirname "$0")/.."
BROWSER="${BROWSER:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
mkdir -p out
npx remotion still src/index.ts Thumb out/thumb-1920.png --frame=0 --browser-executable="$BROWSER" --log=error
ffmpeg -hide_banner -loglevel error -y -i out/thumb-1920.png -vf "scale=1280:720:flags=lanczos" out/thumb-youtube.png
ffmpeg -hide_banner -loglevel error -y -i out/thumb-1920.png -vf "scale=1600:900:flags=lanczos" out/thumb-x.png
rm -f out/thumb-1920.png
ls -la out/thumb-youtube.png out/thumb-x.png
