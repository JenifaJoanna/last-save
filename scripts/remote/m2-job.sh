#!/usr/bin/env zsh
# Runs ON the M2 box (started detached by m2-render.sh): one Remotion render with its output in out/<name>.log and its
# exit code in out/<name>.exit, so the render survives an ssh drop and the caller polls for the result.
# Usage (on the box, from the repo root): scripts/remote/m2-job.sh <composition> <out-name.mp4> <browser> [remotion args]
set -u
COMP="$1"; OUT="$2"; BROWSER="$3"; shift 3
cd "$(dirname "$0")/../../demo/film" || exit 2
mkdir -p out
rm -f "out/$OUT.exit" "out/$OUT.log"
npx remotion render src/index.ts "$COMP" "out/$OUT" --codec h264 --pixel-format yuv420p --concurrency=1 \
  "--browser-executable=$BROWSER" "$@" > "out/$OUT.log" 2>&1
echo $? > "out/$OUT.exit"
