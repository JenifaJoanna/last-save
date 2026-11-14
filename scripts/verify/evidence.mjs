// Resolves the claim registry against the repository: code and test line numbers, GitHub permalinks, and the txs behind each claim.
// Refuses (throws) when a code string, test name or check id in claims.mjs does not exist: a claim cannot point at nothing.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CLAIMS } from "./claims.mjs";
import { CHECK_IDS } from "./run.mjs";
import { CONFIG, ROOT, manifestFiles, resolveInstance } from "./instances.mjs";
import { nearblocksTx } from "./rpc.mjs";
import { txsFromJson, txsFromMarkdown } from "./pure.mjs";

const git = (...a) => { try { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
export const REPO_URL = `https://github.com/${CONFIG.repo}`;

/** Permalink at the last commit that touched the file. A file with uncommitted changes links to main and is flagged: regenerate once it is committed. */
function permalink(file, line) {
  const sha = git("log", "-1", "--format=%H", "--", file);
  const dirty = !sha || git("status", "--porcelain", "--", file) !== "";
  return { url: `${REPO_URL}/blob/${dirty ? "main" : sha}/${file}#L${line}`, commit: dirty ? null : sha.slice(0, 7), uncommitted: dirty };
}

function findLine(file, needles) {
  const p = join(ROOT, file);
  if (!existsSync(p)) throw new Error(`claims.mjs: ${file} does not exist`);
  const lines = readFileSync(p, "utf8").split("\n");
  for (const n of needles) { const i = lines.findIndex((l) => l.includes(n)); if (i >= 0) return i + 1; }
  throw new Error(`claims.mjs: "${needles[0]}" not found in ${file}`);
}

export const codeRef = ([file, find]) => { const line = findLine(file, [find]); return { file, line, label: `${file}:${line}`, ...permalink(file, line) }; };
export const testRef = ([file, name]) => { const line = findLine(file, [`fn ${name}`, `"${name}`, `'${name}`, name]); return { file, name, line, label: `${file.split("/").pop()}:${line}`, ...permalink(file, line) }; };

/** Labelled txs for one version: ember-rift's own manifests for v2 (null while it has none), the v1 judge instance's for v1. */
export function txPool(version) {
  const inst = resolveInstance(version === "v1" ? "lastsave-licence.testnet" : "ember-rift.lastsave-factory.testnet");
  const files = manifestFiles(inst);
  const txs = [];
  for (const f of files) {
    const text = readFileSync(join(ROOT, f), "utf8");
    try { txs.push(...(f.endsWith(".md") ? txsFromMarkdown(text) : txsFromJson(JSON.parse(text))).map((t) => ({ ...t, file: f }))); } catch { /* an unreadable manifest has no txs */ }
  }
  return { instance: inst.id, files, txs };
}
/** The v2dev dev run (same code), shown beside ember-rift's own txs while those are pending. */
export const devPool = () => {
  const inst = resolveInstance("v2dev.lastsave-factory.testnet");
  const txs = [];
  for (const f of manifestFiles(inst)) try { txs.push(...txsFromJson(JSON.parse(readFileSync(join(ROOT, f), "utf8"))).map((t) => ({ ...t, file: f }))); } catch { /* skip */ }
  return { instance: inst.id, txs };
};

export const pick = (pool, re, n = 3) => {
  const seen = new Set();
  return pool.txs.filter((t) => re.test(t.label) && !seen.has(t.hash) && seen.add(t.hash)).slice(0, n)
    .map((t) => ({ hash: t.hash, label: (t.title ?? t.label).replace(/\s+/g, " ").slice(0, 64), url: nearblocksTx(t.hash), instance: pool.instance }));
};

/** Full resolved registry. Throws on any dangling reference. */
export function resolveClaims() {
  const pools = { v1: txPool("v1"), v2: txPool("v2"), dev: devPool() };
  return CLAIMS.map((c) => {
    for (const id of c.checks) if (!CHECK_IDS.includes(id)) throw new Error(`claims.mjs: claim ${c.id} names unknown check ${id}`);
    return {
      ...c, codeRefs: c.code.map(codeRef), testRefs: c.tests.map(testRef),
      txs: { v1: pick(pools.v1, c.tx.v1), v2: pick(pools.v2, c.tx.v2), dev: pick(pools.dev, c.tx.v2) },
    };
  });
}
export const v2Launched = () => txPool("v2").txs.length > 0;
