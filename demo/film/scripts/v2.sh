#!/usr/bin/env bash
# The v2 / final swap in one command: real takes → hit times and burst → judge-run facts → captions → gate → commit the
# generated files → render the three cuts on m2worker → master → dead-air + OCR checks → loudness summary.
#
# Usage: scripts/v2.sh [--final] [--tag NAME] [--only full|x|vertical] [--skip-render]
#   default     v2 review cut: out/last-save{,-x,-vertical}-v2.mp4. Gate failures are reported, not fatal.
#   --tag NAME  review cut named -NAME instead of -v2 (e.g. --tag pre for a render before the takes land).
#   --final     deliverables: out/last-save{,-x,-vertical}.mp4. final-gate and every render check must pass. A -v2
#               cut rendered from this same commit whose checks passed is promoted (copied) instead of re-rendered:
#               each render leaves <out>.commit (the commit it was rendered from) and <out>.checks (ok | fail).
#   --only      render one cut (repeatable); --skip-render stops after the commit (for checking inputs).
# DISK_MIN=<GB> lowers the disk-check floor (default 20), only with explicit owner approval of a lower one.
# Refuses to render while demo/film sources have uncommitted edits other than its own generated files: m2worker
# pulls from GitHub, so a retune that isn't pushed would silently not be in the render.
set -euo pipefail
cd "$(dirname "$0")/.."
FILM="$PWD"; REPO="$(cd ../.. && pwd)"
FINAL=0; SKIP=0; ONLY=(); TAG=v2
while [ $# -gt 0 ]; do case "$1" in
  --final) FINAL=1 ;; --skip-render) SKIP=1 ;; --only) ONLY+=("$2"); shift ;; --tag) TAG="$2"; shift ;;
  *) echo "usage: $0 [--final] [--tag NAME] [--only full|x|vertical] [--skip-render]"; exit 2 ;; esac; shift; done
[ ${#ONLY[@]} -eq 0 ] && ONLY=(full x vertical)
SUFFIX=$([ $FINAL = 1 ] && echo "" || echo "-$TAG")
step() { printf '\n== %s\n' "$*"; }
problems=()

step "disk"
~/.agents/bin/disk-check "${DISK_MIN:-20}"

step "takes (spec + contact sheets in out/takes/)"
node scripts/takes.mjs --sheets out/takes || { echo "a take breaks the spec: re-shoot it (see above)"; exit 1; }

step "hit times and screenshot bursts"
if [ -f public/footage/raw/match.events.json ]; then node scripts/hits.mjs; else echo "no match.events.json: MATCH_HITS unchanged"; problems+=("hit log missing"); fi
for d in public/footage/raw/*/; do if [ -f "$d/frames.json" ]; then node scripts/burst.mjs "$(basename "$d")"; fi; done

step "judge-run facts"
if [ -f scripts/facts.mjs ] && [ -f "$REPO/proof/judge-v2.json" ]; then
  node scripts/facts.mjs || { [ $FINAL = 1 ] && exit 1; problems+=("judge facts incomplete: MISSING values render on screen"); }
elif [ $FINAL = 1 ]; then echo "proof/judge-v2.json or scripts/facts.mjs missing: no final without the judge facts"; exit 1
else echo "judge proof not there yet: facts stay as they are"; problems+=("judge facts not swapped"); fi
# the afterlife set (S10, S12-S16): v2dev's real run, read from its proof files into run-facts-after.json
if [ -f scripts/facts.mjs ] && [ -f "$REPO/proof/run-v2dev-20261114T0857Z.json" ] && [ -f "$REPO/proof/verify-v2dev.json" ]; then
  node scripts/facts.mjs --set after || { [ $FINAL = 1 ] && exit 1; problems+=("after facts incomplete: MISSING values render on screen"); }
elif [ $FINAL = 1 ]; then echo "v2dev proof or proof/verify-v2dev.json missing: no final without the after facts"; exit 1
else echo "v2dev verify JSON not there yet: after facts stay as they are"; problems+=("after facts not refreshed"); fi

step "typecheck, render smoke test (first/middle/last frame of every scene) and captions"
npx tsc --noEmit -p .
node scripts/smoke.mjs || { echo "a scene fails to render: fix it before anything is pushed or rendered"; exit 1; }
node scripts/captions.mjs

step "final gate"
if node scripts/final-gate.mjs; then :; elif [ $FINAL = 1 ]; then exit 1; else problems+=("final-gate fails (see above)"); fi

step "commit generated files (explicit paths) and push"
GEN=()
for g in src/scenes/v1/g3/match.ts src/film/run-facts.json src/film/run-facts-after.json; do if [ -f "$g" ]; then GEN+=("$g"); fi; done
if [ -n "$(git status --porcelain -- "${GEN[@]}")" ]; then
  git add -- "${GEN[@]}" && git commit -q -m "Film${SUFFIX}: judge-run facts and hit times from the capture" -- "${GEN[@]}"
fi
dirty=$(git status --porcelain -- src public/vo public/music public/sfx scripts | grep -v '^??' || true)
[ -z "$dirty" ] || { echo "uncommitted film edits; commit them by path and re-run:"; echo "$dirty"; exit 1; }
git push -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "push did not land"; exit 1; }
[ $SKIP = 1 ] && { echo "inputs ready at $(git rev-parse --short HEAD); --skip-render given"; exit 0; }

step "render on m2worker, master, then dead-air + OCR checks and loudness"
comp() { case "$1" in full) echo LastSave ;; x) echo LastSaveX ;; vertical) echo LastSaveVertical ;; *) echo "unknown cut $1" >&2; exit 2 ;; esac; }
name() { case "$1" in full) echo last-save ;; x) echo last-save-x ;; vertical) echo last-save-vertical ;; esac; }
HEAD_SHA="$(git rev-parse HEAD)"; SYNCED=0
for cut in "${ONLY[@]}"; do
  out="out/$(name "$cut")${SUFFIX}.mp4"; rev="out/$(name "$cut")-v2.mp4"
  if [ $FINAL = 1 ] && [ -f "$rev" ] && [ "$(cat "$rev.commit" 2>/dev/null)" = "$HEAD_SHA" ] && [ "$(cat "$rev.checks" 2>/dev/null)" = ok ]; then
    cp "$rev" "$out"; echo "$HEAD_SHA" > "$out.commit"; echo ok > "$out.checks"
    echo "-- $out: promoted $rev (rendered from $HEAD_SHA, checks passed)"; continue
  fi
  if [ $SYNCED = 0 ]; then "$REPO/scripts/remote/m2-sync.sh"; SYNCED=1; fi
  raw="$(name "$cut")${SUFFIX}-raw.mp4"
  ~/.agents/bin/disk-check "${DISK_MIN:-20}"
  "$REPO/scripts/remote/m2-render.sh" "$(comp "$cut")" "$raw" --color-space=bt709
  scripts/master.sh "out/$raw" "$out"
  rm -f "out/$raw"; echo "$HEAD_SHA" > "$out.commit"
  echo "-- $out"
  if node scripts/check-render.mjs "$out" --ocr; then echo ok > "$out.checks"
  else echo fail > "$out.checks"; [ $FINAL = 1 ] && exit 1; problems+=("$out fails render checks"); fi
  ffmpeg -hide_banner -nostats -i "$out" -af ebur128=peak=true -f null - 2>&1 | grep -A14 Summary | grep -E "I:|LRA:|Peak:" || true
  ffprobe -v error -show_entries format=duration -of csv=p=0 "$out"
done

step "summary"
git log --oneline -1
if [ ${#problems[@]} -gt 0 ]; then printf 'open: %s\n' "${problems[@]}"; else echo "all gates passed"; fi
