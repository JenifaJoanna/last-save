#!/usr/bin/env bash
# Builds the no-wallet tap-through preview (scripted lifecycle, no chain writes) and deploys it to its own
# Pages project (last-save-preview.pages.dev), gated by the identity and secrets checks before and after.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env.local; set +a
PROJECT="${PREVIEW_PROJECT:-last-save-preview}"
(cd game/client && npx vite build --logLevel warn)
rm -rf web/dist-preview
(cd web && VITE_PREVIEW=1 VITE_RELAYER_URL=https://lastsave-relay.pages.dev VITE_RELAYER_ACCOUNT=relay.lastsave-studio.testnet VITE_ATTACK_TARGET=${ATTACK_TARGET:-v2dev.lastsave-factory.testnet} npx vite build --mode preview --outDir dist-preview --logLevel warn)
cp -R game/client/dist web/dist-preview/play
printf '/play/* /play/index.html 200\n/* /index.html 200\n' > web/dist-preview/_redirects
printf '/*\n  X-Robots-Tag: noindex\n' > web/dist-preview/_headers
node scripts/check-secrets.mjs
node scripts/check-identity.mjs
npx wrangler pages project list 2>/dev/null | grep -q " $PROJECT " || npx wrangler pages project create "$PROJECT" --production-branch main >/dev/null
npx wrangler pages deploy web/dist-preview --project-name "$PROJECT" --branch main --commit-dirty=true 2>&1 | grep -E "Success|Deployment complete|https://" | sed -E 's#https://[a-z0-9]+\.#https://<deploy>.#'
sleep 8
node scripts/check-identity.mjs --live
