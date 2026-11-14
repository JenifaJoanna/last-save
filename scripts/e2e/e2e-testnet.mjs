#!/usr/bin/env node
// End-to-end testnet run of the whole Last Save lifecycle against one instance.
//   node scripts/e2e/e2e-testnet.mjs [--from <phase>] [--to <phase>] [--only <phase>] [--matches 2]
//        [--contract <id>] [--official-url <url>] [--official-worker <name>] [--ops <account>] [--direct] [--skip-bump] [--proof <file, appended to when it exists>]
// Env: CONTRACT, OFFICIAL_URL, OFFICIAL_WORKER (defaults: the live dev instance). Phases (letters work too):
//   a preflight  b buy  c play  d probe-alive  e report  | f kill  g death  h release  i choose  j post-death-buy  k host  l claim
// v2 instances (config.evm_payout present) add: a2 relayer-guards, a3 factory (both while Alive, spend nothing) and m evm-payout (after l).
// On v2 the holder actions (report_down, probe_official, release, choose) go through the gas-free relayer; --direct turns that off.
// Phases f-m end the instance's life. Each phase reads its state from the chain, so `--from <phase>` resumes a run.
// Writes proof/run-<UTC timestamp>.json (every tx hash, explorer link, readback and assertion).
import { pathToFileURL } from "node:url";
import { view } from "../lib/near.mjs";
import { Report } from "./report.mjs";
import { death, choose, kill, release } from "./phases-end.mjs";
import { evmPayout } from "./phases-evm.mjs";
import { claim, hostPhase, postDeathBuy } from "./phases-host.mjs";
import { factoryCheck, relayerGuards } from "./phases-v2.mjs";
import { buy, play, preflight, probeAlive, reportDown } from "./phases-live.mjs";
import { balance, fmtN, log, nowIso, sanitizePath } from "./util.mjs";

export const PHASES = [
  { id: "a", name: "preflight", title: "Alive, escrowed, verified, access keys", run: preflight },
  { id: "a2", name: "relayer-guards", title: "relayer refuses bad methods, deposits, receivers, signatures", run: relayerGuards, v2: true },
  { id: "a3", name: "factory", title: "factory lists the instance, global code, 0 keys", run: factoryCheck, v2: true },
  { id: "b", name: "buy", title: "four players buy a licence", run: buy },
  { id: "c", name: "play", title: "bots play, snapshot and attest", run: play },
  { id: "d", name: "probe-alive", title: "probe sees the live server", run: probeAlive },
  { id: "e", name: "report", title: "one report stays below quorum", run: reportDown },
  { id: "f", name: "kill", title: "official server deleted", run: kill },
  { id: "g", name: "death", title: "probes kill the game", run: death },
  { id: "h", name: "release", title: "key released and verified", run: release },
  { id: "i", name: "choose", title: "refund and pledge", run: choose },
  { id: "j", name: "post-death-buy", title: "fan buys into the pool", run: postDeathBuy },
  { id: "k", name: "host", title: "community host restores progress", run: hostPhase },
  { id: "l", name: "claim", title: "host claims an epoch", run: claim },
  { id: "m", name: "evm-payout", title: "claim pays ETH on Base Sepolia through chain signatures", run: evmPayout, v2: true },
];

const argOf = (argv, n) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined; };
const find = (key) => PHASES.findIndex((p) => p.id === key || p.name === key);

export function buildCtx(cfg = {}) {
  const stamp = nowIso().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const players = cfg.players ?? ["lastsave-mira", "lastsave-kofi", "lastsave-yuna", "lastsave-dario"].map((n) => `${n}.testnet`);
  const ctx = {
    contract: cfg.contract ?? process.env.CONTRACT ?? "lastsave-licence.testnet",
    officialUrl: (cfg.officialUrl ?? process.env.OFFICIAL_URL ?? "https://emberrift.pages.dev").replace(/\/$/, ""),
    officialWorker: cfg.officialWorker ?? process.env.OFFICIAL_WORKER ?? "emberrift-arena",
    players,
    // Pays for OutLayer-backed calls; a player whose balance is never asserted (kofi pledges, no refund delta)
    ops: cfg.ops ?? process.env.E2E_OPS ?? players[1],
    fanhost: cfg.fanhost ?? "lastsave-fanhost.testnet",
    kill: cfg.kill ?? null,
    gasless: cfg.gasless ?? false,
    opts: { matches: cfg.matches ?? 2, skipBump: cfg.skipBump ?? false },
    pool: null, hostPool: null, host: null,
  };
  ctx.report = new Report({ append: Boolean(cfg.proofFile), file: cfg.proofFile ?? `proof/run-${stamp}.json`, meta: { gasless: ctx.gasless, contract: ctx.contract, official_url: ctx.officialUrl, official_worker: ctx.officialWorker, players, ops: ctx.ops, fanhost: ctx.fanhost, network: "testnet" } });
  return ctx;
}

export function shutdown(ctx) {
  for (const p of [ctx.pool, ctx.hostPool]) { try { p?.stop(); } catch { /* closed */ } }
  try { ctx.host?.stop(); } catch { /* gone */ }
}

async function balances(ctx) {
  const ids = [...new Set([...ctx.players, ctx.fanhost, ctx.ops])];
  const out = {};
  for (const id of ids) out[id] = await balance(id);
  return out;
}

/** Runs phases [from..to]; stops at the first phase that errors (later phases depend on it). Returns the summary. */
export async function runPhases(ctx, { from = 0, to = PHASES.length - 1, only = null } = {}) {
  const sel = (only !== null ? [PHASES[only]] : PHASES.slice(from, to + 1)).filter((p) => !p.v2 || ctx.v2);
  const start = await balances(ctx);
  ctx.report.data.balances_start ??= Object.fromEntries(Object.entries(start).map(([k, v]) => [k, fmtN(v)]));
  const hooks = () => shutdown(ctx);
  process.once("SIGINT", () => { hooks(); process.exit(130); });
  for (const ph of sel) {
    ctx.report.phase(ph.name, ph.title);
    try { ctx.report.end(await ph.run(ctx) ?? undefined); }
    catch (e) {
      ctx.report.check("phase completed without an unexpected error", false, String(e?.message ?? e).slice(0, 300));
      ctx.report.end("error");
      break;
    }
    if (ph.name === "preflight" && ctx.report.cur.status !== "passed") break; // nothing else is meaningful on a bad instance
  }
  const end = await balances(ctx);
  const net = Object.keys(start).reduce((a, k) => a + (start[k] - end[k]), 0n);
  ctx.report.data.balances_end = Object.fromEntries(Object.entries(end).map(([k, v]) => [k, fmtN(v)]));
  ctx.report.data.net_cost_players_and_fanhost = fmtN(net);
  ctx.report.data.unenforced = ["spend cap (3 N) is only reported above, not blocked by code"];
  ctx.report.data.finished_at = nowIso();
  ctx.report.flush();
  shutdown(ctx);
  log(`net balance change across ${Object.keys(start).length} accounts: ${fmtN(net)} (money paid to the studio and the pool is included)`);
  return ctx.report.summary(PHASES);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  sanitizePath();
  const argv = process.argv.slice(2);
  const pick = (n, dflt) => { const k = argOf(argv, n); if (k === undefined) return dflt; const i = find(k); if (i < 0) { process.stderr.write(`unknown phase "${k}"\n`); process.exit(2); } return i; };
  const direct = argv.includes("--direct");
  const ctx = buildCtx({ proofFile: argOf(argv, "proof"), skipBump: argv.includes("--skip-bump"), contract: argOf(argv, "contract"), officialUrl: argOf(argv, "official-url"), officialWorker: argOf(argv, "official-worker"), ops: argOf(argv, "ops"), matches: Number(argOf(argv, "matches") ?? 2) });
  const only = argOf(argv, "only") ? pick("only") : null;
  const info = await view(ctx.contract, "get_info", {}).catch(() => null);
  if (!info) { process.stderr.write(`${ctx.contract} has no get_info; is it deployed?\n`); process.exit(2); }
  ctx.v2 = Boolean(info.config.evm_payout);
  ctx.gasless = ctx.v2 && !direct;
  ctx.report.data.gasless = ctx.gasless; ctx.report.data.v2 = ctx.v2;
  const summary = await runPhases(ctx, { from: pick("from", 0), to: pick("to", PHASES.length - 1), only });
  process.exit(summary.totals.failed > 0 || summary.totals.phases_failed > 0 ? 1 : 0);
}
