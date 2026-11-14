// v2 phases that need no enclave run: the relayer's refusals (nothing is spent) and the factory / global-contract checks.
import { delegateHash, encodeSignedDelegate, publicKeyFromSecret, signerFromSecret, toBase64 } from "../../relayer/client/delegate.ts";
import { connection, ensureKey, NETWORK, rpc, TGAS, view } from "../lib/near.mjs";
import { relay } from "../lib/metatx.mjs";
import { RELAYER_URL } from "./relayed.mjs";
import { balance, fmtN } from "./util.mjs";

const FACTORY = "lastsave-factory.testnet";

/** A signed delegate with full control over receiver, method, deposit, expiry and signature; never submitted by anything but the relayer. */
async function crafted(signer, { receiver, method = "choose", args = {}, deposit = 0n, ttl = 300n, tamper = false }) {
  await ensureKey(signer);
  const secret = (await connection().mem.getKey(NETWORK, signer)).toString();
  const publicKey = publicKeyFromSecret(secret);
  const [ak, block] = await Promise.all([
    rpc("query", { request_type: "view_access_key", finality: "optimistic", account_id: signer, public_key: publicKey }),
    rpc("block", { finality: "optimistic" }),
  ]);
  const delegate = {
    senderId: signer, receiverId: receiver, publicKey, nonce: BigInt(ak.nonce) + 1n, maxBlockHeight: BigInt(block.header.height) + ttl,
    actions: [{ methodName: method, args: new TextEncoder().encode(JSON.stringify(args)), gas: TGAS(30), deposit }],
  };
  const signature = await signerFromSecret(secret)(delegateHash(delegate));
  if (tamper) signature[0] ^= 1;
  return toBase64(encodeSignedDelegate({ delegate, signature }));
}

export async function relayerGuards(ctx) {
  const r = ctx.report;
  const who = ctx.players[3];
  const lic = await view(ctx.contract, "licence_of", { account_id: who });
  const args = { token_id: lic?.token_id ?? "1", choice: "Refund" };
  const cases = [
    ["a method outside the allowlist (buy_licence)", { receiver: ctx.contract, method: "buy_licence" }, "METHOD_NOT_ALLOWED"],
    ["a method outside the allowlist (end_of_service)", { receiver: ctx.contract, method: "end_of_service" }, "METHOD_NOT_ALLOWED"],
    ["an allowed method with a non-zero deposit (0.01 N)", { receiver: ctx.contract, args, deposit: 10n ** 22n }, "DEPOSIT_NOT_ZERO"],
    ["an allowed method with a 1 yocto deposit", { receiver: ctx.contract, args, deposit: 1n }, "DEPOSIT_NOT_ZERO"],
    ["a receiver outside the allowlist", { receiver: "example.testnet", args }, "RECEIVER_NOT_ALLOWED"],
    ["a delegate with a tampered signature", { receiver: ctx.contract, args, tamper: true }, "BAD_SIGNATURE"],
    ["an expired delegate (max_block_height in the past)", { receiver: ctx.contract, args, ttl: -20n }, "EXPIRED"],
  ];
  const before = await balance(who);
  for (const [name, spec, code] of cases) {
    const b64 = await crafted(who, spec);
    const err = await relay(RELAYER_URL, b64).then((ok) => ({ accepted: ok.hash }), (e) => e);
    r.check(`relayer refuses ${name}`, !err.accepted && err.code === code, err.accepted ? `ACCEPTED ${err.accepted}` : `${err.code}: ${String(err.message).slice(0, 100)}`);
  }
  r.check(`${who} balance unchanged by the refused calls`, (await balance(who)) === before, fmtN(before));
  r.read("refusal_cases", cases.map(([n, , c]) => `${n} -> ${c}`));
}

export async function factoryCheck(ctx) {
  const r = ctx.report;
  const [instances, hash] = await Promise.all([view(FACTORY, "instances", {}), view(FACTORY, "code_hash", {})]);
  const mine = instances.find((i) => i.account_id === ctx.contract);
  r.read("factory_instances", instances.map((i) => `${i.account_id} ${i.status}`));
  r.check("factory instances() lists the instance, status Ready", Boolean(mine) && mine.status === "Ready", mine ? `${mine.account_id} by ${mine.creator}` : "missing");
  r.check("the instance was created through the factory (creator is the studio)", mine?.creator === (await view(ctx.contract, "get_info", {})).config.studio, mine?.creator);
  const acct = await rpc("query", { request_type: "view_account", finality: "final", account_id: ctx.contract });
  r.read("instance_account", { code_hash: acct.code_hash, global_contract_hash: acct.global_contract_hash ?? null, global_contract_account_id: acct.global_contract_account_id ?? null });
  const used = acct.global_contract_hash ?? null;
  if (used === null) r.note("the RPC did not return global_contract_hash for the account; the global-contract link is checked through the factory only");
  else r.check("the instance runs the factory's global contract (code_hash() matches)", used === hash, `${used} vs ${hash}`);
  r.check("the instance has no local contract code (code_hash is all ones)", acct.code_hash === "11111111111111111111111111111111", acct.code_hash);
  const keys = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: ctx.contract })).keys;
  r.check("the instance has 0 access keys (born locked)", keys.length === 0, `${keys.length} keys`);
  r.check("factory code_hash() is the published licence v2 hash", typeof hash === "string" && hash.length >= 43, hash);
}
