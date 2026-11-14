// Lazily loaded, memoised facts about one instance. A check asks for what it needs; nothing is fetched twice.
// `deps` is injectable so the checks run against fixtures in tests.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as rpc from "./rpc.mjs";
import { ROOT, manifestFiles, readManifest } from "./instances.mjs";
import { mirrorLabel, sha256Hex, txsFromJson, txsFromMarkdown } from "./pure.mjs";

const memo = (fn) => { let p; return () => (p ??= fn()); };

export function makeContext(inst, opts = {}, deps = {}) {
  const d = { ...rpc, ...deps };
  const root = opts.root ?? ROOT;
  const id = inst.id;
  const ctx = { inst, opts, deps: d, root };

  ctx.info = memo(() => d.view(id, "get_info"));
  ctx.account = memo(() => d.accountState(id));
  ctx.keys = memo(() => d.accessKeys(id));
  ctx.factoryCodeHash = memo(() => d.view(inst.factory, "code_hash"));
  ctx.factoryInstances = memo(async () => {
    const all = [];
    for (let from = 0; from < 2000; from += 100) {
      const page = await d.view(inst.factory, "instances", { from_index: from, limit: 100 });
      all.push(...page);
      if (page.length < 100) break;
    }
    return all;
  });
  ctx.evmInfo = memo(() => d.view(id, "evm_payout_info", {}, { missing: null }));
  ctx.payouts = memo(async () => {
    const all = [];
    for (let from = 0; from < 1000; from += 50) {
      const page = await d.view(id, "get_evm_payouts", { from_index: from, limit: 50 }, { missing: [] });
      all.push(...page);
      if (page.length < 50) break;
    }
    return all;
  });

  /** Manifests present in the repo: [{ file, kind: "md"|"json", json?, txs }]. Unparseable ones are kept with an error so a check can say so. */
  ctx.manifests = memo(() => manifestFiles(inst, root).map((file) => {
    try {
      const text = readManifest(file, root);
      if (file.endsWith(".md")) return { file, kind: "md", txs: txsFromMarkdown(text) };
      const json = JSON.parse(text);
      return { file, kind: "json", json, txs: txsFromJson(json) };
    } catch (e) { return { file, kind: "json", txs: [], error: String(e.message).slice(0, 100) }; }
  }));
  /** A step of a launch manifest (proof/launch-*.json), e.g. step "escrow" or "deploy". */
  ctx.launchStep = (step) => {
    for (const m of ctx.manifests()) for (const s of m.json?.steps ?? []) if (s.step === step && s.hash) return { ...s, file: m.file };
    return null;
  };

  /** Hashes of every file under artifacts/ (the committed wasm and encrypted bundles): sha256 -> relative path. */
  ctx.localArtifacts = memo(() => {
    const dir = join(root, "artifacts");
    const map = new Map();
    if (!existsSync(dir)) return map;
    for (const f of readdirSync(dir)) map.set(sha256Hex(readFileSync(join(dir, f))), `artifacts/${f}`);
    return map;
  });

  /** Downloads every URL once: [{ url, label, bytes?, sha256?, status, error? }], in parallel. Cached by URL. */
  const fetched = new Map();
  ctx.download = (url) => {
    if (!fetched.has(url)) fetched.set(url, d.fetchBytes(url).then((r) => ({ url, label: mirrorLabel(url), status: r.status, error: r.error, bytes: r.bytes, sha256: r.bytes ? sha256Hex(r.bytes) : null })));
    return fetched.get(url);
  };
  ctx.downloadAll = (urls) => Promise.all(urls.map((u) => ctx.download(u)));
  return ctx;
}
