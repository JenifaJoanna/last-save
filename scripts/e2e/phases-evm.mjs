// Phase m: a host claim is paid in ETH on Base Sepolia through NEAR Chain Signatures. Real MPC signer, real Base Sepolia.
// Flow: fresh host EVM key -> set_payout_evm (gas-free) -> claim_epoch books an EvmPayout -> sign_evm_payout (gas-free) ->
// wait 120 s -> bump_evm_payout (re-sign, higher fee, same nonce) -> broadcast with scripts/chainsig/relay.mjs -> receipt + balances.
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex } from "@noble/hashes/utils";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { view } from "../lib/near.mjs";
import { basescanAddress, basescanTx, evmRpc, fmtEth, hexInt, parseRawTx } from "../chainsig/evm.mjs";
import { getInfo, untilLanded } from "./outlayer.mjs";
import { ensureHostBots } from "./phases-host.mjs";
import { assertGasless, assertOpsGasless, relayedCall } from "./relayed.mjs";
import { balance, fmtN, log, sleep } from "./util.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KEY_FILE = join(root, "local", "evm", "fanhost.key");
const lower = (s) => String(s).toLowerCase();

/** The host's own EVM key (never printed). A fresh one is generated once; the file is 0600 and local/ is gitignored. */
export function hostEvmAddress() {
  if (!existsSync(KEY_FILE)) {
    mkdirSync(dirname(KEY_FILE), { recursive: true });
    writeFileSync(KEY_FILE, `${bytesToHex(secp256k1.utils.randomPrivateKey())}\n`, { mode: 0o600 });
  }
  const priv = readFileSync(KEY_FILE, "utf8").trim().replace(/^0x/, "");
  return `0x${bytesToHex(keccak_256(secp256k1.getPublicKey(priv, false).slice(1)).slice(12))}`;
}

const payoutOf = async (C, id) => (await view(C, "get_evm_payouts", { from_index: id, limit: 1 }))[0];
const claimsOf = async (C, host) => (await view(C, "get_claims", { from_index: 0, limit: 200 })).filter((c) => c.host_id === host);

/** Relays sign_evm_payout / bump_evm_payout until the payout shows `want` signed versions. MPC runs can fail and retry. */
async function signUntil(ctx, signer, method, id, want) {
  const r = ctx.report;
  for (let i = 1; i <= 5; i++) {
    const budget0 = BigInt((await getInfo(ctx)).totals.ops_budget), bal0 = await balance(signer);
    let res;
    try { res = await relayedCall(signer, ctx.contract, method, { id }, { gas: 300 }); }
    catch (e) { r.note(`${method} #${i}: relayer refused (${e.code ?? e.message})`); await sleep(10_000); continue; }
    r.tx(`${method} #${i} (gas-free)`, res);
    await assertGasless(r, `${method} #${i}`, res, signer, bal0);
    let p;
    for (let k = 0; k < 40; k++) {
      p = await payoutOf(ctx.contract, id);
      if (p.signed_txs.length >= want || (p.status !== "Signing" && k > 2)) break;
      await sleep(4000);
    }
    const budget1 = BigInt((await getInfo(ctx)).totals.ops_budget);
    r.read(`${method} #${i}`, { status: p.status, versions: p.signed_txs.length, last_error: p.last_error, ops_budget_spent: fmtN(budget0 - budget1) });
    if (p.signed_txs.length >= want) return p;
    log(`  ${method} #${i}: not signed yet (${p.status}, ${p.last_error ?? (res.failure ? JSON.stringify(res.failure).slice(0, 80) : "no error")}), retrying`);
    await sleep(8000);
  }
  return payoutOf(ctx.contract, id);
}

function checkSigned(r, label, raw, p, payer) {
  let t;
  try { t = parseRawTx(raw); } catch (e) { return r.check(`${label}: raw tx parses`, false, e.message); }
  r.check(`${label}: ecrecover gives the contract's payer address`, lower(t.from) === lower(payer), `${t.from} vs ${payer}`);
  r.check(`${label}: chain 84532, nonce, recipient and value match the payout record`,
    t.chainId === 84532n && t.nonce === BigInt(p.nonce) && lower(t.to) === lower(p.to) && t.value === BigInt(p.value_wei), `nonce ${t.nonce}, to ${t.to}, value ${t.value}`);
  return t;
}

function broadcast(ctx, id, waitSecs) {
  return new Promise((resolve) => {
    const env = { ...process.env, PATH: process.env.PATH };
    const p = spawn(process.execPath, [join(root, "scripts", "chainsig", "relay.mjs"), ctx.contract, "--id", String(id), "--wait", String(waitSecs)], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => { out += d; }); p.stderr.on("data", (d) => { out += d; });
    p.on("exit", (code) => resolve({ code, out }));
  });
}

export async function evmPayout(ctx) {
  const r = ctx.report, C = ctx.contract, host = ctx.fanhost;
  const info0 = await getInfo(ctx);
  const cfg = info0.config.evm_payout, payer = cfg.address;
  const addr = hostEvmAddress();
  r.read("host_evm_address", addr); r.read("payer_address", payer); r.read("host_evm_key_file", "local/evm/fanhost.key (0600, gitignored, never printed)");
  const [hostEth0, payerEth0] = [hexInt(await evmRpc("eth_getBalance", [addr, "latest"])), hexInt(await evmRpc("eth_getBalance", [payer, "latest"]))];
  r.read("host_eth_before", fmtEth(hostEth0)); r.read("payer_eth_before", fmtEth(payerEth0));
  r.check("the payer address (MPC-derived) holds ETH for the payout", payerEth0 > 0n, `${fmtEth(payerEth0)} ETH ${basescanAddress(payer)}`);

  // 1. set_payout_evm, gas-free
  const hostBal0 = await balance(host);
  const set = await (ctx.gasless ? relayedCall(host, C, "set_payout_evm", { address: addr }, { gas: 30 }) : null);
  if (!set) throw new Error("phase m needs the relayer (do not pass --direct)");
  r.tx("set_payout_evm (gas-free)", set);
  r.check("set_payout_evm accepted", !set.failure, JSON.stringify(set.failure ?? "").slice(0, 120));
  await assertGasless(r, "set_payout_evm", set, host, hostBal0);
  const me = (await view(C, "get_hosts", {})).find((h) => h.host_id === host);
  r.check("host record now holds the EVM address", lower(me?.evm_address) === lower(addr), me?.evm_address ?? "none");
  const bad = await relayedCall(host, C, "set_payout_evm", { address: "0x1234" }, { gas: 30 });
  r.tx("set_payout_evm with a malformed address (must be refused)", bad);
  r.check("a malformed address is refused by the contract", Boolean(bad.failure));

  // 2. a claim in the EVM rail: a completed epoch after every epoch already paid
  const pool = await ensureHostBots(ctx);
  const paidEpochs = (await claimsOf(C, host)).map((c) => c.epoch);
  let rec = null, epoch = null, before = null;
  for (let candidate = paidEpochs.length ? Math.max(...paidEpochs) + 1 : 0, tries = 0; tries < 2 && !rec; candidate++, tries++) {
    log(`  waiting for epoch ${candidate} to complete (bots stay connected to the host)`);
    for (let i = 0; i < 150; i++) {
      const cur = (await getInfo(ctx)).current_epoch;
      if (cur !== null && cur > candidate) break;
      await pool.revive(); await sleep(5000);
    }
    before = await getInfo(ctx);
    const res = await untilLanded(ctx, {
      label: `claim_epoch ${candidate} (EVM rail)`, signer: host, method: "claim_epoch", args: { epoch: candidate }, maxAttempts: 6, fallbackAfter: 1, terminal: /already paid/i,
      verdict: async () => { const c = (await claimsOf(C, host)).find((x) => x.epoch === candidate); return { conclusive: Boolean(c), detail: c ? `paid ${fmtN(c.paid)}, ${c.verified} verified` : "no claim recorded yet" }; },
    });
    r.read(`claim attempts epoch ${candidate}`, res.attempts);
    assertOpsGasless(r, `claim_epoch ${candidate}`, res, host, before.totals.ops_budget, (await getInfo(ctx)).totals.ops_budget);
    rec = (await claimsOf(C, host)).find((x) => x.epoch === candidate) ?? null;
    epoch = candidate;
  }
  r.check("claim_epoch landed for a completed epoch on the EVM rail", Boolean(rec), `epoch ${epoch}`);
  if (!rec) return;
  const after = await getInfo(ctx);
  const p0 = await payoutOf(C, rec.evm_payout);
  r.check("the claim carries an EvmPayout id", Number.isInteger(rec.evm_payout), String(rec.evm_payout));
  r.check("an EvmPayout is Booked for this host and epoch", p0?.status === "Booked" && p0.host_id === host && p0.epoch === epoch, `id ${p0?.id} ${p0?.status}`);
  r.check("the payout goes to the host's EVM address", lower(p0?.to) === lower(addr), p0?.to);
  const per = BigInt(info0.config.pool.pay_per_session), rate = BigInt(cfg.demo_wei_per_session);
  r.check("value_wei is sessions x demo wei per session", BigInt(p0.value_wei) === (BigInt(rec.paid) / per) * rate, `${p0.value_wei} wei for ${rec.verified} verified (${fmtN(rec.paid)} debited)`);
  r.check("near_debited equals the claim's paid amount", BigInt(p0.near_debited) === BigInt(rec.paid), fmtN(p0.near_debited));
  const settled = BigInt(after.totals.evm_settled) - BigInt(before.totals.evm_settled);
  r.check("evm_settled rose by exactly the debited NEAR", settled === BigInt(p0.near_debited), `${fmtN(settled)} vs ${fmtN(p0.near_debited)}`);
  const poolDrop = BigInt(before.totals.pool) - BigInt(after.totals.pool);
  r.check("the pool fell by the debited NEAR plus record storage", poolDrop >= BigInt(p0.near_debited) && poolDrop - BigInt(p0.near_debited) < 10n ** 23n, `${fmtN(poolDrop)} (debit ${fmtN(p0.near_debited)})`);
  r.check("paid_out (the NEAR rail) did not move", after.totals.paid_out === before.totals.paid_out, fmtN(after.totals.paid_out));
  r.read("evm_payout_booked", p0);

  // 3. sign through the MPC signer, gas-free
  const signer = ctx.players[3], id = p0.id;
  const ei = await view(C, "evm_payout_info", {});
  r.check("payer address in evm_payout_info matches the config", lower(ei.address) === lower(payer), ei.address);
  const chainNonce = hexInt(await evmRpc("eth_getTransactionCount", [payer, "latest"]));
  let p = await signUntil(ctx, signer, "sign_evm_payout", id, 1);
  r.check("the payout is Signed by the MPC signer", p.status === "Signed" && p.signed_txs.length === 1, `${p.status}${p.last_error ? `: ${p.last_error}` : ""}`);
  if (p.status !== "Signed") return;
  const t1 = checkSigned(r, "signed tx", p.signed_tx, p, payer);
  r.check("tx_hash stored on chain is keccak(raw)", t1.hash === lower(p.tx_hash), t1.hash);
  r.check("the payout nonce equals the payer's current Base Sepolia nonce", BigInt(p.nonce) === chainNonce, `${p.nonce} vs ${chainNonce}`);
  r.check("max fee per gas is the configured 1 gwei", t1.maxFeePerGas === BigInt(cfg.max_fee_per_gas), String(t1.maxFeePerGas));

  // 4. bump on a payout that has not been broadcast: same nonce, recipient and value, fee x1.25
  let versions = [p];
  if (!ctx.opts.skipBump) {
    const gap = 125_000 - ((await getInfo(ctx)).now_ms - p.last_signed_ms);
    if (gap > 0) { log(`  waiting ${Math.ceil(gap / 1000)} s for the 120 s bump gap`); await sleep(gap); }
    p = await signUntil(ctx, signer, "bump_evm_payout", id, 2);
    r.check("bump_evm_payout re-signed (2 versions on chain)", p.signed_txs.length === 2, `${p.signed_txs.length} versions, ${p.status}`);
    if (p.signed_txs.length === 2) {
      const t2 = checkSigned(r, "bumped tx", p.signed_tx, p, payer);
      r.check("the bump keeps the nonce and raises the fee by x1.25", t2.nonce === t1.nonce && t2.maxFeePerGas === (t1.maxFeePerGas * 125n + 99n) / 100n, `${t1.maxFeePerGas} -> ${t2.maxFeePerGas}`);
      r.check("the two versions are different transactions", t1.hash !== t2.hash);
      r.note("the first version was never broadcast, so the bump re-signed an unconfirmed payout without a mempool race (Base confirms in seconds)");
    }
  } else r.note("bump skipped (--skip-bump)");

  // 5. broadcast the stored raw tx with the public relay script, then read Base Sepolia
  const bc = await broadcast(ctx, id, 120);
  r.read("relay_script_output", bc.out.split("\n").filter(Boolean).slice(-6));
  const newest = parseRawTx(p.signed_tx);
  const rcpt = await evmRpc("eth_getTransactionReceipt", [newest.hash]);
  r.check("relay.mjs broadcast the newest signed tx and it was mined", bc.code === 0 && Boolean(rcpt), bc.out.split("\n").filter((l) => /mined|broadcast|NOT SENT|settled/.test(l)).join(" | ").slice(0, 200));
  if (!rcpt) return;
  r.check("the Base Sepolia receipt is a success", rcpt.status === "0x1", `block ${hexInt(rcpt.blockNumber)}`);
  const link = basescanTx(newest.hash);
  r.read("basescan", link); r.read("tx_hash", newest.hash);
  r.tx("Base Sepolia payout", { hash: newest.hash, url: link, failure: null });
  const stale = p.signed_txs.length > 1 ? await evmRpc("eth_getTransactionReceipt", [parseRawTx(p.signed_txs[0]).hash]) : null;
  if (p.signed_txs.length > 1) r.check("the superseded first version has no receipt (only one tx can land)", stale === null);
  const [hostEth1, payerEth1] = [hexInt(await evmRpc("eth_getBalance", [addr, "latest"])), hexInt(await evmRpc("eth_getBalance", [payer, "latest"]))];
  r.check("the host's EVM balance rose by exactly value_wei", hostEth1 - hostEth0 === BigInt(p.value_wei), `${fmtEth(hostEth1 - hostEth0)} ETH vs ${fmtEth(p.value_wei)} (${basescanAddress(addr)})`);
  // Base is an OP-stack chain: the receipt also carries `l1Fee`, the L1 data fee charged on top of execution gas
  const gasCost = hexInt(rcpt.gasUsed) * hexInt(rcpt.effectiveGasPrice), l1Fee = hexInt(rcpt.l1Fee ?? "0x0");
  r.check("the payer paid value_wei plus execution gas plus the L1 data fee, nothing else", payerEth0 - payerEth1 === BigInt(p.value_wei) + gasCost + l1Fee, `${payerEth0 - payerEth1} wei = ${p.value_wei} + gas ${gasCost} + l1 fee ${l1Fee}`);
  const settledAll = (await view(C, "evm_payout_info", {})).next_nonce;
  r.check("the contract's next_nonce moved past the paid nonce", Number(settledAll) === Number(p.nonce) + 1, String(settledAll));
  r.read("final_payout", await payoutOf(C, id));
}
