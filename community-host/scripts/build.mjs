#!/usr/bin/env node
// npm run build   (Workers Builds build command). Exits non-zero, with the reason, when the build must not be deployed.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCommunityHost } from "../lib/build.mjs";
import { Refusal } from "../vendor/refusal.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const log = (s) => process.stdout.write(`${s}\n`);
log("Last Save community host: verifying the released build before it is deployed");
try {
  await buildCommunityHost({ root, log: (s) => log(`  ${s}`) });
  log("Build verified and unpacked.");
} catch (e) {
  if (e instanceof Refusal) { process.stderr.write(`REFUSED (${e.code}): ${e.message}\n`); process.exit(3); }
  process.stderr.write(`build failed: ${e.message}\n`);
  process.exit(1);
}
