#!/usr/bin/env bash
# Render a Remotion composition on the M2 box (concurrency 1, one job at a time) and pull the mp4 back.
# Usage: scripts/remote/m2-render.sh <composition> <out-name.mp4> [extra remotion render args]
# Example (5 s test): scripts/remote/m2-render.sh LastSave test.mp4 --frames=0-149
set -euo pipefail

[ $# -ge 2 ] || { echo "usage: $0 <composition> <out-name.mp4> [remotion args]"; exit 2; }
COMP="$1"; OUT="$2"; shift 2
EXTRA="$*"

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_HOST="${M2_SSH:-m2worker}"
LAN_HOST="${M2_LAN:-m2worker-lan}"
REMOTE_DIR="${M2_DIR:-lastsave}"
LOCAL_OUT="$REPO/demo/film/out"
mkdir -p "$LOCAL_OUT"

echo "[m2-render] refusing to start if another remotion job is running on the box"
if ssh "$SSH_HOST" "pgrep -f 'remotion render' >/dev/null"; then
  echo "[m2-render] a render is already running there; aborting"; exit 1
fi

echo "[m2-render] rendering $COMP -> out/$OUT (concurrency 1) $EXTRA"
# Render with the box's full Google Chrome: the bundled headless shell drops some CSS-3D billboards (S12's plinth
# tags rendered blank on 14 Nov), and every scene was reviewed on full Chrome. Override with M2_BROWSER.
BROWSER="${M2_BROWSER:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
ssh "$SSH_HOST" "zsh -lc 'cd ~/$REMOTE_DIR/demo/film && mkdir -p out && \
  npx remotion render src/index.ts $COMP out/$OUT --codec h264 --pixel-format yuv420p --concurrency=1 \"--browser-executable=$BROWSER\" $EXTRA'"

echo "[m2-render] pulling out/$OUT to $LOCAL_OUT"
rsync -a --progress "$LAN_HOST:$REMOTE_DIR/demo/film/out/$OUT" "$LOCAL_OUT/"

echo "[m2-render] done: $LOCAL_OUT/$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$LOCAL_OUT/$OUT" || true
