#!/usr/bin/env node
// Turns a run report into the short proof table:  node scripts/e2e/summarize.mjs proof/run-v2dev-<UTC>.json > proof/v2-e2e.md
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { process.stderr.write("usage: summarize.mjs <run report json>\n"); process.exit(2); }
const run = JSON.parse(readFileSync(file, "utf8"));
const out = [];
const t = run.totals;
out.push(`# v2 end-to-end run on ${run.contract}`, "");
out.push(`Report: \`${file}\`. Started ${run.started_at}, finished ${run.finished_at ?? "not finished"}. Gas-free relayer mode: ${run.gasless}.`);
out.push(`Totals: ${t.passed} assertions passed, ${t.failed} failed; ${t.phases_passed} phases passed, ${t.phases_failed} failed.`, "");
out.push("| Phase | Result | Assertions | Failed assertions |", "|---|---|---|---|");
for (const p of run.phases) {
  const bad = p.assertions.filter((a) => !a.pass);
  out.push(`| ${p.name} | ${p.status} | ${p.assertions.length - bad.length}/${p.assertions.length} | ${bad.map((a) => a.name).join("; ") || "none"} |`);
}
out.push("", "## Transactions", "", "| Phase | Label | Link |", "|---|---|---|");
for (const p of run.phases) for (const x of p.txs) out.push(`| ${p.name} | ${x.label}${x.failure ? " (refused)" : ""} | ${x.url} |`);
out.push("", "## Balances (NEAR)", "", "| Account | Start | End |", "|---|---|---|");
for (const [k, v] of Object.entries(run.balances_start ?? {})) out.push(`| ${k} | ${v} | ${run.balances_end?.[k] ?? "?"} |`);
out.push("", "Failed assertions in full:", "");
const failed = run.phases.flatMap((p) => p.assertions.filter((a) => !a.pass).map((a) => `- ${p.name}: ${a.name} (${a.detail})`));
out.push(...(failed.length ? failed : ["- none"]));
process.stdout.write(`${out.join("\n")}\n`);
