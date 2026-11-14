// Gas-free calls for the e2e run: a holder signs a NEP-366 delegate with its own key, the relayer pays the gas, the licence
// contract sees the holder as predecessor. Same result shape as near.mjs `call` plus { outer_signer, relayed: true }.
import nearApi from "near-api-js";
import { call, ensureKey, connection, explorerTx, NETWORK, rpc, TGAS } from "../lib/near.mjs";
import { relay, signDelegate } from "../lib/metatx.mjs";
import { balance, fmtN, sleep } from "./util.mjs";

export const RELAYER_URL = process.env.RELAYER_URL ?? "https://lastsave-relay.pages.dev";
export const RELAYER_ACCOUNT = process.env.RELAYER_ACCOUNT ?? "relay.lastsave-studio.testnet";

/** Signs a delegate for `signer` (key from the local key store) and returns the base64 string. */
export async function signFor(signer, receiverId, method, args = {}, gas = 100) {
  await ensureKey(signer);
  const kp = await connection().mem.getKey(NETWORK, signer);
  return signDelegate({ senderId: signer, keyPair: kp.toString(), receiverId, actions: [{ methodName: method, args, gas: TGAS(gas) }] });
}

/** Polls the outer transaction (signed by the relayer) until FINAL. */
export async function outcomeOf(hash) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await rpc("tx", { tx_hash: hash, sender_account_id: RELAYER_ACCOUNT, wait_until: "FINAL" });
      if (r?.final_execution_status === "FINAL" || r?.status?.SuccessValue !== undefined || r?.status?.Failure) return r;
    } catch (e) {
      if (!/TIMEOUT|PENDING|UNKNOWN_TRANSACTION|timeout|429|fetch failed/.test(String(e.message))) throw e;
    }
    await sleep(3000);
  }
  throw new Error(`relayed tx ${hash} not final after polling (${explorerTx(hash)})`);
}

/** Relays one function call for `signer`. Throws (with .code from the relayer) when the relayer refuses it. */
export async function relayedCall(signer, contract, method, args = {}, { gas = 100 } = {}) {
  const delegate = await signFor(signer, contract, method, args, gas);
  const { hash } = await relay(RELAYER_URL, delegate);
  const o = await outcomeOf(hash);
  const failure = [o.status, ...o.receipts_outcome.map((r) => r.outcome.status)].find((st) => st?.Failure);
  let value = null;
  try { value = nearApi.providers.getTransactionLastResult(o); } catch { /* no value */ }
  return {
    hash, url: explorerTx(hash), value, failure: failure?.Failure ?? null, logs: o.receipts_outcome.flatMap((r) => r.outcome.logs),
    outer_signer: o.transaction.signer_id, outer_receiver: o.transaction.receiver_id, relayed: true,
  };
}

/** A holder action: gas-free through the relayer when ctx.gasless, otherwise a direct call. */
export const act = (ctx, id, method, args = {}, { gas = 100 } = {}) =>
  ctx.gasless ? relayedCall(id, ctx.contract, method, args, { gas }) : call(id, ctx.contract, method, args, { gas });

/**
 * Asserts a relayed call cost its signer nothing: the outer transaction was signed by the relayer, and the signer's NEAR
 * balance moved by exactly `expectDelta` (0, or a refund for `choose`). `before` is balance(signer) taken before the call.
 */
export async function assertGasless(r, label, res, signer, before, expectDelta = 0n) {
  if (!res.relayed) return r.note(`${label}: not relayed (direct mode), gas-free check skipped`);
  r.check(`${label}: outer transaction signed by the relayer`, res.outer_signer === RELAYER_ACCOUNT, `${res.outer_signer} -> ${res.outer_receiver}`);
  const after = await balance(signer);
  r.check(`${label}: ${signer} paid nothing (balance ${expectDelta === 0n ? "unchanged" : `up exactly ${fmtN(expectDelta)}`})`, after - before === expectDelta, `delta ${fmtN(after - before)}`);
}

const OPS_ATTACH = 20_000_000_000_000_000_000_000n; // 0.02 N, what a budget-paid enclave call takes

/**
 * For an `untilLanded` run: every gas-free attempt went out through the relayer and cost the signer nothing, and the contract's
 * ops budget (not the signer) paid OutLayer. `budgetBefore` is totals.ops_budget before the run, `budgetAfter` after it.
 */
export function assertOpsGasless(r, label, res, signer, budgetBefore, budgetAfter) {
  const rel = res.attempts.filter((a) => a.relayed);
  if (!rel.length) return r.note(`${label}: no gas-free attempt was made (direct mode), ops-budget check skipped`);
  r.check(`${label}: every gas-free attempt was signed by the relayer`, rel.every((a) => a.outer_signer === RELAYER_ACCOUNT), `${rel.length} attempt(s)`);
  r.check(`${label}: ${signer} paid nothing on the gas-free attempts`, rel.every((a) => a.signer_delta === 0n), rel.map((a) => fmtN(a.signer_delta)).join(", "));
  const landed = rel.filter((a) => a.outcome === "conclusive" || a.outcome === "inconclusive").length;
  if (landed) r.check(`${label}: the ops budget paid OutLayer (fell by at least ${fmtN(OPS_ATTACH)} per landed call)`, BigInt(budgetBefore) - BigInt(budgetAfter) >= OPS_ATTACH * BigInt(landed), `${fmtN(BigInt(budgetBefore) - BigInt(budgetAfter))} for ${landed}`);
  else r.note(`${label}: no gas-free attempt got past the contract's own checks`);
}
