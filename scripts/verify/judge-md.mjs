#!/usr/bin/env node
// Generates JUDGE.md from the claim registry (claims.mjs), the proof manifests and the repository. Nothing in the claim tables is typed by hand.
//   node scripts/verify/judge-md.mjs [--check]     (--check exits 1 when JUDGE.md is out of date instead of writing it)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CONFIG, ROOT } from "./instances.mjs";
import { REPO_URL, resolveClaims, v2Launched } from "./evidence.mjs";
import { honesty, notCovered } from "./honesty.mjs";

const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const link = (t, u) => `[${cell(t)}](${u})`;
const mark = (r) => (r.uncommitted ? " †" : "");
const txLinks = (txs) => txs.map((t) => link(t.label || t.hash.slice(0, 8), t.url)).join("<br>");

function chainCell(c, launched) {
  const v1 = c.txs.v1.length ? `**v1:** ${txLinks(c.txs.v1)}` : "";
  let v2;
  if (c.txs.v2.length) v2 = `**v2:** ${txLinks(c.txs.v2)}`;
  else if (c.version === "v1" && !c.txs.v1.length && !c.txs.dev.length) v2 = "";
  else v2 = `**v2 (ember-rift):** ${launched ? "no tx for this claim" : "pending judge v2 launch"}${c.txs.dev.length ? `<br>dev run (v2dev, same code): ${txLinks(c.txs.dev)}` : ""}`;
  return [v1, v2].filter(Boolean).join("<br>") || "none: pure logic, proven by the tests";
}

function table(claims, launched) {
  const rows = ["| Claim | Chain evidence | Code | Test | `pnpm verify` check |", "|---|---|---|---|---|"];
  for (const c of claims) {
    rows.push(`| **${c.id}**: ${cell(c.claim)} | ${chainCell(c, launched)} | ${c.codeRefs.map((r) => `${link(r.label, r.url)}${mark(r)}`).join("<br>")} | ${c.testRefs.map((r) => `${link(`${r.label} \`${r.name.length > 48 ? `${r.name.slice(0, 47)}…` : r.name}\``, r.url)}${mark(r)}`).join("<br>")} | ${c.checks.length ? c.checks.map((k) => `\`${k}\``).join(" ") : "n/a (not readable from chain)"} |`);
  }
  return rows.join("\n");
}

export function buildJudgeMd() {
  const claims = resolveClaims();
  const launched = v2Launched();
  const inst = CONFIG.instances;
  const nb = (id) => `[\`${id}\`](https://testnet.nearblocks.io/address/${id})`;
  const dirty = claims.flatMap((c) => [...c.codeRefs, ...c.testRefs]).some((r) => r.uncommitted);
  return `# Judge guide: verify every Last Save claim in under a minute

**No funds. No keys. No wallet.** Read-only against NEAR testnet public RPC (FastNear, dRPC fallback), plain HTTPS for mirrors and attestations.

\`\`\`bash
pnpm install
pnpm verify                      # the live judge instance: a table of ✓ / ✗ / n/a with a one-line reason each, about 2 s
pnpm verify --instance lastsave-licence.testnet    # v1: locked, Dead, released, hosted
pnpm verify --all                # every instance that exists
pnpm verify --json               # the same, machine-readable (what /proof.json is built from)
pnpm verify --rebuild            # also rebuilds release.wasm and probe.wasm in OutLayer's pinned Docker image (slow)
pnpm demo:fresh                  # the whole lifecycle on a local NEAR sandbox: mock OutLayer, mock signer, no testnet funds
pnpm run test:verify             # unit tests for the checks (hash compare, address derivation, decryption, totals)
\`\`\`

Exit code 0 = everything that ran held, 1 = something did not hold, 2 = could not run. A check that cannot run (network, nothing to check yet) says so: \`!\` or \`n/a\`, never a silent pass.
Machine-readable claim map: \`/proof.json\` (platform) and \`web/public/proof.json\` (repository).

## Live objects (NEAR testnet)

| What | Account | State |
|---|---|---|
| v1 judge instance | ${nb("lastsave-licence.testnet")} | locked, Dead, key released, hosted by a fan. Whole life: [proof/judge-run.md](${REPO_URL}/blob/main/proof/judge-run.md) |
| v2 judge instance | ${nb("ember-rift.lastsave-factory.testnet")} | ${launched ? "launched: see the table below" : "**pending judge v2 launch**"} |
| v2 dev instance (same code, earlier build) | ${nb("v2dev.lastsave-factory.testnet")} | full lifecycle run: [proof/](${REPO_URL}/tree/main/proof) |
| Factory | ${nb(CONFIG.factory)} | instantiates the global licence contract |
| Global licence code | \`${CONFIG.globalCodeHash}\` | published by [tx 3g7AQ41U…](https://testnet.nearblocks.io/txns/${CONFIG.globalPublishTx}); readable by anyone through RPC \`view_global_contract_code\` |

## Claim to evidence map

Each row: the claim, the transaction that shows it, the code that does it (file:line at the last commit that touched the file), the test that pins it, and the live check in \`pnpm verify\` that re-reads it from chain.
${dirty ? "\n† = the file had uncommitted changes when this was generated, so the link points at \`main\`; regenerate with \`pnpm judge:md\` after committing.\n" : ""}
### v1: escrow, liveness, death, release, refund and pledge, host payouts, locked contract

${table(claims.filter((c) => c.version === "v1"), launched)}

### v2: gas-free relayer, Chain Signatures payouts, global contract and factory, Walrus, provenance

${table(claims.filter((c) => c.version === "v2"), launched)}

## What is rehearsed and what is real

${honesty()}

## What this does not prove

${notCovered()}

## Regenerate this file

\`pnpm judge:md\` rebuilds it from \`scripts/verify/claims.mjs\`, the manifests in \`proof/\` (\`judge-run.md\`, \`launch-*.json\`, \`judge-v2.json\`) and the repository. It refuses to write if a claim points at code, a test or a check that does not exist. The ember-rift cells fill in when \`proof/launch-ember-rift.json\` and \`proof/judge-v2.json\` exist.
`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const text = buildJudgeMd();
  const file = join(ROOT, "JUDGE.md");
  if (process.argv.includes("--check")) {
    const same = (() => { try { return readFileSync(file, "utf8") === text; } catch { return false; } })();
    process.stdout.write(same ? "JUDGE.md is up to date\n" : "JUDGE.md is out of date: run pnpm judge:md\n");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(file, text);
  process.stdout.write(`wrote JUDGE.md (${text.split("\n").length} lines)\n`);
}
