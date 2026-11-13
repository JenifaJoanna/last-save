#!/usr/bin/env bash
# Studio shuts the official Ember Rift server down: deletes its Cloudflare Worker (and the Durable Object with it).
# Prints only its own lines (wrangler output, which can name the hosting account, is suppressed).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORKER="${1:-emberrift-arena}"
set -a; . "$ROOT/.env.local"; set +a
printf '\033[1;38;5;208m$ studio shutdown --server %s\033[0m\n' "$WORKER"
sleep 0.6
printf 'Stopping the official Ember Rift server…\n'
(cd "$ROOT/game/server" && npx wrangler delete --name "$WORKER" --force >/dev/null 2>&1)
printf '\033[38;5;203m✕ official server deleted (%s)\033[0m\n' "$WORKER"
sleep 0.4
printf 'No announcement. No end-of-service call.\n'
sleep 1.2
code=$(curl -s -o /dev/null -w '%{http_code}' -m 10 https://emberrift.pages.dev/health || true)
printf 'GET https://emberrift.pages.dev/health → %s\n' "$code"
