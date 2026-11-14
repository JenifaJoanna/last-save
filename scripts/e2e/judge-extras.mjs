#!/usr/bin/env node
// After the judge run: adds two blocks to the run proof so the film reads every on-screen number from files, never from
// a second hand-typed source, and saves `pnpm verify --json` for the same instance beside it.
//   "afterlife": pool, ops budget and runway read from get_info at one final block (runway = floor(pool / epoch_cap),
//                the dashboard's formula in web/src/pages/app/afterlife-cards.tsx; *_near strings use the app's rounding)
//   "files":     the launch proof and the verify output for this instance
//   node scripts/e2e/judge-extras.mjs [--proof proof/judge-v2.json] [--contract ember-rift.lastsave-factory.testnet] [--no-verify]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PROOF = arg("proof", "proof/judge-v2.json");
const CONTRACT = arg("contract", "ember-rift.lastsave-factory.testnet");
const NAME = CONTRACT.split(".")[0];
const RPC = process.env.NEAR_RPC ?? "https://rpc.testnet.fastnear.com";
const YOCTO = 10n ** 24n;

/** The web app's near(): truncate to 3 decimals, drop trailing zeros, en-US grouping. */
export function nearStr(yocto, dp = 3) {
  let v = BigInt(String(yocto ?? "0").split(".")[0] || "0");
  const neg = v < 0n; if (neg) v = -v;
  const frac = (v % YOCTO).toString().padStart(24, "0").slice(0, dp).replace(/0+$/, "");
  return `${neg ? "-" : ""}${(v / YOCTO).toLocaleString("en-US")}${frac ? `.${frac}` : ""}`;
}

export function afterlifeOf(info, blockHeight, readAt) {
  const pool = BigInt(info?.totals?.pool ?? "0");
  const ops = BigInt(info?.totals?.ops_budget ?? "0");
  const cap = BigInt(info?.config?.pool?.epoch_cap ?? "0");
  const epochMs = Number(info?.config?.pool?.epoch_ms ?? 0);
  const runwayEpochs = cap > 0n ? Number(pool / cap) : null;
  return {
    read_at: readAt, block_height: blockHeight, status: info?.status ?? null,
    pool_yocto: pool.toString(), pool_near: nearStr(pool), ops_budget_yocto: ops.toString(), ops_budget_near: nearStr(ops),
    epoch_cap_yocto: cap.toString(), epoch_cap_near: nearStr(cap), epoch_ms: epochMs,
    runway_epochs: runwayEpochs, runway_ms: runwayEpochs === null ? null : runwayEpochs * epochMs,
  };
}

async function getInfo() {
  const body = { jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "final", account_id: CONTRACT, method_name: "get_info", args_base64: "e30=" } };
  let last;
  for (let attempt = 0; attempt < 4; attempt++) { // public RPCs drop the odd request; retry before failing the step
    try {
      const r = await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
      if (r.result?.result) return { info: JSON.parse(Buffer.from(r.result.result).toString("utf8")), blockHeight: r.result.block_height };
      last = JSON.stringify(r.error ?? r).slice(0, 200);
    } catch (e) { last = String(e); }
    await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
  }
  throw new Error(`get_info on ${CONTRACT} failed: ${last}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!existsSync(PROOF)) { process.stderr.write(`no ${PROOF}: run the judge e2e first\n`); process.exit(2); }
  const proof = JSON.parse(readFileSync(PROOF, "utf8"));
  if (proof.contract && proof.contract !== CONTRACT) { process.stderr.write(`${PROOF} is for ${proof.contract}, not ${CONTRACT}\n`); process.exit(2); }
  const { info, blockHeight } = await getInfo();
  proof.afterlife = afterlifeOf(info, blockHeight, new Date().toISOString());
  const files = { launch: `proof/launch-${NAME}.json`, verify: `proof/verify-${NAME}.json` };
  if (!process.argv.includes("--no-verify")) {
    const v = spawnSync(process.execPath, ["scripts/verify/index.mjs", "--instance", CONTRACT, "--json"], { encoding: "utf8", maxBuffer: 32 << 20 });
    try { JSON.parse(v.stdout); } catch { process.stderr.write(`verify --json did not return JSON (exit ${v.status}); nothing saved\n`); process.exit(1); }
    writeFileSync(files.verify, v.stdout.endsWith("\n") ? v.stdout : `${v.stdout}\n`);
    process.stdout.write(`saved ${files.verify} (verify exit ${v.status})\n`);
  }
  for (const [k, f] of Object.entries(files)) if (!existsSync(f)) process.stdout.write(`note: ${k} file ${f} does not exist yet\n`);
  proof.files = files;
  writeFileSync(PROOF, JSON.stringify(proof, null, 2) + "\n");
  const a = proof.afterlife;
  process.stdout.write(`${PROOF}: pool ${a.pool_near} N, ops ${a.ops_budget_near} N, runway ${a.runway_epochs ?? "n/a"} epochs at ${a.epoch_cap_near} N cap (block ${a.block_height})\n`);
}
