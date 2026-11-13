#!/usr/bin/env bash
# One command: build the probe wasm, then run it under wasmtime against every fixture scenario.
# Needs: rust (wasm32-wasip2), wasmtime, node, and `pnpm install` at the repo root.
# Set SKIP_BUILD=1 to reuse outlayer/dist/lastsave-probe.wasm as is.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
if [ "${SKIP_BUILD:-}" != "1" ]; then
  "$ROOT/scripts/build-wasm.sh" probe
fi
cd "$ROOT"
exec node outlayer/probe/fixtures/run-e2e.mjs "$ROOT/outlayer/dist/lastsave-probe.wasm"
