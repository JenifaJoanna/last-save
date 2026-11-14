// Chain-state checks: code identity, locked account, factory, escrow, bookkeeping. Each returns { status, reason, ...evidence }.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fmtNear, normHash, sameHash, sanityTotals, sha256Hex, short } from "./pure.mjs";

export const ok = (reason, extra = {}) => ({ status: "pass", reason, ...extra });
export const bad = (reason, extra = {}) => ({ status: "fail", reason, ...extra });
export const na = (reason, extra = {}) => ({ status: "na", reason, ...extra });
export const warn = (reason, extra = {}) => ({ status: "warn", reason, ...extra });
const NO_CODE = "11111111111111111111111111111111";

function publishedPin(ctx) {
  const f = join(ctx.root, "proof/launch-factory.json");
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, "utf8")).steps?.find((s) => s.step === "publish")?.code_hash ?? null; } catch { return null; }
}

async function codeHash(ctx) {
  const { inst } = ctx;
  const acct = await ctx.account();
  if (inst.kind === "factory") {
    const [factoryHash, proofPin] = [await ctx.factoryCodeHash(), publishedPin(ctx)];
    const onAcct = acct.global_contract_hash;
    if (acct.global_contract_account_id) return bad(`uses mutable global code of account ${acct.global_contract_account_id}, not an immutable hash`);
    if (!onAcct) return bad("account has no global contract hash");
    const parts = { onAccount: onAcct, pinned: inst.globalCodeHash, factory: factoryHash, publishProof: proofPin };
    if (!sameHash(onAcct, inst.globalCodeHash)) return bad(`account runs ${short(onAcct)}, published hash is ${short(inst.globalCodeHash)}`, parts);
    if (!sameHash(factoryHash, inst.globalCodeHash)) return bad(`factory.code_hash() is ${short(factoryHash)}, not the published ${short(inst.globalCodeHash)}`, parts);
    if (proofPin && !sameHash(proofPin, inst.globalCodeHash)) return bad(`pin ${short(inst.globalCodeHash)} differs from proof/launch-factory.json ${short(proofPin)}`, parts);
    if (acct.code_hash !== NO_CODE) return bad("account also carries its own code", parts);
    return ok(`global code ${short(onAcct)} = published hash = factory.code_hash(); no local code`, parts);
  }
  const onChain = normHash(acct.code_hash);
  if (!inst.codeSha256) return warn(`no pinned hash for ${inst.id}; on-chain code sha256 is ${onChain}`, { onChain });
  if (onChain !== inst.codeSha256) return bad(`on-chain code ${short(onChain)} != pinned ${short(inst.codeSha256)}`, { onChain });
  const deploy = ctx.launchStep("deploy");
  let note = "no deploy tx in the manifests";
  if (deploy) {
    try {
      const tx = await ctx.deps.txLookup(deploy.hash, inst.id);
      const action = tx.transaction.actions.find((a) => a.DeployContract)?.DeployContract?.code;
      const txHash = action && Buffer.from(action, "base64").length === 32 ? Buffer.from(action, "base64").toString("hex") : action ? sha256Hex(Buffer.from(action, "base64")) : null;
      note = txHash === onChain ? `= deploy tx ${short(deploy.hash)}` : `deploy tx ${short(deploy.hash)} DOES NOT match (${short(txHash ?? "none")})`;
      if (txHash !== onChain) return bad(`on-chain ${short(onChain)} ${note}`, { onChain, deployTx: deploy.hash });
    } catch (e) { note = `deploy tx not re-read (${String(e.message).slice(0, 50)})`; }
  }
  return ok(`code sha256 ${short(onChain)} = pinned (proof/launch manifest) ${note}`, { onChain });
}

async function globalBytes(ctx) {
  if (ctx.inst.kind !== "factory") return na("v1 deploys its own code; there is no global contract");
  const r = await ctx.deps.nearRpc("query", { request_type: "view_global_contract_code", finality: "final", code_hash: ctx.inst.globalCodeHash });
  const bytes = Buffer.from(r.code_base64, "base64");
  const h = sha256Hex(bytes);
  return sameHash(h, ctx.inst.globalCodeHash)
    ? ok(`anyone can read the code: ${bytes.length.toLocaleString("en")} B, sha256 ${short(h)} = its hash (immutable, by hash)`, { bytes: bytes.length, sha256: h })
    : bad(`global code of ${short(ctx.inst.globalCodeHash)} hashes to ${short(h)}`, { sha256: h });
}

async function keysNone(ctx) {
  const keys = await ctx.keys();
  return keys.length === 0
    ? ok("0 access keys: nobody can redeploy, drain or delete the contract")
    : bad(`${keys.length} access key(s) (${keys.map((k) => k.access_key.permission === "FullAccess" ? "full-access" : "function-call").join(", ")})`, { keys: keys.length });
}

async function factoryHash(ctx) {
  if (ctx.inst.kind !== "factory") return na("v1 was deployed directly, not by the factory");
  const h = await ctx.factoryCodeHash();
  return sameHash(h, ctx.inst.globalCodeHash) ? ok(`${ctx.inst.factory} code_hash() = ${short(h)} = the published global hash`) : bad(`factory code_hash() ${short(h)} != ${short(ctx.inst.globalCodeHash)}`);
}

async function factoryListed(ctx) {
  if (ctx.inst.kind !== "factory") return na("not a factory instance");
  const row = (await ctx.factoryInstances()).find((i) => i.account_id === ctx.inst.id);
  return row ? ok(`listed in ${ctx.inst.factory}.instances(): created by ${row.creator}, status ${row.status}`, { row }) : bad(`${ctx.inst.id} is not in ${ctx.inst.factory}.instances()`);
}

async function escrowVerified(ctx) {
  const i = await ctx.info();
  if (!i.escrowed) return bad("the server key is not escrowed");
  if (!i.escrow_verified) return bad("escrowed but attest() has not verified it (key, artifact and build hash)");
  return ok(`escrowed; attest() verified key commitment, artifact hash and build hash in the enclave (${new Date(i.attested_at_ms).toISOString().slice(0, 16).replace("T", " ")} UTC)`);
}

async function escrowRule(ctx) {
  const step = ctx.launchStep("escrow");
  if (!step) return na("no escrow tx in the proof manifests");
  const info = await ctx.info();
  const tx = await ctx.deps.txLookup(step.hash, ctx.inst.studio, { full: true });
  const call = (tx.receipts ?? []).map((r) => r.receipt?.Action?.actions?.[0]?.FunctionCall).find((f) => f?.method_name === "store_secrets");
  if (!call) return bad(`tx ${short(step.hash)} has no store_secrets call to the keystore`);
  const a = JSON.parse(Buffer.from(call.args, "base64").toString());
  const want = info.config.release.sha256;
  const conds = a.access?.Logic?.conditions ?? [];
  const pred = conds.find((c) => c.Predecessor)?.Predecessor?.condition?.Whitelist?.accounts;
  const wasm = conds.find((c) => c.WasmHash)?.WasmHash?.hash;
  const good = a.accessor?.WasmHash?.hash === want && a.access?.Logic?.operator === "And" && conds.length === 2 && wasm === want && pred?.length === 1 && pred[0] === ctx.inst.id && a.vault_id === null && a.profile === "escrow";
  return good
    ? ok(`keystore rule in tx ${short(step.hash)}: key opens only for caller = ${ctx.inst.id} AND code = release.wasm ${short(want)}`, { tx: step.hash })
    : bad(`escrow rule in tx ${short(step.hash)} is not "predecessor = instance AND WasmHash = release.wasm"`, { tx: step.hash, rule: a.access });
}

async function totalsSane(ctx) {
  const [info, acct] = await Promise.all([ctx.info(), ctx.account()]);
  const s = sanityTotals(info.totals, acct);
  const b = Object.entries(s.buckets).map(([k, v]) => `${k.replace("_", " ")} ${fmtNear(v)}`).join(", ");
  return s.ok ? ok(`no negative bucket; spendable ${fmtNear(s.spendable)} covers tracked ${fmtNear(s.owed)} (${b})`) : bad(s.problems.join("; "));
}

export const CHECKS = [
  { id: "code.hash", group: "Code", label: "Contract code is the published code", run: codeHash },
  { id: "code.global_bytes", group: "Code", label: "Published global code is readable and hashes to its id", run: globalBytes },
  { id: "keys.none", group: "Code", label: "0 access keys on the instance (locked)", run: keysNone },
  { id: "factory.hash", group: "Factory", label: "Factory points at the same global hash", run: factoryHash },
  { id: "factory.listed", group: "Factory", label: "Instance listed by the factory", run: factoryListed },
  { id: "escrow.verified", group: "Escrow", label: "Escrow attested by the enclave", run: escrowVerified },
  { id: "escrow.rule", group: "Escrow", label: "Keystore access rule is exactly release.wasm + this contract", run: escrowRule },
  { id: "totals.sane", group: "Money", label: "Buckets non-negative and covered by the balance", run: totalsSane },
];
