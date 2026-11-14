#!/usr/bin/env bash
# A fan hosts the released game: same entry point as `pnpm host` (pnpm --filter host host), run directly so pnpm's
# script banner (which prints absolute package paths) stays out of the recording.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
printf '\033[1;38;2;255;201;74m$ pnpm -s host --local --claim --account %s\033[0m\n' "${1:-lastsave-fanhost.testnet}"
exec node host/bin/host.mjs --local --claim --account "${1:-lastsave-fanhost.testnet}"
