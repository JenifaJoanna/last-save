#!/usr/bin/env bash
# Promotes the v2 review cuts to the deliverables without re-rendering, when that is provably the same film:
#  - every out/<cut>-v2.mp4 passed its render checks (<cut>-v2.mp4.checks = ok, written by v2.sh);
#  - nothing the render reads changed since the commit it was rendered from (<cut>-v2.mp4.commit): no diff under
#    demo/film/src, demo/film/public or demo/film/vo. Other commits (PUBLISH.md, proof/ files) may move HEAD;
#    v2.sh --final compares HEAD itself, so it would re-render needlessly after them;
#  - scripts/final-gate.mjs passes now.
# Then copies them to out/last-save.mp4, out/last-save-x.mp4, out/last-save-vertical.mp4 (+ sidecars) and prints sizes.
# Usage: scripts/promote.sh
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/final-gate.mjs
for name in last-save last-save-x last-save-vertical; do
  rev="out/$name-v2.mp4"; out="out/$name.mp4"
  [ -f "$rev" ] || { echo "promote: $rev missing"; exit 1; }
  [ "$(cat "$rev.checks" 2>/dev/null)" = ok ] || { echo "promote: $rev did not pass its render checks"; exit 1; }
  c="$(cat "$rev.commit" 2>/dev/null)"; [ -n "$c" ] || { echo "promote: $rev has no .commit"; exit 1; }
  if ! git diff --quiet "$c" HEAD -- src public vo; then
    echo "promote: render inputs changed since $c (re-render with scripts/v2.sh --final):"; git diff --stat "$c" HEAD -- src public vo | tail -5; exit 1
  fi
  cp "$rev" "$out"; echo "$c" > "$out.commit"; echo ok > "$out.checks"
  echo "promote: $out ← $rev (rendered from ${c:0:7}; render inputs unchanged at $(git rev-parse --short HEAD))"
done
ls -la out/last-save.mp4 out/last-save-x.mp4 out/last-save-vertical.mp4
