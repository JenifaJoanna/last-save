#!/usr/bin/env node
// pnpm verify [--instance <account or name>] [--all] [--json] [--rebuild] [--only <check id,...>] [--strict]
// Read-only: no keys, no funds, no transactions. Exit 0 = every check that ran held, 1 = something did not hold, 2 = could not run.
// Without --instance the first instance in scripts/verify/instances.json "defaultOrder" that exists on testnet is checked.
import { CONFIG, resolveInstance } from "./instances.mjs";
import { accountState } from "./rpc.mjs";
import { renderReport } from "./render.mjs";
import { CHECK_IDS, runInstance } from "./run.mjs";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const out = (s) => process.stdout.write(`${s}\n`);

if (flag("help") || flag("h")) {
  out("usage: pnpm verify [--instance <account|name>] [--all] [--json] [--rebuild] [--only <ids>] [--strict]");
  out(`instances: ${Object.keys(CONFIG.instances).join(", ")}`);
  out(`check ids: ${CHECK_IDS.join(", ")}`);
  process.exit(0);
}

const opts = { rebuild: flag("rebuild"), only: opt("only")?.split(",") };
const exists = async (id) => Boolean(await accountState(resolveInstance(id).id));

async function pickInstances() {
  if (flag("all")) {
    const found = [];
    for (const id of Object.keys(CONFIG.instances)) if (await exists(id)) found.push(id);
    return found;
  }
  const given = opt("instance") ?? process.env.LASTSAVE_INSTANCE;
  if (given) return [given];
  for (const id of CONFIG.defaultOrder) if (await exists(id)) return [id];
  return [CONFIG.defaultOrder.at(-1)];
}

try {
  const reports = [];
  for (const id of await pickInstances()) reports.push(await runInstance(id, opts));
  if (flag("json")) out(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
  else out(reports.map((r) => renderReport(r)).join("\n\n"));
  const failed = reports.some((r) => !r.exists || r.counts.fail > 0 || (flag("strict") && r.counts.warn > 0));
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  process.stderr.write(`verify could not run: ${String(e.message ?? e)}\n`);
  process.exitCode = 2;
}
