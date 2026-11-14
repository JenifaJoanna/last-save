#!/usr/bin/env node
// Writes web/public/proof.json: claims -> tx hashes -> explorer links -> code -> tests -> live check results, from one verify run per instance.
// Also keeps one /proof.json line in the README (between markers). Touches nothing else.
//   node scripts/proof-json.mjs [--offline <report.json>]     (--offline reuses a saved `pnpm verify --json --all` report instead of calling RPC)
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONFIG, ROOT } from "./verify/instances.mjs";
import { resolveClaims, REPO_URL, v2Launched } from "./verify/evidence.mjs";
import { honesty } from "./verify/honesty.mjs";
import { accountState } from "./verify/rpc.mjs";
import { runInstance } from "./verify/run.mjs";
import { resolveInstance } from "./verify/instances.mjs";

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const git = (...a) => { try { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };

async function reports() {
  if (arg("offline")) { const r = JSON.parse(readFileSync(arg("offline"), "utf8")); return Array.isArray(r) ? r : [r]; }
  const out = [];
  for (const id of Object.keys(CONFIG.instances)) {
    if (await accountState(resolveInstance(id).id)) out.push(await runInstance(id));
    else out.push({ instance: { id: resolveInstance(id).id, kind: resolveInstance(id).kind, label: resolveInstance(id).label }, exists: false, results: [], counts: null, status: "pending judge v2 launch" });
  }
  return out;
}

const slim = (r) => ({
  id: r.instance.id, kind: r.instance.kind, label: r.instance.label, exists: r.exists, status: r.exists ? undefined : "pending launch", state: r.state, checked_at: r.at, counts: r.counts, pins: r.pins,
  checks: r.results.map(({ id, group, label, status, reason, links }) => ({ id, group, label, status, reason, ...(links ? { links } : {}) })),
});

export async function buildProof() {
  const rs = await reports();
  const byInstance = Object.fromEntries(rs.map((r) => [r.instance.id, r]));
  const status = (id, check) => byInstance[id]?.results?.find((c) => c.id === check)?.status ?? (byInstance[id]?.exists === false ? "pending" : "not run");
  const claims = resolveClaims().map((c) => ({
    id: c.id, version: c.version, claim: c.claim,
    checks: Object.fromEntries(c.checks.map((k) => [k, Object.fromEntries(Object.keys(byInstance).map((id) => [id, status(id, k)]))])),
    tx: { "v1 (lastsave-licence)": c.txs.v1, "v2 (ember-rift)": c.txs.v2.length ? c.txs.v2 : "pending judge v2 launch", "v2 dev run (v2dev, same code)": c.txs.dev },
    code: c.codeRefs.map((r) => ({ at: r.label, url: r.url, commit: r.commit })),
    tests: c.testRefs.map((r) => ({ name: r.name, at: r.label, url: r.url, commit: r.commit })),
  }));
  return {
    schema: "lastsave-proof/1", generated_at: new Date().toISOString(), repo: REPO_URL, commit: git("rev-parse", "HEAD"), network: "NEAR testnet (+ Base Sepolia for payouts)",
    verify: { command: "pnpm verify", read_only: true, needs: "nothing: no keys, no funds", judge_guide: `${REPO_URL}/blob/main/JUDGE.md` },
    v2_judge_instance: v2Launched() ? "launched" : "pending judge v2 launch",
    instances: rs.map(slim), claims,
    rehearsed_vs_real: honesty().split("\n").slice(2).map((l) => l.replace(/^\| |\*\*| \|$/g, "").split(" | ")).map(([thing, status, detail]) => ({ thing, status, detail })),
  };
}

const MARK = ["<!-- proof-link:start -->", "<!-- proof-link:end -->"];
const README_LINE = `${MARK[0]}\n- **One command, no funds, no keys:** \`pnpm verify\` re-checks every claim from chain in about 2 s. The claim map is [\`JUDGE.md\`](JUDGE.md) and machine-readable at [\`/proof.json\`](https://last-save.pages.dev/proof.json) (\`web/public/proof.json\`).\n${MARK[1]}`;
export function patchReadme(text) {
  const re = new RegExp(`${MARK[0]}[\\s\\S]*?${MARK[1]}`);
  if (re.test(text)) return text.replace(re, README_LINE);
  return text.replace(/(## Verify it yourself\n\n)/, `$1${README_LINE}\n`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const proof = await buildProof();
  const file = join(ROOT, "web/public/proof.json");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(proof, null, 2)}\n`);
  const readme = join(ROOT, "README.md");
  const next = patchReadme(readFileSync(readme, "utf8"));
  writeFileSync(readme, next);
  process.stdout.write(`wrote web/public/proof.json (${proof.instances.length} instances, ${proof.claims.length} claims)\n`);
}
