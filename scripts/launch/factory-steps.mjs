// v2 launch steps through the studio factory (NEP-591 global contract): publish, factory, instance, verify,
// plus the dry-run plan for every step. Pure helpers (config building, addresses, plans) are unit-tested in
// factory-steps.test.mjs. launch.mjs owns state/record plumbing and passes it in as `ctx`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import nearApi from "near-api-js";
import { NEAR, accountState, call, connection, deploy, ensureKey, rpc, sendActions, view, NETWORK } from "../lib/near.mjs";
import { assertFactoryHash, globalCodeExists, globalDeployCost, hashB58 } from "../lib/near-global.mjs";
import { derivePoint, evmAddress, parseNearKey, SIGNER_DEFAULT } from "../chainsig/derive.mjs";

export const FACTORY_DEFAULT = "lastsave-factory.testnet";
export const EVM_PATH = "lastsave/host-payouts";
export const LICENCE_WASM = "contracts/licence/target/near/lastsave_licence.opt.wasm";
export const FACTORY_WASM = "contracts/factory/target/near/lastsave_factory.opt.wasm";
const GWEI = 1_000_000_000n;
/** Demo defaults the contract validates: priority <= max fee <= cap, cap <= 1000 gwei, gas_limit 21000..100000. */
export const EVM_FEES = { demo_wei_per_session: "10000000000000", max_fee_per_gas: String(GWEI), max_priority_fee_per_gas: String(GWEI / 1000n), max_fee_cap: String(5n * GWEI), gas_limit: 21000 };
export const MIN_DEPOSIT_ESTIMATE = NEAR("0.37"); // measured 0.3652 N for the demo config; used only when the factory is not deployed yet

export const instanceAccount = (name, factory) => `${name}.${factory}`;
/** Same rule as the factory contract's valid_name. */
export const validName = (n) => /^[a-z0-9][a-z0-9_-]{0,30}[a-z0-9]$/.test(n);
export const nearStr = (y) => `${(Number(BigInt(y) / 10n ** 20n) / 1e4).toFixed(4)} NEAR`;

/** The v1 deploy config, field for field (launch.mjs `deploy` uses this too). */
export function baseConfig({ state, studio, platformUrl, officialUrl, liveness, prod }) {
  return {
    studio, outlayer: "outlayer.testnet", title: "Ember Rift", game_id: "ember-rift", media: `${platformUrl}/art/ember-rift-key-960.jpg`,
    price: NEAR("0.25").toString(), fund_bps: 4000, royalty_bps: 1000,
    release: state.release, probe: state.probe, key_commitment: state.key_commitment,
    artifact: { urls: state.artifact.urls, sha256: state.artifact.sha256, build_hash: state.artifact.build_hash, size: state.artifact.size },
    official_endpoint: officialUrl, liveness,
    pool: { epoch_ms: prod ? 7 * 86400_000 : 120_000, pay_per_session: NEAR("0.01").toString(), epoch_cap: NEAR("0.05").toString() },
  };
}

export const evmPayoutConfig = ({ mpc = SIGNER_DEFAULT, path = EVM_PATH, address, startNonce = 0 }) =>
  ({ mpc, path, address: address.toLowerCase(), ...EVM_FEES, start_nonce: startNonce });

export const instanceConfig = (base, evm) => ({ ...base, evm_payout: evmPayoutConfig(evm) });

/** Address the MPC signer holds for `account` + `path`, from the root key alone. Pure. */
export const addressFromRoot = (root, account, path) => evmAddress(derivePoint(root, account, path).point);

/** Derives from the live root key and cross-checks against the signer's own derived_public_key view; throws on mismatch. */
export async function deriveInstanceAddress({ account, path = EVM_PATH, mpc = SIGNER_DEFAULT }) {
  const root = await view(mpc, "public_key", {}, "final");
  const mine = addressFromRoot(root, account, path);
  const onchain = await view(mpc, "derived_public_key", { path, predecessor: account }, "final");
  const theirs = evmAddress(parseNearKey(onchain));
  if (mine !== theirs) throw new Error(`derived address mismatch for ${account}: local ${mine} vs signer view ${theirs}`);
  return { address: mine, root, derived_public_key: onchain };
}

export const globalHash = (wasmPath = process.env.LICENCE_WASM ?? LICENCE_WASM) => hashB58(readFileSync(wasmPath));
const tgasN = (t) => NEAR("0.0001") * BigInt(t); // upper bound: 1 Tgas = 0.0001 NEAR

/** What a step would send and the most NEAR it needs from the studio. Static, no network. */
export function plan(step, c) {
  const wasm = (p) => { try { return readFileSync(p).length; } catch { return 0; } };
  const tx = (to, method, deposit, gas, note = "") => ({ from: c.studio, to, method, deposit: nearStr(deposit), gas_tgas: gas, note, need: deposit + tgasN(gas) });
  const P = {
    bundle: [], mirrors: [], official: [], lock: [],
    publish: [tx(c.studio, "DeployGlobalContract(by code hash)", globalDeployCost(wasm(c.licenceWasm)), 20, "burnt, immutable; run only with PUBLISH=yes")],
    factory: [
      tx("testnet", "create_account", c.factoryN, 30, `creates ${c.factory}`),
      tx(c.factory, "DeployContract + new({owner, licence_code_hash})", 0n, 50, "paid by the factory account's own balance"),
    ],
    instance: [tx(c.factory, "create_instance({name, config})", c.minDeposit + c.opsN, 300, `min_deposit ${nearStr(c.minDeposit)}${c.minEstimated ? " (estimate)" : ""} + ops ${nearStr(c.opsN)}; creates ${c.contract} born locked`)],
    escrow: [tx(c.contract, "escrow_key", NEAR("0.007"), 150, "OutLayer storage cost")],
    attest: [tx(c.contract, "attest", NEAR("0.03"), 300)],
    snapkey: [{ from: c.studio, to: c.studio, method: "AddKey(function call: post_snapshot on the instance)", deposit: nearStr(0n), gas_tgas: 5, need: tgasN(5), note: "0.5 N allowance is a cap, not a spend" }],
    verify: [],
    deploy: [tx(c.contract, "DeployContract + new (v1 path)", 0n, 100, "v1 only")],
  };
  return P[step] ?? [];
}

const runGlobal = (args) => execFileSync(process.execPath, ["scripts/launch/publish-global.mjs", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

export const steps = {
  /** Prints the cost first; sends only with PUBLISH=yes. */
  async publish(c) {
    const dry = JSON.parse(runGlobal(["--wasm", c.licenceWasm, "--publisher", c.studio]));
    process.stdout.write(`publish cost: ${dry.burn_cost} (burnt), studio has ${dry.publisher_balance}, hash ${dry.code_hash_base58}\n`);
    c.state.global_hash = dry.code_hash_base58;
    c.save();
    if (dry.already_published) return c.recordGlobal("publish", { code_hash: dry.code_hash_base58, already_published: true });
    if (process.env.PUBLISH !== "yes") throw new Error(`refusing to publish without PUBLISH=yes (${dry.burn_cost} burnt, code immutable by hash)`);
    if (!dry.enough_funds) throw new Error(`studio has ${dry.publisher_balance}, needs ${dry.burn_cost} + gas`);
    const out = runGlobal(["--wasm", c.licenceWasm, "--publisher", c.studio, "--publish"]);
    const res = JSON.parse(out.slice(out.lastIndexOf('{\n "published"')));
    c.recordGlobal("publish", { code_hash: res.code_hash_base58, tx: res.tx, burn_cost: dry.burn_cost, size_bytes: dry.size_bytes, now_available: res.now_available });
  },

  /** Creates the factory account through the `testnet` registrar, deploys the factory wasm and initialises it with the hash. */
  async factory(c) {
    const hash = c.state.global_hash ?? globalHash(c.licenceWasm);
    if (hash !== globalHash(c.licenceWasm)) throw new Error("published hash differs from the current licence wasm: re-run publish");
    if (!(await globalCodeExists(hash))) throw new Error(`global code ${hash} is not published yet: run publish first`);
    const wasm = readFileSync(c.factoryWasm);
    const rec = { factory: c.factory, wasm_bytes: wasm.length, code_hash: hash };
    if (!(await accountState(c.factory))) {
      const kp = nearApi.KeyPair.fromRandom("ed25519");
      await connection().store.keyStores[1].setKey(NETWORK, c.factory, kp);
      const r = await call(c.studio, "testnet", "create_account", { new_account_id: c.factory, new_public_key: kp.getPublicKey().toString() }, { gas: 30, deposit: c.factoryN });
      if (r.failure) throw new Error(`create_account failed: ${JSON.stringify(r.failure)}`);
      Object.assign(rec, { create_tx: r.url, initial_balance: nearStr(c.factoryN) });
    }
    const d = await deploy(c.factory, wasm, { method: "new", args: { owner: c.studio, licence_code_hash: hash }, gas: 50 });
    await assertFactoryHash(c.factory, hash);
    if (process.env.FACTORY_LOCK === "yes") {
      await ensureKey(c.factory);
      const keys = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: c.factory })).keys;
      await sendActions(c.factory, c.factory, keys.map((k) => nearApi.transactions.deleteKey(nearApi.utils.PublicKey.from(k.public_key))));
      rec.locked = true;
    }
    c.recordGlobal("factory", { ...rec, deploy_tx: d.url });
  },

  /** create_instance on the factory: the studio's one-transaction launch. Config = v1 config + evm_payout; deposit = min + ops. */
  async instance(c) {
    if (!validName(c.name)) throw new Error(`NAME must be 2-32 chars of a-z 0-9 - _ (got ${c.name})`);
    const hash = globalHash(c.licenceWasm);
    const { address } = await deriveInstanceAddress({ account: c.contract });
    const config = instanceConfig(c.config(), { address, startNonce: Number(process.env.START_NONCE ?? 0) });
    const min = BigInt(await view(c.factory, "min_deposit", { config }));
    const r = await call(c.studio, c.factory, "create_instance", { name: c.name, config }, { gas: 300, deposit: min + c.opsN });
    if (r.failure) throw new Error(`create_instance failed: ${JSON.stringify(r.failure)} ${r.url}`);
    const mine = (await view(c.factory, "instances", { from_index: 0, limit: 100 })).find((i) => i.account_id === c.contract);
    if (mine?.status !== "Ready") throw new Error(`instance ${c.contract} is ${mine?.status ?? "missing"} (init rejected the config?): ${r.url}`);
    await assertFactoryHash(c.factory, hash);
    c.state.evm_address = address;
    c.save();
    c.record("instance", { hash: r.hash, url: r.url, instance: c.contract, factory: c.factory, code_hash: hash, deposit: nearStr(min + c.opsN), min_deposit: nearStr(min), evm_address: address, path: EVM_PATH });
  },

  /** Born locked, running the published global code, state sane. One-line summary; throws on any mismatch. */
  async verify(c) {
    const hash = globalHash(c.licenceWasm);
    const keys = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: c.contract })).keys.length;
    const acc = await rpc("query", { request_type: "view_account", finality: "final", account_id: c.contract });
    const info = await view(c.contract, "get_info");
    const evm = await view(c.contract, "evm_payout_info");
    const problems = [];
    if (keys !== 0) problems.push(`${keys} access keys`);
    if (acc.global_contract_hash !== hash) problems.push(`code ${acc.global_contract_hash} != ${hash}`);
    if (info.config?.game_id !== "ember-rift" || !info.status) problems.push("get_info not sane");
    if (!evm || evm.derivation_account !== c.contract || evm.chain_id !== 84532) problems.push("evm_payout_info wrong");
    const line = `${c.contract} keys=${keys} code=${acc.global_contract_hash} ${problems.length ? "MISMATCH" : "ok"} status=${info.status} evm=${evm?.address} ops=${nearStr(info.totals.ops_budget)} escrowed=${info.escrowed} verified=${info.escrow_verified}`;
    c.record("verify", { summary: line, problems });
    if (problems.length) throw new Error(`verify failed: ${problems.join("; ")}`);
  },
};
