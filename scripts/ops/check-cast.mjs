#!/usr/bin/env node
// Film gate for terminal takes: refuses an asciinema cast (header and every output event) that shows a home or project
// path, the Mac username, a pnpm script banner, or a forbidden identity term. Run on every <slot>.cast before it is saved
// into demo/film/public/footage/raw/. Exit 1 lists each hit by line and term index, never the matched text in full.
//   node scripts/ops/check-cast.mjs <file.cast>...
import { readFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { ON_CAMERA_TERMS, TERMS } from "../lib/identity-terms.mjs";

const strip = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g, "");
const rules = [
  ...[...TERMS, ...ON_CAMERA_TERMS, userInfo().username].map((t, i) => ({ name: `identity term #${i}`, test: (s) => s.toLowerCase().includes(t.toLowerCase()) })),
  { name: "home path", test: (s) => s.includes(homedir()) || /(^|[\s"'=:(])~\//.test(s) },
  { name: "absolute user path", test: (s) => /\/(Users|home)\/[^/\s]+/.test(s) },
  { name: "pnpm script banner (use pnpm -s)", test: (s) => /^\s*>\s+\S+@\S+\s+\S/m.test(s) },
];

export function checkCast(text) {
  const hits = [];
  const lines = text.split("\n");
  lines.forEach((line, n) => {
    if (!line.trim()) return;
    let shown = line;
    if (n > 0) {
      try { const ev = JSON.parse(line); shown = Array.isArray(ev) ? String(ev[2] ?? "") : line; } catch { /* not an event line: scan raw */ }
    }
    const s = strip(shown);
    for (const r of rules) if (r.test(s)) hits.push(`line ${n + 1}: ${r.name}`);
  });
  return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) { process.stderr.write("usage: check-cast.mjs <file.cast>...\n"); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    const hits = checkCast(readFileSync(f, "utf8"));
    if (hits.length) { bad++; process.stdout.write(`REFUSED ${f.split("/").pop()}\n${hits.map((h) => `  ${h}`).join("\n")}\n`); }
    else process.stdout.write(`ok ${f.split("/").pop()}\n`);
  }
  process.exit(bad ? 1 : 0);
}
