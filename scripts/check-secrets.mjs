#!/usr/bin/env node
// Refuses the commit/build if any tracked or staged file carries a private key
// or token shape. Run by `pnpm check` and by the git pre-commit hook.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const PATTERNS = [
  { name: "NEAR private key", re: /ed25519:[1-9A-HJ-NP-Za-km-z]{80,}/ },
  { name: "secp256k1 private key", re: /secp256k1:[1-9A-HJ-NP-Za-km-z]{60,}/ },
  { name: "private_key field", re: /"private_key"\s*:\s*"[^"]{20,}"/ },
  { name: "ElevenLabs key", re: /\bsk_[a-f0-9]{48}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "OpenAI-style key", re: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { name: "AWS key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Bearer token literal", re: /Bearer\s+[A-Za-z0-9._-]{40,}/ },
  { name: "PEM block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];
const FORBIDDEN_PATHS = [/(^|\/)\.env(\.|$)(?!example)/, /\.near-credentials/, /(^|\/)\.dev\.vars$/];
const SKIP = [/\.wasm$/, /\.png$/, /\.jpe?g$/, /\.webp$/, /\.gif$/, /\.mp[34]$/, /\.wav$/, /\.woff2?$/, /pnpm-lock\.yaml$/, /Cargo\.lock$/];

const staged = process.argv.includes("--staged");
const files = execFileSync("git", staged
  ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]
  : ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split("\n").filter(Boolean);

const failures = [];
for (const f of files) {
  if (FORBIDDEN_PATHS.some((re) => re.test(f))) failures.push(`${f}: forbidden path`);
  if (SKIP.some((re) => re.test(f))) continue;
  let text;
  try {
    if (statSync(f).size > 5_000_000) continue;
    text = staged ? execFileSync("git", ["show", `:${f}`], { encoding: "utf8" }) : readFileSync(f, "utf8");
  } catch { continue; }
  for (const { name, re } of PATTERNS) if (re.test(text)) failures.push(`${f}: ${name}`);
}

if (failures.length) {
  process.stderr.write(`check-secrets: FAIL (${failures.length})\n${failures.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`check-secrets: ok (${files.length} files scanned)\n`);
