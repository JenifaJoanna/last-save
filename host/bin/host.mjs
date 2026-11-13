#!/usr/bin/env node
// Last Save fan host: pnpm host [--local | --deploy <name>] [--claim] [--account <id>] [--contract <id>]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { claimableEpochs } from "../lib/claims.mjs";
import { prepare } from "../lib/prepare.mjs";
import { Refusal } from "../lib/refusal.mjs";

const hostRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (s) => process.stdout.write(`${s}\n`);
const err = (s) => process.stderr.write(`${s}\n`);
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const multi = (n) => argv.flatMap((a, i) => (a === `--${n}` && argv[i + 1] ? [argv[i + 1]] : []));

if (flag("help") || flag("h")) {
  out(`Last Save fan host
  pnpm host --local                  verify, unpack, run locally behind a cloudflared tunnel, register on chain
  pnpm host --deploy <name>          same, but deploy to Cloudflare (needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)
  pnpm host --prepare-only           verify and unpack only (no server, no transactions)
  --claim                            keep claiming completed epochs while serving
  --account <id>   host account (default lastsave-fanhost.testnet, env LASTSAVE_HOST_ACCOUNT)
  --contract <id>  licence contract (default lastsave-licence.testnet, env LICENCE_CONTRACT)
  --mirror <url>   extra artifact mirror (repeatable)   --port <n>  local port   --no-register  skip register_host`);
  process.exit(0);
}

const account = opt("account", process.env.LASTSAVE_HOST_ACCOUNT ?? "lastsave-fanhost.testnet");
const contract = opt("contract", process.env.LICENCE_CONTRACT ?? "lastsave-licence.testnet");
const deployName = opt("deploy");
const mode = flag("prepare-only") ? "prepare" : deployName ? "deploy" : "local";
if (flag("deploy") && !deployName) { err("--deploy needs a project name"); process.exit(2); }
const log = (s) => out(`  ${s}`);

try {
  const { chainFor, registerHost, claimEpoch } = await import("../lib/chain.mjs");
  const chain = chainFor(contract);
  out(`Last Save host for ${account} on ${contract}`);
  const prep = await prepare({ chain, workDir: opt("work-dir", join(hostRoot, ".host")), extraMirrors: multi("mirror"), log });
  out(`Verified build ${prep.buildHash}${prep.restore ? `, restoring progress snapshot #${prep.restore.seq}` : ", no snapshot on chain (fresh start)"}`);
  if (mode === "prepare") { out(`Unpacked to ${prep.dir}`); process.exit(0); }

  const { hostVars, serveLocal, serveDeploy } = await import("../lib/serve.mjs");
  const vars = hostVars({ account, buildHash: prep.buildHash, contract, rpcUrls: process.env.NEAR_RPCS });
  const server = mode === "deploy"
    ? await serveDeploy({ dir: prep.dir, name: deployName, vars, restore: prep.restore, log })
    : await serveLocal({ dir: prep.dir, vars, restore: prep.restore, port: opt("port") ? Number(opt("port")) : undefined, log });
  out(`Serving at ${server.endpoint}`);

  if (!flag("no-register")) {
    const r = await registerHost({ account, contract, endpoint: server.endpoint });
    out(`register_host: ${r.url}${r.failure ? `\n  FAILED: ${JSON.stringify(r.failure).slice(0, 300)}` : ""}`);
    if (r.failure) { server.stop(); process.exit(1); }
  }

  const stop = () => { out("Stopping."); server.stop(); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);

  if (flag("claim")) {
    out("Claiming completed epochs every 30 s while serving (Ctrl+C to stop).");
    const tried = new Set();
    for (;;) {
      try {
        const [info, claims] = await Promise.all([chain.info(), chain.claims()]);
        for (const epoch of claimableEpochs({ info, claims, account }).filter((e) => !tried.has(e))) {
          tried.add(epoch);
          const r = await claimEpoch({ account, contract, epoch });
          out(`claim_epoch(${epoch}): ${r.url}${r.failure ? `\n  FAILED: ${JSON.stringify(r.failure).slice(0, 300)}` : ""}`);
        }
      } catch (e) { err(`claim pass failed: ${e.message}`); }
      await new Promise((r) => setTimeout(r, 30_000));
    }
  } else {
    out("Hosting. Press Ctrl+C to stop.");
    await new Promise(() => {});
  }
} catch (e) {
  if (e instanceof Refusal) { err(`REFUSED (${e.code}): ${e.message}`); process.exit(3); }
  err(`host failed: ${e.message}`);
  process.exit(1);
}
