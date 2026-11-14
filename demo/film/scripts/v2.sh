#!/usr/bin/env bash
# The v2 / final swap in one command: real takes → hit times and burst → judge-run facts → captions → gate → commit the
# generated files → render the three cuts on m2worker → master → dead-air + OCR checks → loudness summary.
#
# Usage: scripts/v2.sh [--final] [--only full|x|vertical] [--skip-render]
#   default     v2 review cut: out/last-save{,-x,-vertical}-v2.mp4. Gate failures are reported, not fatal.
#   --final     deliverables: out/last-save{,-x,-vertical}.mp4. final-gate and every render check must pass.
#   --only      render one cut (repeatable); --skip-render stops after the commit (for checking inputs).
# Refuses to render while demo/film sources have uncommitted edits other than its own generated files: m2worker
# pulls from GitHub, so a retune that isn't pushed would silently not be in the render.
set -euo pipefail
cd "$(dirname "$0")/.."
FILM="$PWD"; REPO="$(cd ../.. && pwd)"
FINAL=0; SKIP=0; ONLY=()
while [ $# -gt 0 ]; do case "$1" in
  --final) FINAL=1 ;; --skip-render) SKIP=1 ;; --only) ONLY+=("$2"); shift ;;
  *) echo "usage: $0 [--final] [--only full|x|vertical] [--skip-render]"; exit 2 ;; esac; shift; done
[ ${#ONLY[@]} -eq 0 ] && ONLY=(full x vertical)
SUFFIX=$([ $FINAL = 1 ] && echo "" || echo "-v2")
step() { printf '\n== %s\n' "$*"; }
problems=()

step "disk"
~/.agents/bin/disk-check

step "takes (spec + contact sheets in out/takes/)"
node scripts/takes.mjs --sheets out/takes || { echo "a take breaks the spec: re-shoot it (see above)"; exit 1; }

step "hit times and screenshot bursts"
if [ -f public/footage/raw/match.events.json ]; then node scripts/hits.mjs; else echo "no match.events.json: MATCH_HITS unchanged"; problems+=("hit log missing"); fi
for d in public/footage/raw/*/; do if [ -f "$d/frames.json" ]; then node scripts/burst.mjs "$(basename "$d")"; fi; done

step "judge-run facts"
if [ -f scripts/facts.mjs ] && [ -f "$REPO/proof/judge-v2.json" ]; then node scripts/facts.mjs
elif [ $FINAL = 1 ]; then echo "proof/judge-v2.json or scripts/facts.mjs missing: no final without the judge facts"; exit 1
else echo "judge proof not there yet: facts stay as they are"; problems+=("judge facts not swapped"); fi

step "typecheck and captions"
npx tsc --noEmit -p .
node scripts/captions.mjs

step "final gate"
if node scripts/final-gate.mjs; then :; elif [ $FINAL = 1 ]; then exit 1; else problems+=("final-gate fails (see above)"); fi

step "commit generated files (explicit paths) and push"
GEN=()
for g in src/scenes/v1/g3/match.ts src/film/run-facts.json; do if [ -f "$g" ]; then GEN+=("$g"); fi; done
if [ -n "$(git status --porcelain -- "${GEN[@]}")" ]; then
  git add -- "${GEN[@]}" && git commit -q -m "Film${SUFFIX}: judge-run facts and hit times from the capture" -- "${GEN[@]}"
fi
dirty=$(git status --porcelain -- src public/vo public/music public/sfx scripts | grep -v '^??' || true)
[ -z "$dirty" ] || { echo "uncommitted film edits; commit them by path and re-run:"; echo "$dirty"; exit 1; }
git push -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "push did not land"; exit 1; }
[ $SKIP = 1 ] && { echo "inputs ready at $(git rev-parse --short HEAD); --skip-render given"; exit 0; }

step "render on m2worker"
"$REPO/scripts/remote/m2-sync.sh"
comp() { case "$1" in full) echo LastSave ;; x) echo LastSaveX ;; vertical) echo LastSaveVertical ;; *) echo "unknown cut $1" >&2; exit 2 ;; esac; }
name() { case "$1" in full) echo last-save ;; x) echo last-save-x ;; vertical) echo last-save-vertical ;; esac; }
for cut in "${ONLY[@]}"; do
  raw="$(name "$cut")${SUFFIX}-raw.mp4"; out="out/$(name "$cut")${SUFFIX}.mp4"
  ~/.agents/bin/disk-check
  "$REPO/scripts/remote/m2-render.sh" "$(comp "$cut")" "$raw" --color-space=bt709
  scripts/master.sh "out/$raw" "$out"
  rm -f "out/$raw"
done

step "render checks (dead air + OCR) and loudness"
for cut in "${ONLY[@]}"; do
  out="out/$(name "$cut")${SUFFIX}.mp4"
  echo "-- $out"
  node scripts/check-render.mjs "$out" --ocr || { [ $FINAL = 1 ] && exit 1; problems+=("$out fails render checks"); }
  ffmpeg -hide_banner -nostats -i "$out" -af ebur128=peak=true -f null - 2>&1 | grep -A14 Summary | grep -E "I:|LRA:|Peak:" || true
  ffprobe -v error -show_entries format=duration -of csv=p=0 "$out"
done

step "summary"
git log --oneline -1
if [ ${#problems[@]} -gt 0 ]; then printf 'open: %s\n' "${problems[@]}"; else echo "all gates passed"; fi
