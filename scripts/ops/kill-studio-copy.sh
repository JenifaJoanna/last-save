#!/usr/bin/env bash
# Studio takes its own copy of the encrypted build offline: deletes the Cloudflare Pages project kiln-cdn-<name>
# (the studio-hosted artifact mirror) so that URL really answers 404. The Walrus and GitHub copies are not the studio's to delete.
#   scripts/ops/kill-studio-copy.sh <name> [artifact-file]
# Prints only its own lines (wrangler output can name the hosting account and is suppressed).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NAME="${1:?usage: kill-studio-copy.sh <name> [artifact-file]}"
PROJECT="kiln-cdn-${NAME//_/-}"
set -a; . "$ROOT/.env.local"; set +a
printf '\033[1;38;5;208m$ studio shutdown --artifact-cdn %s\033[0m\n' "$PROJECT"
(cd "$ROOT/game/server" && node node_modules/wrangler/bin/wrangler.js pages project delete "$PROJECT" --yes >/dev/null 2>&1) \
  || { printf 'could not delete %s (already gone?)\n' "$PROJECT"; }
printf '\033[38;5;203m✕ studio artifact copy deleted (%s)\033[0m\n' "$PROJECT"
URL="https://${PROJECT}.pages.dev/${2:-}"
for i in 1 2 3 4 5 6; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$URL" || true)
  [ "$code" = "404" ] && break
  sleep 5
done
printf 'GET %s → %s\n' "$URL" "$code"
