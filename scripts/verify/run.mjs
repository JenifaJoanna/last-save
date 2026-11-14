// Runs every check for one instance and returns a plain report object (also what --json and proof.json are built from).
import { resolveInstance } from "./instances.mjs";
import { makeContext } from "./context.mjs";
import { CHECKS as chain } from "./checks-chain.mjs";
import { CHECKS as artifact } from "./checks-artifact.mjs";
import { CHECKS as evm } from "./checks-evm.mjs";
import { CHECKS as proof } from "./checks-proof.mjs";
import { CHECKS as rebuild } from "./rebuild.mjs";
import { fmtNear, summarize } from "./pure.mjs";

export const ALL_CHECKS = [...chain, ...artifact, ...evm, ...proof, ...rebuild];
export const CHECK_IDS = ALL_CHECKS.map((c) => c.id);

async function runCheck(c, ctx) {
  const t0 = Date.now();
  try {
    const r = await c.run(ctx);
    return { id: c.id, group: c.group, label: c.label, ...r, ms: Date.now() - t0 };
  } catch (e) {
    // A check that could not run is never a pass: it is a warning that says why.
    return { id: c.id, group: c.group, label: c.label, status: "warn", reason: `could not run: ${String(e.message ?? e).slice(0, 140)}`, ms: Date.now() - t0 };
  }
}

function banner(info) {
  const t = info.totals;
  const bits = [`${info.config.title} · ${info.status}${info.cause ? ` (${info.cause})` : ""}`, info.release?.released ? "key released" : "key escrowed", `${t.supply} licences`, `pool ${fmtNear(t.pool)}`];
  if (t.pot_locked !== "0") bits.push(`locked pot ${fmtNear(t.pot_locked)}`);
  if (info.hosts) bits.push(`${info.hosts} host(s), ${info.claims} claim(s)`);
  return bits.join(" · ");
}

export async function runInstance(input, opts = {}, deps = {}) {
  const inst = typeof input === "string" ? resolveInstance(input) : input;
  const ctx = makeContext(inst, opts, deps);
  const started = Date.now();
  const base = { instance: { id: inst.id, kind: inst.kind, label: inst.label, factory: inst.kind === "factory" ? inst.factory : null }, network: "testnet", at: new Date().toISOString() };
  const acct = await ctx.account().catch((e) => { throw new Error(`cannot reach NEAR RPC: ${e.message}`); });
  if (!acct) return { ...base, exists: false, results: [], counts: summarize([]), elapsed_ms: Date.now() - started };
  const info = await ctx.info();
  const only = opts.only ? new Set(opts.only) : null;
  const results = await Promise.all(ALL_CHECKS.filter((c) => !only || only.has(c.id)).map((c) => runCheck(c, ctx)));
  return {
    ...base, exists: true, state: banner(info), pins: {
      codeHash: inst.kind === "factory" ? inst.globalCodeHash : inst.codeSha256, release: info.config.release.sha256, probe: info.config.probe.sha256,
      keyCommitment: info.config.key_commitment, artifactSha256: info.config.artifact.sha256, buildHash: info.config.artifact.build_hash,
    },
    results, counts: summarize(results), elapsed_ms: Date.now() - started,
  };
}
