// node --test scripts/launch/factory-steps.test.mjs
// Pure parts of the v2 launch: the instance config (v1 config + evm_payout), the derived payer address, names, plans.
// The same config JSON (fixtures/instance-config.json, written with WRITE_FIXTURE=1) is created through the factory in
// contracts/sandbox-tests/tests/factory.rs, so a config the licence would reject fails there, not on testnet.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import test from "node:test";
import { NEAR } from "../lib/near.mjs";
import { EVM_FEES, EVM_PATH, addressFromRoot, baseConfig, evmPayoutConfig, instanceAccount, instanceConfig, nearStr, plan, validName } from "./factory-steps.mjs";

// v1.signer-prod.testnet root public key (domain 0), split so the secret scanner does not mistake it for a private key
const ROOT = ["secp256k1", "4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3"].join(":");
const h = (c) => c.repeat(64);
const state = {
  release: { sha256: h("a"), urls: ["https://raw.githubusercontent.com/JenifaJoanna/last-save/main/artifacts/lastsave-release-aaaa.wasm", "https://last-save.pages.dev/mirror/lastsave-release-aaaa.wasm"] },
  probe: { sha256: h("b"), urls: ["https://raw.githubusercontent.com/JenifaJoanna/last-save/main/artifacts/lastsave-probe-bbbb.wasm"] },
  key_commitment: h("e"),
  artifact: { urls: ["https://raw.githubusercontent.com/JenifaJoanna/last-save/main/artifacts/ember-rift-cccc.bin"], sha256: h("c"), build_hash: h("d"), size: 123456 },
};
const liveness = { probe_interval_ms: 20_000, fail_threshold: 3, receipt_window_ms: 180_000, report_window_ms: 120_000, quorum_bps: 5000 };
const base = () => baseConfig({ state, studio: "lastsave-studio.testnet", platformUrl: "https://last-save.pages.dev", officialUrl: "https://emberrift.pages.dev", liveness, prod: false });
const V2DEV_ADDRESS = "0xfe8a6a6a417e3ccc4d73191c62361207dfe01aea";

test("the derived payer address matches the independently verified vector (chainsig.js, signer view)", () => {
  assert.equal(addressFromRoot(ROOT, "lastsave-v2.testnet", EVM_PATH).toLowerCase(), "0x2d498deab81711645a2da04efed61d3fc9a8e805");
  assert.equal(addressFromRoot(ROOT, instanceAccount("v2dev", "lastsave-factory.testnet"), EVM_PATH).toLowerCase(), V2DEV_ADDRESS);
});

test("an instance's address depends on the instance account, so two instances never share a payer", () => {
  const a = addressFromRoot(ROOT, instanceAccount("v2dev", "lastsave-factory.testnet"), EVM_PATH);
  const b = addressFromRoot(ROOT, instanceAccount("ember-rift", "lastsave-factory.testnet"), EVM_PATH);
  assert.notEqual(a, b);
});

test("base config is the v1 deploy config, field for field", () => {
  const c = base();
  assert.deepEqual(Object.keys(c), ["studio", "outlayer", "title", "game_id", "media", "price", "fund_bps", "royalty_bps", "release", "probe", "key_commitment", "artifact", "official_endpoint", "liveness", "pool"]);
  assert.equal(c.price, NEAR("0.25").toString());
  assert.deepEqual(c.pool, { epoch_ms: 120_000, pay_per_session: NEAR("0.01").toString(), epoch_cap: NEAR("0.05").toString() });
  assert.equal(c.outlayer, "outlayer.testnet");
});

test("instance config adds evm_payout with the demo rate and fees, inside the contract's bounds", () => {
  const c = instanceConfig(base(), { address: V2DEV_ADDRESS.toUpperCase().replace("0X", "0x") });
  assert.deepEqual(c.evm_payout, {
    mpc: "v1.signer-prod.testnet", path: "lastsave/host-payouts", address: V2DEV_ADDRESS,
    demo_wei_per_session: "10000000000000", max_fee_per_gas: "1000000000", max_priority_fee_per_gas: "1000000", max_fee_cap: "5000000000", gas_limit: 21000, start_nonce: 0,
  });
  const e = evmPayoutConfig({ address: V2DEV_ADDRESS });
  assert.ok(BigInt(e.max_priority_fee_per_gas) > 0n && BigInt(e.max_priority_fee_per_gas) <= BigInt(e.max_fee_per_gas) && BigInt(e.max_fee_per_gas) <= BigInt(e.max_fee_cap));
  assert.ok(BigInt(e.max_fee_cap) <= 1_000_000_000_000n && BigInt(e.demo_wei_per_session) <= 10n ** 18n && e.gas_limit >= 21000 && e.gas_limit <= 100000);
  assert.match(c.evm_payout.address, /^0x[0-9a-f]{40}$/);
  assert.equal(EVM_FEES.gas_limit, 21000);
  // the base config is untouched
  assert.equal("evm_payout" in base(), false);
});

test("config JSON is the fixture the sandbox factory test creates an instance from", () => {
  const json = JSON.stringify(instanceConfig(base(), { address: V2DEV_ADDRESS }), null, 1) + "\n";
  const file = new URL("./fixtures/instance-config.json", import.meta.url);
  if (process.env.WRITE_FIXTURE === "1") writeFileSync(file, json);
  assert.equal(readFileSync(file, "utf8"), json, "fixture is stale: WRITE_FIXTURE=1 node --test scripts/launch/factory-steps.test.mjs");
});

test("instance names follow the factory's rule", () => {
  for (const ok of ["v2dev", "ember-rift", "ab", "a_b-c9", "x".repeat(32)]) assert.ok(validName(ok), ok);
  for (const bad of ["a", "Ember", "em.ber", "-ember", "ember-", "em ber", "", "x".repeat(33)]) assert.ok(!validName(bad), bad);
  assert.equal(instanceAccount("ember-rift", "lastsave-factory.testnet"), "ember-rift.lastsave-factory.testnet");
});

test("the instance plan is one tx funded with min deposit plus ops; the total adds up", () => {
  const c = { studio: "s.testnet", factory: "f.testnet", contract: "x.f.testnet", factoryN: NEAR("2.5"), opsN: NEAR("1.5"), minDeposit: NEAR("0.37"), minEstimated: true, licenceWasm: "none", factoryWasm: "none" };
  const [t] = plan("instance", c);
  assert.equal(t.deposit, nearStr(NEAR("1.87")));
  assert.equal(t.method.startsWith("create_instance"), true);
  assert.equal(plan("verify", c).length, 0);
  assert.equal(plan("factory", c).map((x) => x.to).join(), "testnet,f.testnet");
});
