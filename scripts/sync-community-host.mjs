#!/usr/bin/env node
// Regenerates community-host/vendor from host/lib and server-bundle/lib, because the Deploy to Cloudflare button needs the template
// directory to be fully self-contained. One source of truth: edit host/ and server-bundle/, then run this.
//   node scripts/sync-community-host.mjs [--check]     (--check exits 1 when vendor/ is stale; used by the test)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const FILES = [
  ["host/lib/prepare.mjs", "prepare.mjs"], ["host/lib/mirrors.mjs", "mirrors.mjs"], ["host/lib/provenance.mjs", "provenance.mjs"],
  ["host/lib/refusal.mjs", "refusal.mjs"], ["server-bundle/lib/crypto.mjs", "crypto.mjs"], ["server-bundle/lib/tar.mjs", "tar.mjs"],
];
export const rewrite = (src, from) => `// GENERATED from ${from} by scripts/sync-community-host.mjs. Do not edit; change the source and re-run the script.\n`
  + src.replaceAll('from "server-bundle/crypto"', 'from "./crypto.mjs"').replaceAll('from "server-bundle/tar"', 'from "./tar.mjs"');
export const expected = () => FILES.map(([from, to]) => [`community-host/vendor/${to}`, rewrite(readFileSync(from, "utf8"), from)]);

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes("--check");
  mkdirSync("community-host/vendor", { recursive: true });
  let stale = 0;
  for (const [path, text] of expected()) {
    let cur = null; try { cur = readFileSync(path, "utf8"); } catch { /* missing */ }
    if (cur === text) continue;
    stale++;
    if (!check) writeFileSync(path, text);
  }
  process.stdout.write(check ? (stale ? `vendor is stale (${stale} files)\n` : "vendor is in sync\n") : `vendor written (${stale} files changed)\n`);
  process.exit(check && stale ? 1 : 0);
}
