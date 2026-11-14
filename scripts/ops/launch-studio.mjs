#!/usr/bin/env node
// A second studio launches its game through the factory in one transaction (film take t-factory). Runs the real launch
// steps `instance` + `verify` (scripts/launch/launch.mjs) for a studio prepared with `cibuild walrus mirrors`, and
// prints them as short lines. Nothing here is simulated: the tx link and the on-chain checks come from the steps.
//   pnpm -s studio:launch <name>
import { spawnSync } from "node:child_process";

const STUDIOS = {
  tidebreak: { STUDIO: "tidebreak-studio.testnet", TITLE: "Tidebreak", GAME_ID: "tidebreak", studioName: "Saltglass Games",
    MEDIA: "https://last-save.pages.dev/art/tidebreak-key.svg", OFFICIAL_URL: "https://tidebreak-lastsave.pages.dev", OPS_N: "0.3" },
};
const name = process.argv[2];
const s = STUDIOS[name];
if (!s) { process.stderr.write(`usage: launch-studio.mjs <${Object.keys(STUDIOS).join("|")}>\n`); process.exit(2); }

const gold = (t) => `\x1b[38;2;255;201;74m${t}\x1b[0m`, ok = (t) => `\x1b[38;2;69;227;148m${t}\x1b[0m`, dim = (t) => `\x1b[2m${t}\x1b[0m`;
const out = (t = "") => process.stdout.write(`${t}\n`);
const { studioName, ...env } = s;
out(`${s.studioName} launches ${gold(s.TITLE)} through ${gold("lastsave-factory.testnet")}`);
const run = spawnSync(process.execPath, ["scripts/launch/launch.mjs", "instance", "verify"], { env: { ...process.env, ...env, NAME: name }, encoding: "utf8" });
const rec = Object.fromEntries((run.stdout ?? "").split("\n").map((l) => l.match(/^(instance|verify): (\{.*\})$/)).filter(Boolean).map((m) => [m[1], JSON.parse(m[2])]));
if (run.status !== 0 || !rec.instance || !rec.verify) {
  out(`  launch failed: ${(run.stderr || run.stdout || "").trim().split("\n").pop()?.slice(0, 160)}`);
  process.exit(1);
}
const i = rec.instance, v = rec.verify.summary;
const field = (k) => v.match(new RegExp(`${k}=(\\S+)`))?.[1];
out(`  create_instance("${name}") · deposit ${i.deposit} · ${ok("one transaction")}`);
out(`  tx ${i.url}`);
out(`  ${gold(i.instance)}  ${ok(field("status") ?? "")}`);
out(`  code: the global licence contract ${field("code")} ${dim("(no code of its own)")}`);
out(`  access keys: ${field("keys")} ${ok("· born locked")}`);
out(`  Base payout address (NEAR Chain Signatures): ${i.evm_address}`);
