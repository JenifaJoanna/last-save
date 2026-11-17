#!/usr/bin/env bash
# Builds the game client and the platform web app, gates on identity + secrets, deploys to Pages
# (last-save.pages.dev), then re-runs the identity gate against the live URLs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env.local; set +a
# Instance: NAME=<factory instance> (e.g. v2dev, ember-rift) wires a v2 instance; otherwise v1 defaults.
if [ -n "${NAME:-}" ]; then
  export VITE_LICENCE_CONTRACT="${VITE_LICENCE_CONTRACT:-$NAME.lastsave-factory.testnet}"
  export VITE_OFFICIAL_URL="${VITE_OFFICIAL_URL:-https://emberrift-$NAME.pages.dev}"
  export VITE_RELAYER_URL="${VITE_RELAYER_URL:-https://lastsave-relay.pages.dev}"
  export VITE_RELAYER_ACCOUNT="${VITE_RELAYER_ACCOUNT:-relay.lastsave-studio.testnet}"
  export VITE_FACTORY="${VITE_FACTORY:-lastsave-factory.testnet}"
fi
export VITE_LICENCE_CONTRACT="${VITE_LICENCE_CONTRACT:-lastsave-licence.testnet}"
export VITE_PLATFORM_URL="${VITE_PLATFORM_URL:-https://last-save.pages.dev}"
export VITE_OFFICIAL_URL="${VITE_OFFICIAL_URL:-https://emberrift.pages.dev}"
PROJECT="${PAGES_PROJECT:-last-save}"
# PAGES_BRANCH=<name> deploys a preview at https://<name>.<project>.pages.dev; main (default) is the live root.
(cd game/client && npx vite build --logLevel warn)
(cd web && npx vite build --logLevel warn && node scripts/copy-play.mjs)
node scripts/check-secrets.mjs
node scripts/check-identity.mjs
npx wrangler pages project list 2>/dev/null | grep -q " $PROJECT " || npx wrangler pages project create "$PROJECT" --production-branch main >/dev/null
npx wrangler pages deploy web/dist --project-name "$PROJECT" --branch "${PAGES_BRANCH:-main}" --commit-dirty=true 2>&1 | grep -E "Success|Deployment complete|https://" | sed -E 's#https://[a-z0-9]+\.#https://<deploy>.#'
sleep 8
node scripts/check-identity.mjs --live
