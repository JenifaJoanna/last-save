// Chain Signatures payouts: the payer address re-derived from public inputs, and every signed payout checked on Base Sepolia.
import { evmAddress, parseNearKey } from "../chainsig/derive.mjs";
import { CHAIN_ID, parseRawTx } from "../chainsig/evm.mjs";
import { deriveAddress, sameAddress, short } from "./pure.mjs";
import { basescanTx } from "./rpc.mjs";
import { bad, na, ok, warn } from "./checks-chain.mjs";

async function payerAddress(ctx) {
  const cfg = (await ctx.info()).config.evm_payout;
  if (!cfg) return na("v1 pays hosts in NEAR only; Chain Signatures arrived in v2");
  const evm = await ctx.evmInfo();
  const root = await ctx.deps.view(cfg.mpc, "public_key", {}, { finality: "final" });
  const derived = deriveAddress(root, ctx.inst.id, cfg.path);
  const viaSigner = await ctx.deps.view(cfg.mpc, "derived_public_key", { path: cfg.path, predecessor: ctx.inst.id }, { finality: "final" }).then((k) => evmAddress(parseNearKey(k)), () => null);
  const facts = { derived, onChain: evm.address, config: cfg.address, viaSigner, signer: cfg.mpc, path: cfg.path };
  if (evm.derivation_account !== ctx.inst.id) return bad(`contract derives from ${evm.derivation_account}, not itself`, facts);
  if (evm.chain_id !== CHAIN_ID) return bad(`chain id ${evm.chain_id}, expected Base Sepolia ${CHAIN_ID}`, facts);
  if (!sameAddress(derived, evm.address) || !sameAddress(derived, cfg.address)) return bad(`re-derived ${derived} != contract's ${evm.address}`, facts);
  if (viaSigner && !sameAddress(viaSigner, derived)) return bad(`signer's own derived_public_key gives ${viaSigner}`, facts);
  return ok(`${derived} = derive(${cfg.mpc} root key, ${ctx.inst.id}, "${cfg.path}")${viaSigner ? "; the signer contract's own view agrees" : ""}`, facts);
}

/** One payout: the signed tx must be from the payer, on Base Sepolia, to the host, for the booked value; then its receipt. */
export async function checkPayout(p, payer, evmRpc) {
  const raws = [...(p.signed_txs?.length ? p.signed_txs : [p.signed_tx])].filter(Boolean).reverse();
  const hashes = [...new Set([...(p.tx_hashes ?? []), p.tx_hash].filter(Boolean))];
  const r = { id: p.id, host: p.host_id, status: p.status, hashes, link: null, state: "unsigned", problem: null };
  if (!raws.length) return r;
  for (const raw of raws) {
    let t;
    try { t = parseRawTx(raw); } catch (e) { return { ...r, state: "bad", problem: `signed tx unreadable (${e.message})` }; }
    if (!sameAddress(t.from, payer)) return { ...r, state: "bad", problem: `signed tx sender ${t.from} is not the derived payer ${payer}` };
    if (t.chainId !== BigInt(CHAIN_ID)) return { ...r, state: "bad", problem: `signed for chain ${t.chainId}, not ${CHAIN_ID}` };
    if (!sameAddress(t.to, p.to) || t.value !== BigInt(p.value_wei)) return { ...r, state: "bad", problem: "signed tx recipient/value differ from the booked payout" };
  }
  r.state = "signed";
  for (const h of [...hashes].reverse()) {
    const rc = await evmRpc("eth_getTransactionReceipt", [h]).catch(() => undefined);
    if (rc === undefined) { r.state = "unreachable"; continue; }
    if (rc) { r.link = basescanTx(h); r.state = rc.status === "0x1" ? "mined" : "reverted"; r.block = Number(BigInt(rc.blockNumber)); return r; }
  }
  return r;
}

async function payouts(ctx) {
  if (!(await ctx.info()).config.evm_payout) return na("no Chain Signatures payouts on a v1 instance");
  const [list, evm] = await Promise.all([ctx.payouts(), ctx.evmInfo()]);
  if (!list.length) return na("no payout booked yet (a verified host claim books one)");
  const signed = list.filter((p) => p.signed_tx || p.signed_txs?.length);
  const rows = await Promise.all(signed.map((p) => checkPayout(p, evm.address, ctx.deps.evmRpc)));
  const links = rows.filter((r) => r.link).map((r) => ({ id: r.id, url: r.link }));
  const pending = list.length - signed.length;
  const tail = pending ? ` (${pending} booked, not yet signed)` : "";
  if (!signed.length) return warn(`${list.length} payout(s) booked, none signed yet`, { rows });
  const wrong = rows.find((r) => r.state === "bad" || r.state === "reverted");
  if (wrong) return bad(`payout #${wrong.id}: ${wrong.problem ?? "Base Sepolia receipt says reverted"}`, { rows, links });
  const unmined = rows.filter((r) => r.state !== "mined");
  if (unmined.length) return warn(`${rows.length - unmined.length}/${rows.length} signed payouts mined on Base Sepolia; #${unmined.map((r) => r.id).join(", #")} signed on NEAR, not broadcast yet (anyone can: node scripts/chainsig/relay.mjs ${ctx.inst.id})${tail}`, { rows, links });
  return ok(`${rows.length}/${rows.length} signed payouts: sender = derived payer, mined on Base Sepolia with status 1 (${links.map((l) => `#${l.id} ${short(l.url.split("/").pop())}`).join(", ")})${tail}`, { rows, links });
}

export const CHECKS = [
  { id: "chainsig.address", group: "Chain Signatures", label: "Payer address re-derived from public inputs", run: payerAddress },
  { id: "chainsig.payouts", group: "Chain Signatures", label: "Signed payouts mined on Base Sepolia", run: payouts },
];
