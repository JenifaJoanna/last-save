// The MAP: every run-specific value the film prints, with its source file and extractor. Used by facts.mjs.
// ---- CONFIG: the ONLY place proof file names live (paths are relative to the repo root) ----
export const CONFIG = {
  judge: {
    instance: "ember-rift.lastsave-factory.testnet",
    run: "proof/judge-v2.json",
    // read from run.files.launch / run.files.verify when present; these are the fallbacks
    launch: ["proof/launch-ember-rift.json"],
    verify: "proof/verify-ember-rift.json",
    buyer: "lastsave-dario.testnet", // the store take's buyer on the judge run (licence #2, bought on camera)
  },
  dev: {
    instance: "v2dev.lastsave-factory.testnet",
    run: "proof/run-v2dev-20261114T0857Z.json",
    // first file wins per step: v2dev has the instance, v2walrus has the CI build, Rekor and Walrus steps v2dev predates
    launch: ["proof/launch-v2dev.json", "proof/launch-v2walrus.json"],
    verify: "proof/verify-v2dev.json", // `pnpm -s verify --instance v2dev --json`
    verifyAll: "proof/verify-all.json", // optional: `pnpm -s verify --all --json` (an array); S16 then shows all instances
    extra: "proof/v2dev-extra.json", // values the proof files lack, read from the chain: releasedKey (get_info), archiveItem
    buyer: "lastsave-yuna.testnet",
  },
  studio2: "proof/launch-tidebreak.json", // the second studio's instance (S07)
};

/** Two sets: "judge" (ember-rift; S01-S09, S11) -> run-facts.json, "after" (v2dev's real afterlife; S10, S12-S16) ->
 * run-facts-after.json. A key outside a set's list is still written when readable, and is never reported missing. */
export const SET_KEYS = {
  judge: ["studio2Account", "price", "fundPct", "lockedShare", "licenceNo", "buyTx", "accessKeys", "buildSha", "releaseWasm", "officialWorker", "cdnUrl", "poolBefore", "postBuyDelta", "poolTotal", "refundedNear", "refundedCount", "pledgedNear", "pledgedCount"], // exactly what S01-S11 print; runwayEpochs, epochCap and epochLen are read when present, never required
  after: ["releasedSha", "releasedKey", "archiveItem", "hostPaid", "sessionsVerified", "payoutEpoch", "payoutSessions", "payoutNear", "payoutNonce", "payoutValue", "payoutTo", "payoutToShort", "payoutPayer", "basePayoutTx", "basePayoutBlock", "baseStatus", "verifyInstance", "verifyInstances", "verifyHead", "verifySummary", "verifyCodeWhy", "verifyMarks"],
};
const BOTH = ["instance", "walrusBlob", "walrusHost", "workflow", "commit7", "rekorIndex", "rekorLogged"];
/** Is this key required in that set? */
export const required = (key, set) => BOTH.includes(key) || SET_KEYS[set].includes(key);

// ---- helpers ----
const bad = (msg) => { throw new Error(msg); };
const need = (v, what) => (v === undefined || v === null || v === "" ? bad(`not found: ${what}`) : v);
/** yoctoNEAR (string) to a decimal string with `dec` decimals (rounded), or trimmed of trailing zeros when dec is null. */
export function yN(y, dec = null, unit = 24) {
  const big = BigInt(need(y, "amount")), base = 10n ** BigInt(unit);
  if (dec === null) {
    const frac = (big % base).toString().padStart(unit, "0").replace(/0+$/, "");
    return `${big / base}${frac ? "." + frac : ""}`;
  }
  const scaled = (big * 10n ** BigInt(dec) + base / 2n) / base;
  const s = scaled.toString().padStart(dec + 1, "0");
  return dec ? `${s.slice(0, -dec)}.${s.slice(-dec)}` : s;
}
const fix = (decimalString, dec) => Number(decimalString).toFixed(dec);
export const phase = (run, name) => need([...run.phases].reverse().find((p) => p.name === name), `phase "${name}"`);
export const assertion = (run, ph, re) => {
  const a = need(phase(run, ph).assertions.find((x) => re.test(x.name)), `assertion ${re} in phase "${ph}"`);
  if (!a.pass) bad(`assertion did not pass: "${a.name}" in phase "${ph}"`);
  return a;
};
export const tx = (run, ph, label) => need(phase(run, ph).txs.find((t) => t.label === label), `tx "${label}" in phase "${ph}"`);
/** Last launch step of that name without an error/failure, from the first launch file that has one. */
export const step = (S, name) => {
  for (const file of S.launch) {
    const hit = [...file.steps].reverse().find((s) => s.step === name && !s.error && !s.failure);
    if (hit) return hit;
  }
  return bad(`no clean "${name}" step in the launch files`);
};
const ver = (S, id) => need(S.verify.results.find((r) => r.id === id), `verify result "${id}"`);
/** The `pnpm verify` count line (scripts/verify/render.mjs format). */
const summaryLine = (n, ms) => `${n.pass} ✓   ${n.fail} ✗   ${n.warn} !   ${n.na} n/a   ·  ${(ms / 1000).toFixed(1)} s`;
const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-6)}`;
const utcMinute = (iso) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
const poolAfter = (S) => /^([\d.]+) N ->/.exec(assertion(S.run, "claim", /^pool decreased/).detail)?.[1] ?? bad("pool decreased detail has no 'x N ->'");
const payout = (S) => need(phase(S.run, "evm-payout").readback.final_payout, "evm-payout readback.final_payout");
const cfg = (S) => need(phase(S.run, "preflight").readback.config, "preflight readback.config");

/** Each row: key, src (which input), at (where in it, for the table), get(S, mode). */
export const MAP = [
  { key: "instance", src: "run", at: "contract", get: (S) => S.run.contract },
  { key: "studio2Account", src: "studio2", at: "steps[instance].instance | contract", get: (S) => S.studio2.steps.find((s) => s.step === "instance" && s.instance)?.instance ?? S.studio2.contract },
  { key: "price", src: "run", at: "preflight.config.price", get: (S) => yN(cfg(S).price) },
  { key: "fundPct", src: "run", at: "preflight.config.fund_bps / 100", get: (S) => cfg(S).fund_bps / 100 },
  { key: "lockedShare", src: "run", at: "buy.readback[licence <buyer>].pot_share", get: (S) => yN(phase(S.run, "buy").readback[`licence ${S.run.takes?.store?.buyer ?? S.buyer}`]?.pot_share) },
  // the store take's own buy: run.takes.store when the run records it (the judge run's on-camera buy), else the buy phase
  { key: "licenceNo", src: "run", at: "takes.store.token_id | buy.readback[licence <buyer>].token_id",
    get: (S) => String(S.run.takes?.store?.token_id ?? need(phase(S.run, "buy").readback[`licence ${S.buyer}`]?.token_id, "buyer licence token_id")) },
  { key: "buyTx", src: "run", at: "takes.store.tx | buy.txs[buy_licence <buyer>].hash",
    get: (S) => S.run.takes?.store?.tx ?? tx(S.run, "buy", `buy_licence ${S.buyer}`).hash },
  { key: "buildSha", src: "verify", at: "pins.artifactSha256", get: (S) => S.verify.pins.artifactSha256 },
  { key: "releasedSha", src: "verify", at: "pins.artifactSha256", get: (S) => S.verify.pins.artifactSha256 },
  { key: "releaseWasm", src: "verify", at: "pins.release", get: (S) => S.verify.pins.release },
  { key: "accessKeys", src: "run", at: "preflight.readback.contract_access_keys.length", get: (S) => String(need(phase(S.run, "preflight").readback.contract_access_keys, "contract_access_keys").length) },
  { key: "walrusBlob", src: "launch", at: "steps[walrus].blob_id", get: (S) => step(S, "walrus").blob_id },
  { key: "walrusHost", src: "launch", at: "steps[walrus].url (host)", get: (S) => new URL(step(S, "walrus").url).host },
  { key: "archiveItem", src: "launch|extra", at: "archive step .item (ia-upload.mjs) | extra.archiveItem",
    get: (S) => S.extra?.archiveItem ?? step(S, "archive").item },
  { key: "cdnUrl", src: "launch", at: "steps[cdn].url", get: (S) => step(S, "cdn").url },
  { key: "officialWorker", src: "launch", at: "steps[official].worker", get: (S) => step(S, "official").worker },
  { key: "workflow", src: "launch", at: "steps[cibuild].workflow", get: (S) => step(S, "cibuild").workflow },
  { key: "commit7", src: "launch", at: "steps[cibuild].commit[0:7]", get: (S) => step(S, "cibuild").commit.slice(0, 7) },
  { key: "rekorIndex", src: "launch", at: "steps[cibuild].rekor_log_index", get: (S) => String(step(S, "cibuild").rekor_log_index) },
  { key: "rekorLogged", src: "launch", at: "steps[cibuild].rekor_integrated_time", get: (S) => utcMinute(step(S, "cibuild").rekor_integrated_time) },
  { key: "releasedKey", src: "run|extra", at: "release.readback.released_key | extra.releasedKey",
    get: (S) => phase(S.run, "release").readback.released_key ?? S.extra.releasedKey },
  { key: "poolBefore", src: "run", at: "afterlife.post_death_buy.pool_before_near | choose.readback.totals.pool", get: (S) => (S.run.afterlife?.post_death_buy?.pool_before_near !== undefined ? fix(S.run.afterlife.post_death_buy.pool_before_near, 3) : yN(phase(S.run, "choose").readback.totals.pool, 3)) },
  { key: "postBuyDelta", src: "run", at: "afterlife.post_death_buy.pool_rise_near | post-death-buy assertion 'pool rose by 90%...'", get: (S) => S.run.afterlife?.post_death_buy?.pool_rise_near !== undefined ? fix(S.run.afterlife.post_death_buy.pool_rise_near, 3) : fix(/^([\d.]+) N of/.exec(assertion(S.run, "post-death-buy", /^pool rose by 90%/).detail)?.[1] ?? bad("no 'x N of' in detail"), 3) },
  { key: "poolTotal", src: "run", at: "afterlife.post_death_buy.pool_after_near | afterlife.pool_near | claim assertion 'pool decreased'", get: (S) => fix(S.run.afterlife?.post_death_buy?.pool_after_near ?? S.run.afterlife?.pool_near ?? poolAfter(S), 3) },
  { key: "refundedNear", src: "run", at: "afterlife.refunded_near", get: (S) => String(need(S.run.afterlife?.refunded_near, "afterlife.refunded_near")) },
  { key: "refundedCount", src: "run", at: "afterlife.refunded_count", get: (S) => need(S.run.afterlife?.refunded_count, "afterlife.refunded_count") },
  { key: "pledgedNear", src: "run", at: "afterlife.pledged_near", get: (S) => String(need(S.run.afterlife?.pledged_near, "afterlife.pledged_near")) },
  { key: "pledgedCount", src: "run", at: "afterlife.pledged_count", get: (S) => need(S.run.afterlife?.pledged_count, "afterlife.pledged_count") },
  { key: "runwayEpochs", src: "run", at: "afterlife.runway_epochs | floor(pool after buy / preflight.config.pool.epoch_cap)", get: (S) => S.run.afterlife?.runway_epochs ?? Math.floor(Number(poolAfter(S)) / Number(yN(cfg(S).pool.epoch_cap))) },
  { key: "epochCap", src: "run", at: "afterlife.epoch_cap_near | preflight.config.pool.epoch_cap", get: (S) => (S.run.afterlife?.epoch_cap_near !== undefined ? String(Number(S.run.afterlife.epoch_cap_near)) : yN(cfg(S).pool.epoch_cap)) },
  { key: "epochLen", src: "run", at: "afterlife.epoch_ms | preflight.config.pool.epoch_ms", get: (S) => `${(S.run.afterlife?.epoch_ms ?? cfg(S).pool.epoch_ms) / 60000} min` },
  { key: "hostPaid", src: "run", at: "claim.readback.claim.paid", get: (S) => yN(phase(S.run, "claim").readback.claim.paid) },
  { key: "sessionsVerified", src: "run", at: "claim.readback.claim.verified", get: (S) => need(phase(S.run, "claim").readback.claim.verified, "claim.verified") },
  { key: "payoutEpoch", src: "run", at: "evm-payout.readback.final_payout.epoch", get: (S) => need(payout(S).epoch, "final_payout.epoch") },
  { key: "payoutSessions", src: "run", at: "evm-payout.readback.final_payout.verified", get: (S) => need(payout(S).verified, "final_payout.verified") },
  { key: "payoutNear", src: "run", at: "evm-payout.readback.final_payout.near_debited", get: (S) => yN(payout(S).near_debited) },
  { key: "payoutNonce", src: "run", at: "evm-payout.readback.final_payout.nonce", get: (S) => need(payout(S).nonce, "final_payout.nonce") },
  { key: "payoutValue", src: "run", at: "evm-payout.readback.final_payout.value_wei (ETH)", get: (S) => `${yN(payout(S).value_wei, null, 18)} ETH` },
  { key: "payoutTo", src: "run", at: "evm-payout.readback.final_payout.to", get: (S) => payout(S).to },
  { key: "payoutToShort", src: "run", at: "final_payout.to (6…6)", get: (S) => shortAddr(payout(S).to) },
  { key: "payoutPayer", src: "launch", at: "steps[instance].evm_address", get: (S) => step(S, "instance").evm_address },
  { key: "basePayoutTx", src: "run", at: "evm-payout.readback.tx_hash", get: (S) => phase(S.run, "evm-payout").readback.tx_hash },
  { key: "basePayoutBlock", src: "run", at: "evm-payout assertion 'Base Sepolia receipt is a success'", get: (S) => /block (\d+)/.exec(assertion(S.run, "evm-payout", /^the Base Sepolia receipt is a success/).detail)?.[1] ?? bad("no block number in detail") },
  { key: "baseStatus", src: "run", at: "evm-payout assertion 'Base Sepolia receipt is a success' (pass)", get: (S) => (assertion(S.run, "evm-payout", /^the Base Sepolia receipt is a success/), "Success") },
  { key: "verifyInstance", src: "verify", at: "instance.id", get: (S) => S.verify.instance.id },
  { key: "verifyInstances", src: "verify|verify_all", at: "per instance: id + summary line", get: (S) => (S.verifyAll ?? [S.verify]).map((r) => ({ instance: r.instance.id, summary: summaryLine(r.counts, r.elapsed_ms) })) },
  { key: "verifyHead", src: "verify", at: "counts.fail == 0", get: (S) => (S.verify.counts.fail === 0 ? "ALL CHECKS THAT RAN HELD" : bad(`verify has ${S.verify.counts.fail} failing check(s)`)) },
  { key: "verifySummary", src: "verify", at: "counts + elapsed_ms", get: (S) => { const n = S.verify.counts; return summaryLine(n, S.verify.elapsed_ms); } },
  { key: "verifyCodeWhy", src: "verify", at: "results[code.hash].reason", get: (S) => ver(S, "code.hash").reason },
  { key: "verifyMarks", src: "verify", at: "results[].label -> status", get: (S) => Object.fromEntries(S.verify.results.map((r) => [r.label, r.status])) },
];

/** Cross-checks between values (the film shows some numbers twice and they must agree). */
export const CHECKS = [
  (V, set) => set !== "after" ? null : (V.payoutNear === V.hostPaid ? null : `payoutNear ${V.payoutNear} != hostPaid ${V.hostPaid} (S14 lifts the amount S15 flies to the Base row)`),
  (V, set) => set !== "judge" || V.poolBefore == null || V.postBuyDelta == null ? null : (Math.abs(Number(V.poolBefore) + Number(V.postBuyDelta) - Number(V.poolTotal)) < 0.0015 ? null : `poolBefore + postBuyDelta (${V.poolBefore} + ${V.postBuyDelta}) != poolTotal ${V.poolTotal}`),
];
