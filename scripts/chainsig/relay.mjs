#!/usr/bin/env node
// Broadcasts the Base Sepolia payouts a licence contract has signed through chain signatures. Anyone can run this:
// the signatures are already on NEAR, this only carries the raw transactions to Base Sepolia.
//   node scripts/chainsig/relay.mjs <licence contract> [--id N] [--dry-run] [--wait 90]
//   (offline test: --payouts-file <json array in the get_evm_payouts shape> [--address 0x..] replaces the NEAR reads)
//   node scripts/chainsig/relay.mjs <licence contract> --bump-stuck [--blocks 20]     (never broadcasts; prints the NEAR call to re-sign)
//
// Per Signed payout (ascending nonce): try the newest signed tx first; a receipt for any signed version means settled;
// "nonce too low" / "already known" are reported as settled / pending, not as failures.
// Each raw tx is checked before it is sent: sender = the contract's derived address, nonce/to/value = the payout record, chain 84532.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { view } from "../lib/near.mjs";
import { basescanTx, evmRpc, fmtEth, hexInt, parseRawTx } from "./evm.mjs";

const args = process.argv.slice(2);
const flag = (k) => args.includes(`--${k}`);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const contract = args.find((a, i) => !a.startsWith("--") && !String(args[i - 1] ?? "").startsWith("--")) ?? opt("contract");
const out = (s) => process.stdout.write(`${s}\n`);
if (!contract) { process.stderr.write("usage: relay.mjs <licence contract> [--id N] [--dry-run] [--wait secs] [--bump-stuck [--blocks N]]\n"); process.exit(2); }

const stateFile = join("local", "chainsig", `state-${contract}.json`);
const state = (() => { try { return JSON.parse(readFileSync(stateFile, "utf8")); } catch { return { observed: {} }; } })();
const save = () => { mkdirSync(join("local", "chainsig"), { recursive: true }); writeFileSync(stateFile, JSON.stringify(state, null, 1)); };

async function allPayouts() {
  if (opt("payouts-file")) return JSON.parse(readFileSync(opt("payouts-file"), "utf8")); // offline testing: same shape as the view
  const rows = [];
  for (let from = 0; ; from += 50) {
    const page = await view(contract, "get_evm_payouts", { from_index: from, limit: 50 }, "final");
    rows.push(...page);
    if (page.length < 50) return rows;
  }
}

/** Signed versions of a payout, newest first. Accepts `signed_txs` (history, oldest first) or the single `signed_tx`. */
function versions(p) {
  const hist = (p.signed_txs ?? []).map((v) => (typeof v === "string" ? v : v.raw ?? v.signed_tx)).filter(Boolean);
  const list = hist.length ? hist : [p.signed_tx].filter(Boolean);
  return [...new Set(list)].reverse();
}

async function receipt(hash) { return evmRpc("eth_getTransactionReceipt", [hash]); }
async function waitReceipt(hash, secs) {
  for (let t = 0; t <= secs; t += 3) {
    const r = await receipt(hash);
    if (r) return r;
    await new Promise((res) => setTimeout(res, 3000));
  }
  return null;
}
const mined = (r) => `mined in block ${hexInt(r.blockNumber)} (${r.status === "0x1" ? "success" : "REVERTED"}) ${basescanTx(r.transactionHash)}`;

async function handle(p, info, head) {
  const tag = `payout #${p.id} (host ${p.host_id}, epoch ${p.epoch}, ${fmtEth(p.value_wei)} ETH, nonce ${p.nonce})`;
  const parsed = [];
  for (const raw of versions(p)) {
    try {
      const t = parseRawTx(raw);
      const bad = [t.chainId !== 84532n && "chain", t.nonce !== BigInt(p.nonce) && "nonce", t.to?.toLowerCase() !== p.to.toLowerCase() && "to",
        t.value !== BigInt(p.value_wei) && "value", info?.address && t.from.toLowerCase() !== info.address.toLowerCase() && "sender"].filter(Boolean);
      if (bad.length) { out(`${tag}: REFUSED a signed tx whose ${bad.join(", ")} differs from the record`); continue; }
      parsed.push({ raw, t });
    } catch (e) { out(`${tag}: skipped an unreadable signed tx (${e.message})`); }
  }
  if (!parsed.length) return out(`${tag}: no usable signed tx`);

  for (const { t } of parsed) {
    const r = await receipt(t.hash);
    if (r) return out(`${tag}: settled, ${mined(r)}`);
  }
  const newest = parsed[0];
  const fee = newest.t.maxFeePerGas;

  if (flag("bump-stuck")) {
    state.observed[p.id] ??= Number(head);
    const age = Number(head) - state.observed[p.id];
    const gasPrice = hexInt(await evmRpc("eth_gasPrice"));
    const stuck = age >= Number(opt("blocks", 20));
    out(`${tag}: not mined, first observed ${age} blocks ago, signed max fee ${fee} wei vs network gas price ${gasPrice} wei${stuck ? " -> STUCK" : ""}`);
    if (stuck) {
      out(`  re-sign with a higher fee (same nonce, to and value):`);
      out(`  near call ${contract} bump_evm_payout '{"id":${p.id}}' --accountId <any account> --gas 300000000000000 --networkId testnet`);
      out(`  (or relay it gasless: sign a delegate for method bump_evm_payout), then run relay.mjs again`);
    }
    return save();
  }

  if (flag("dry-run")) return out(`${tag}: would broadcast ${newest.t.hash} (${parsed.length} signed version${parsed.length > 1 ? "s" : ""})`);
  try {
    const hash = await evmRpc("eth_sendRawTransaction", [newest.raw]);
    out(`${tag}: broadcast ${hash}`);
  } catch (e) {
    const m = String(e.evm?.message ?? e.message);
    if (/already known|known transaction|already imported|ALREADY_EXISTS/i.test(m)) out(`${tag}: already in the mempool (pending), ${basescanTx(newest.t.hash)}`);
    else if (/underpriced/i.test(m)) out(`${tag}: a competing version is pending at a higher or equal fee (pending): ${m}`);
    else if (/nonce too low/i.test(m)) {
      out(`${tag}: nonce ${p.nonce} is already used on Base Sepolia (settled or replaced by another signed version)`);
      for (const { t } of parsed) { const r = await receipt(t.hash); if (r) return out(`  ${mined(r)}`); }
      return out(`  none of the ${parsed.length} known signed versions has a receipt; check ${`https://sepolia.basescan.org/address/${newest.t.from}`}`);
    } else if (/insufficient funds/i.test(m)) return out(`${tag}: NOT SENT, the contract's address has too little ETH (${m}). Fund ${newest.t.from} and rerun.`);
    else return out(`${tag}: NOT SENT, ${m}`);
  }
  state.observed[p.id] ??= Number(head);
  const r = await waitReceipt(newest.t.hash, Number(opt("wait", 90)));
  out(r ? `  ${mined(r)}` : `  not mined within ${opt("wait", 90)}s; rerun later or use --bump-stuck`);
  save();
}

const info = opt("payouts-file") ? (opt("address") ? { address: opt("address") } : null) : await view(contract, "evm_payout_info", {}, "final").catch(() => null);
if (info) out(`contract ${contract}  EVM address ${info.address}${info.next_nonce !== undefined ? `  next nonce ${info.next_nonce}  chain ${info.chain_id}` : ""}`);
const head = hexInt(await evmRpc("eth_blockNumber"));
const only = opt("id");
const payouts = (await allPayouts()).filter((p) => (only === undefined || String(p.id) === only)).sort((a, b) => Number(a.nonce) - Number(b.nonce));
const todo = payouts.filter((p) => p.status === "Signed");
out(`${payouts.length} payouts: ${payouts.filter((p) => p.status === "Owed").length} owed, ${payouts.filter((p) => p.status === "Signing").length} signing, ${todo.length} signed. Base Sepolia head ${head}.`);
for (const p of todo) await handle(p, info, head);
