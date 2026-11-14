// Proof manifests (every listed tx must resolve on RPC) and build provenance (Sigstore / GitHub attestation).
import { classifyTx, short } from "./pure.mjs";
import { nearblocksTx } from "./rpc.mjs";
import { bad, na, ok, warn } from "./checks-chain.mjs";

/** Runs `fn` over `items` with a small pool, keeping order. */
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

async function resolveTx(ctx, tx) {
  try {
    const r = await ctx.deps.txLookup(tx.hash, ctx.inst.studio);
    const c = classifyTx(r);
    const expected = tx.expect === "failure" ? !c.ok : c.ok;
    return { ...tx, state: !c.final ? "pending" : expected ? "ok" : "unexpected", failure: c.failure, url: nearblocksTx(tx.hash) };
  } catch (e) { return { ...tx, state: "unresolved", error: String(e.message).slice(0, 80), url: nearblocksTx(tx.hash) }; }
}

async function manifestTxs(ctx) {
  const manifests = ctx.manifests();
  const broken = manifests.filter((m) => m.error);
  const txs = [...new Map(manifests.flatMap((m) => m.txs.map((t) => [t.hash, { ...t, file: m.file }]))).values()];
  if (!txs.length) return na(manifests.length ? "manifests list no transactions" : "no proof manifest for this instance yet (pending launch)");
  const rows = await pool(txs, 6, (t) => resolveTx(ctx, t));
  const by = (s) => rows.filter((r) => r.state === s);
  const files = manifests.filter((m) => m.txs.length).map((m) => m.file.split("/").pop()).join(", ");
  const facts = { rows, files: manifests.map((m) => m.file), tally: { ok: by("ok").length, total: rows.length } };
  if (by("unexpected").length) return bad(`${by("unexpected").length}/${rows.length} txs did not end as listed (${by("unexpected").slice(0, 2).map((r) => `${short(r.hash)} ${r.failure ?? ""}`).join("; ")})`, facts);
  if (by("unresolved").length) return warn(`${by("ok").length}/${rows.length} txs resolved; ${by("unresolved").length} could not be read (${by("unresolved")[0].error}) [${files}]`, facts);
  if (by("pending").length) return warn(`${by("pending").length} tx(s) not final yet`, facts);
  return ok(`${rows.length}/${rows.length} listed txs are on chain, final, executed as listed [${files}]${broken.length ? `; ${broken.length} unreadable manifest(s)` : ""}`, facts);
}

const loadProvenance = () => import("../../host/lib/provenance.mjs");

async function provenance(ctx) {
  if (ctx.inst.kind !== "factory") return na("v1 predates the CI build pipeline; its build hash is checked by decrypting the released artifact");
  const info = await ctx.info();
  const digest = info.config.artifact.build_hash;
  let lib;
  try { lib = ctx.deps.provenanceLib ?? await loadProvenance(); } catch (e) { return warn(`provenance verifier not installed (${String(e.message).slice(0, 50)}); run pnpm install`); }
  try {
    const p = await lib.verifyProvenance({ digest, repo: ctx.inst.repo, tag: ctx.inst.buildTag, verifyBundle: ctx.deps.verifyBundle });
    return ok(`build_hash ${short(digest)} is attested: ${lib.describeProvenance(p)}${p.rekorIndex != null ? ` https://search.sigstore.dev/?logIndex=${p.rekorIndex}` : ""}`, { provenance: p });
  } catch (e) {
    const msg = String(e.message).slice(0, 140);
    if (e.code === "not_found") return na(`no build attestation for ${short(digest)} (built before the CI pipeline or not published yet)`);
    if (e.code === "unreachable") return warn(`attestation endpoints unreachable: ${msg}`);
    return bad(`${e.code ?? "error"}: ${msg}`);
  }
}

export const CHECKS = [
  { id: "provenance", group: "Provenance", label: "Build attested by GitHub Actions (Sigstore) for the on-chain build hash", run: provenance },
  { id: "manifest.txs", group: "Proof", label: "Every tx in the proof manifests resolves on RPC", run: manifestTxs },
];
