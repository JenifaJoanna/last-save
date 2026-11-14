#!/usr/bin/env node
// Closes a v2 run report:  node scripts/e2e/finalize-v2.mjs proof/run-v2dev-<UTC>.json
// Restores the evm-payout phase of record if a rerun replaced it, re-checks the payer's cost with the OP-stack L1 data fee
// (the original assertion left it out), and writes final balances. Read-only against the chains.
import { readFileSync } from "node:fs";
import { view } from "../lib/near.mjs";
import { evmRpc, hexInt, fmtEth } from "../chainsig/evm.mjs";
import { Report } from "./report.mjs";
import { balance, fmtN, nowIso } from "./util.mjs";

const file = process.argv[2];
const old = JSON.parse(readFileSync(file, "utf8"));
const r = new Report({ file, meta: {}, append: true });
const d = r.data;
const running = d.phases.findIndex((p) => p.name === "evm-payout" && p.status === "running");
if (running >= 0) {
  const [aborted] = d.phases.splice(running, 1);
  aborted.status = "aborted"; aborted.notes.push("rerun stopped by the operator: epochs 12 and 13 had no verified sessions on the restarted host; the first run's payout #0 already settled");
  (d.aborted_reruns ??= []).push(aborted);
  const i = d.superseded.findLastIndex((p) => p.name === "evm-payout");
  d.phases.push(d.superseded.splice(i, 1)[0]);
}
const C = old.contract;
r.phase("evm-payout-recheck", "payer cost re-checked with the L1 data fee, payout state read back");
const p = (await view(C, "get_evm_payouts", { from_index: 0, limit: 10 }))[0];
const hash = p.tx_hashes[p.tx_hashes.length - 1];
const rc = await evmRpc("eth_getTransactionReceipt", [hash]);
const gas = hexInt(rc.gasUsed) * hexInt(rc.effectiveGasPrice), l1 = hexInt(rc.l1Fee);
r.check("payout #0 is Signed with 2 versions and its newest hash has a successful receipt", p.status === "Signed" && p.signed_txs.length === 2 && rc.status === "0x1", `block ${hexInt(rc.blockNumber)}`);
// the payer was funded with exactly 0.02 ETH and had nonce 0 before this payout (checked before the run)
const now = hexInt(await evmRpc("eth_getBalance", [(await view(C, "evm_payout_info", {})).address, "latest"]));
const spent = BigInt(p.value_wei) + gas + l1;
r.read("payer_cost_breakdown_wei", { value: p.value_wei, execution_gas: gas.toString(), l1_data_fee: l1.toString(), total: spent.toString() });
r.check("payer's funded 0.02 ETH minus its current balance equals value + gas + L1 fee, exactly", 20_000_000_000_000_000n - now === spent, `${fmtEth(20_000_000_000_000_000n - now)} ETH = ${spent} wei`);
r.read("basescan", `https://sepolia.basescan.org/tx/${hash}`);
r.end();
const ids = [...new Set([...old.players, old.fanhost, old.ops, "lastsave-studio.testnet", "relay.lastsave-studio.testnet"])];
d.balances_end = {}; for (const id of ids) d.balances_end[id] = fmtN(await balance(id));
d.finished_at = nowIso();
d.unenforced = ["spend cap is only reported (balances_start/end), not blocked by code"];
r.flush();
process.stdout.write(`${r.totals().passed} passed, ${r.totals().failed} failed\n`);
