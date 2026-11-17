#!/usr/bin/env bash
# Launches several licence instances one after another through the studio pipeline, running each step on its own and
# retrying a failed step (a new Pages project can fail its first deploy). Standby stores (prod timers) get three seeded
# test holders, so one report cannot kill them; judges' own copies (demo timers) stay empty until a judge buys in.
#   NAMES="live-2:prod sbx-1:demo" bash scripts/ops/launch-pool.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env.local; set +a
export NEAR_RPCS="${NEAR_RPCS:-https://near-testnet.drpc.org}"
mkdir -p local   # step logs; a fresh worktree has no local/ yet
failed=0
# A step already recorded without an error in proof/launch-<name>.json is skipped, so a rerun resumes where it stopped.
done_step() { node -e 'const fs=require("fs"),f=`proof/launch-${process.argv[1]}.json`;if(!fs.existsSync(f))process.exit(1);const s=JSON.parse(fs.readFileSync(f,"utf8")).steps??[];process.exit(s.some(x=>x.step===process.argv[2]&&!x.error)?0:1)' "$1" "$2"; }
for spec in ${NAMES:?NAMES is required}; do
  name="${spec%%:*}"; mode="${spec##*:}"
  ops=$([ "$mode" = prod ] && echo 1.0 || echo 0.5)
  echo "== $name ($mode, ops $ops N) $(date +%H:%M:%S)"
  for step in cibuild walrus cdn mirrors instance escrow attest snapkey official verify; do
    if done_step "$name" "$step"; then echo "   $step already done"; continue; fi
    ok=0
    for try in 1 2 3; do
      if NAME="$name" LIVENESS="$mode" OPS_N="$ops" node scripts/launch/launch.mjs "$step" > "local/launch-$name-$step.log" 2>&1; then ok=1; break; fi
      echo "   $step failed (try $try): $(tail -c 200 "local/launch-$name-$step.log" | tr '\n' ' ')"; sleep 20
    done
    [ "$ok" = 1 ] || { echo "   giving up on $name at $step"; failed=1; continue 2; }
    echo "   $step ok"
  done
  if [ "$mode" = prod ]; then
    NAME="$name" node --input-type=module -e '
      import { call } from "./scripts/lib/near.mjs";
      for (const a of ["lastsave-mira.testnet", "lastsave-kofi.testnet", "lastsave-yuna.testnet"]) {
        const r = await call(a, `${process.env.NAME}.lastsave-factory.testnet`, "buy_licence", {}, { gas: 100, deposit: "0.25" });
        console.log(`   seed ${a}: ${r.failure ? "FAILED " + JSON.stringify(r.failure).slice(0, 120) : r.hash}`);
      }'
  fi
  echo "== $name done $(date +%H:%M:%S)"
done
exit $failed
