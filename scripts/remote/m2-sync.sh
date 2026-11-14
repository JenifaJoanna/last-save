#!/usr/bin/env bash
# Sync the Last Save film project to the M2 offload box (m2worker). Read-only clone there; never pushes.
# Usage: scripts/remote/m2-sync.sh
# Note: the box pulls from GitHub main, so push your code first; uncommitted local code is NOT sent.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
FILM="$REPO/demo/film"
SSH_HOST="${M2_SSH:-m2worker}"      # Tailscale, for commands
LAN_HOST="${M2_LAN:-m2worker-lan}"  # LAN, for bulk transfer
REMOTE_DIR="${M2_DIR:-lastsave}"

echo "[m2-sync] git pull on $SSH_HOST:~/$REMOTE_DIR (fast-forward only)"
ssh "$SSH_HOST" "cd ~/$REMOTE_DIR && git pull --ff-only"

echo "[m2-sync] install deps if lockfile changed"
ssh "$SSH_HOST" "zsh -lc 'cd ~/$REMOTE_DIR/demo/film && pnpm install --frozen-lockfile --ignore-workspace --silent'"

echo "[m2-sync] rsync untracked inputs (public/footage, public/plates) over $LAN_HOST"
rsync -a --itemize-changes \
  --exclude='.env*' --exclude='*.pem' --exclude='*.key*' --exclude='node_modules' --exclude='out' \
  "$FILM/public/footage/" "$LAN_HOST:$REMOTE_DIR/demo/film/public/footage/"
# placeholder stills used by footage slots until the real takes land (gitignored like footage)
[ -d "$FILM/public/plates" ] && rsync -a --exclude='.env*' "$FILM/public/plates/" "$LAN_HOST:$REMOTE_DIR/demo/film/public/plates/"

echo "[m2-sync] note: tracked files edited locally but not pushed are not on the box"
echo "[m2-sync] done"
