#!/usr/bin/env node
// Identity gate (brief §2.1). Fails if any forbidden identity string appears in
// the repo, built assets, git history authorship, Worker configs, or any
// deployed page/response; and if any Worker answers on a workers.dev URL.
// Forbidden terms are stored base64-encoded so this file never contains them.
//
//   node scripts/check-identity.mjs            repo + build output + configs + authorship
//   node scripts/check-identity.mjs --live     also fetch deploy/targets.json URLs (pages must serve; expected_gone must 404 or not resolve)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dec = (s) => Buffer.from(s, "base64").toString("utf8");
const TERMS = [
  "Z2FicmllbGF4eQ==", "Z2FicmllbA==", "YW50b255", "eGF2aW91cg==", "Y29zbWljbGFu",
  "aW5qZWN0LnNo", "LmVudi5tYXN0ZXI=", "Y2xhdWRlL3ZhdWx0",
  "Ym9ubmV5", "bWFyc2VsYQ==", "amVza2lucw==", "a2Fpem9rdWpvZWw=", "cmF0bmE=",
  "Y2lwaGVya3VtYQ==", "Y2lwaGVyIGt1bWE=", "am9lbG9mZmJlYXQ=", "c3Bpbm9sYQ==",
  "ZGFydGhzdG9ybWVy", "ZGFydGggc3Rvcm1lcg==",
].map(dec);
const WORKERS_SUB = dec("Z2FicmllbGF4eQ==");
const ALLOWED_AUTHOR = /^Jenifa ?Joanna <[^>]+>$/;
const BINARY = /\.(wasm|png|jpe?g|webp|gif|mp[34]|wav|ogg|woff2?|ttf|ico|zip|gz|br)$/i;
const BUILD_DIRS = ["web/dist", "web/dist-preview", "game/client/dist", "game/server/dist", "server-bundle/dist", "demo/out", "outlayer/dist"];

const failures = [];
const fail = (msg) => failures.push(msg);
const scanText = (label, text) => {
  const lower = text.toLowerCase();
  for (const t of TERMS) if (lower.includes(t)) fail(`${label}: contains forbidden identity term #${TERMS.indexOf(t)}`);
};

// 1. repo files (tracked + untracked-not-ignored): names and contents
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split("\n").filter(Boolean).filter((f) => existsSync(f));
for (const f of files) {
  scanText(`path ${f}`, f);
  if (BINARY.test(f) || statSync(f).size > 8_000_000) continue;
  scanText(f, readFileSync(f, "utf8"));
}

// 2. build output, even when gitignored
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
let built = 0;
for (const d of BUILD_DIRS.filter(existsSync)) {
  for (const f of walk(d)) {
    built++;
    scanText(`built ${f}`, f);
    if (/\.(wasm)$/i.test(f) || !BINARY.test(f)) scanText(`built ${f}`, readFileSync(f).toString("latin1"));
  }
}

// 3. Worker configs: workers.dev and preview URLs off, no account id, no routes on custom zones
const COMMUNITY_TEMPLATE = "community-host/wrangler.toml"; // the single path allowed workers_dev = true
const wranglerFiles = files.filter((f) => /(^|\/)wrangler\.(toml|jsonc?)$/.test(f));
for (const f of wranglerFiles) {
  const t = readFileSync(f, "utf8");
  const isPages = /pages_build_output_dir/.test(t);
  if (f === COMMUNITY_TEMPLATE) {
    // The Deploy to Cloudflare template is the one exception: it deploys into the clicker's own account, whose workers.dev address is its URL.
    if (!/^workers_dev\s*=\s*true\s*$/m.test(t)) fail(`${f}: the community template must state workers_dev = true explicitly`);
    if (!/preview_urls\s*[=:]\s*false/.test(t)) fail(`${f}: preview_urls must be false`);
  } else if (!isPages) {
    if (!/workers_dev\s*[=:]\s*false/.test(t)) fail(`${f}: workers_dev must be false`);
    if (!/preview_urls\s*[=:]\s*false/.test(t)) fail(`${f}: preview_urls must be false`);
  }
  if (/account_id/.test(t)) fail(`${f}: account_id must not be in tracked files`);
  if (/^\s*(routes?|custom_domain)\b/m.test(t)) fail(`${f}: no routes or custom domains`);
}
if (files.some((f) => readFileSync(f, "latin1").match(/account_id\s*=\s*"[0-9a-f]{32}"/))) fail("a tracked file carries a Cloudflare account id");

// 4. git authorship: every commit is the persona
try {
  const log = execFileSync("git", ["log", "--format=%an <%ae>%n%cn <%ce>"], { encoding: "utf8" }).split("\n").filter(Boolean);
  const bad = [...new Set(log.filter((l) => !ALLOWED_AUTHOR.test(l) && !/^GitHub <noreply@github\.com>$/.test(l)))];
  for (const l of new Set(log)) scanText("git author", l);
  for (const b of bad) fail(`git history has a non-persona author/committer (${b.replace(/<.*>/, "<…>")})`);
} catch { /* no commits yet */ }

// 5. live: deployed pages + headers, and workers.dev must be unreachable
const live = process.argv.includes("--live");
let liveChecked = 0;
if (live) {
  const targets = existsSync("deploy/targets.json") ? JSON.parse(readFileSync("deploy/targets.json", "utf8")) : { pages: [], workers: [] };
  for (const url of targets.pages ?? []) {
    if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)?\.pages\.dev(\/|$)/.test(url)) fail(`${url}: public URLs must be *.pages.dev`);
    const res = await fetch(url, { redirect: "manual" }).catch((e) => ({ error: e }));
    if (res.error) { fail(`${url}: unreachable (${res.error.message})`); continue; }
    liveChecked++;
    scanText(`headers ${url}`, JSON.stringify([...res.headers]));
    const body = await res.text();
    scanText(`page ${url}`, body);
    const assets = [...body.matchAll(/(?:src|href)="(\/[^"#?]+\.(?:js|css|json|svg|txt|webmanifest))"/g)].map((m) => new URL(m[1], url).href);
    for (const a of [...new Set(assets)].slice(0, 60)) {
      const r = await fetch(a).catch(() => null);
      if (!r) continue;
      liveChecked++;
      scanText(`asset ${a}`, JSON.stringify([...r.headers]) + (await r.text()));
    }
  }
  // expected_gone: pages the studio took down on purpose (e.g. kiln-cdn-<name>). They must answer 4xx/5xx (404, or 52x once Cloudflare has no origin) or not resolve; a 2xx/3xx means the shutdown failed.
  for (const url of targets.expected_gone ?? []) {
    if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)?\.pages\.dev(\/|$)/.test(url)) { fail(`${url}: public URLs must be *.pages.dev`); continue; }
    const res = await fetch(url, { redirect: "manual" }).catch(() => null);
    liveChecked++;
    if (res && res.status < 400) fail(`${url}: expected gone but answers ${res.status}`);
  }
  for (const name of targets.workers ?? []) {
    const url = `https://${name}.${WORKERS_SUB}.workers.dev/`;
    const r = await fetch(url, { redirect: "manual" }).catch(() => null);
    liveChecked++;
    if (r && r.status >= 200 && r.status < 400) fail(`worker ${name}: answers on workers.dev (status ${r.status})`);
  }
}

const summary = `files=${files.length} built=${built} wrangler=${wranglerFiles.length} live=${live ? liveChecked : "skipped"}`;
if (failures.length) {
  process.stderr.write(`check-identity: FAIL (${failures.length}) ${summary}\n${failures.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`check-identity: ok ${summary}\n`);
