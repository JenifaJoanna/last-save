#!/usr/bin/env bash
# Builds every wasm artifact with local paths remapped, so no machine path or
# user name is embedded in what ships. Release builds for judges use the pinned
# Docker image instead (scripts/build-reproducible.sh); this is the fast local path.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOME_DIR="$(cd ~ && pwd)"
USER_NAME="$(basename "$HOME_DIR")"
export RUSTFLAGS="--remap-path-prefix=${HOME_DIR}=/build --remap-path-prefix=${ROOT}=/src"
mkdir -p "$ROOT/outlayer/dist"

build_wasi() { # crate dir, binary name
  (cd "$ROOT/$1" && cargo build --quiet --target wasm32-wasip2 --release)
  cp "$ROOT/$1/target/wasm32-wasip2/release/$2.wasm" "$ROOT/outlayer/dist/$2.wasm"
  printf '%s  %s\n' "$(shasum -a 256 "$ROOT/outlayer/dist/$2.wasm" | cut -d' ' -f1)" "outlayer/dist/$2.wasm"
}
build_contract() { # crate dir (cargo-near overrides RUSTFLAGS, so plain cargo + strip here)
  local name; name="$(sed -n 's/^name = "\(.*\)"/\1/p' "$ROOT/$1/Cargo.toml" | head -1 | tr - _)"
  # --cfg near: near-sdk-env only emits host panic_utf8 (readable refusal messages) when built for the NEAR host;
  # cargo-near passes it, plain cargo must too, or every require! becomes a bare `unreachable` trap.
  (cd "$ROOT/$1" && RUSTFLAGS="$RUSTFLAGS -C link-arg=-s --cfg near" cargo build --quiet --target wasm32-unknown-unknown --release)
  mkdir -p "$ROOT/$1/target/near"
  cp "$ROOT/$1/target/wasm32-unknown-unknown/release/$name.wasm" "$ROOT/$1/target/near/$name.wasm"
  for w in "$ROOT/$1"/target/near/*.wasm; do printf '%s  %s\n' "$(shasum -a 256 "$w" | cut -d' ' -f1)" "${w#$ROOT/}"; done
}

TARGETS="${*:-release spike}"
for t in $TARGETS; do
  case "$t" in
    release) build_wasi outlayer/release lastsave-release ;;
    probe) build_wasi outlayer/probe lastsave-probe ;;
    spike) build_contract spike/contract ;;
    licence) build_contract contracts/licence ;;
    cleaner) build_contract contracts/cleaner ;;
    *) echo "unknown target $t" >&2; exit 2 ;;
  esac
done

# refuse if any local path or user name leaked into an artifact
LEAK=0
for w in "$ROOT"/outlayer/dist/*.wasm "$ROOT"/spike/contract/target/near/*.wasm "$ROOT"/contracts/*/target/near/*.wasm; do
  [ -f "$w" ] || continue
  if strings "$w" | grep -i -q -e "$USER_NAME" -e "$HOME_DIR"; then echo "LEAK: local path in ${w#$ROOT/}" >&2; LEAK=1; fi
done
exit $LEAK
