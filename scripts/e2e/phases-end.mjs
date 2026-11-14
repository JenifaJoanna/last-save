// Phases f-i: the official server dies, the contract notices, the key is released, holders choose.
// These end the instance's life as a live game; run them only against an instance meant to die.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { view } from "../lib/near.mjs";
import { act, assertGasless, assertOpsGasless } from "./relayed.mjs";
import { getInfo, probeVerdict, untilLanded } from "./outlayer.mjs";
import { balance, failText, fmtN, getJson, log, readEnvFile, refusedWith, sha256Hex, sleep } from "./util.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const wrangler = join(root, "game", "server", "node_modules", "wrangler", "bin", "wrangler.js");

/** Deletes the official Worker. CLOUDFLARE_* come from the repo's .env.local into the child env only and are never printed. */
export async function deleteWorker(ctx) {
  const env = await readEnvFile(join(root, ".env.local"));
  const childEnv = { ...process.env, WRANGLER_SEND_METRICS: "false" };
  for (const k of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) if (env[k]) childEnv[k] = env[k];
  if (!childEnv.CLOUDFLARE_API_TOKEN || !childEnv.CLOUDFLARE_ACCOUNT_ID) throw new Error("CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID missing from .env.local");
  const cwd = join(root, "local", "e2e");
  mkdirSync(cwd, { recursive: true });
  const code = await new Promise((resolve) => {
    let tail = "";
    const p = spawn(process.execPath, [wrangler, "delete", ctx.officialWorker, "--force"], { cwd, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
    for (const s of [p.stdout, p.stderr]) s.on("data", (d) => { tail = (tail + d).slice(-400); });
    p.on("exit", (c) => { if (c !== 0) log(`  wrangler delete exited ${c}: ${tail.replace(/\s+/g, " ")}`); resolve(c); });
  });
  if (code !== 0) throw new Error(`wrangler delete ${ctx.officialWorker} failed (exit ${code})`);
  return `deleted Worker ${ctx.officialWorker} through wrangler`;
}

export async function kill(ctx) {
  const r = ctx.report;
  ctx.pool?.stop();
  ctx.pool = null;
  r.note("bots stopped");
  const how = await (ctx.kill ?? deleteWorker)(ctx);
  r.read("kill", how);
  let down = false, last = "";
  for (let i = 0; i < 24 && !down; i++) {
    try {
      const h = await getJson(`${ctx.officialUrl}/health`, 6000);
      last = `HTTP ${h.status}`;
      down = !(h.ok && h.body?.ok === true);
    } catch (e) { last = `no answer (${String(e.message).slice(0, 60)})`; down = true; }
    if (!down) await sleep(5000);
  }
  r.check("official /health now fails", down, last);
  r.read("killed_at", new Date().toISOString());
}

export async function death(ctx) {
  const r = ctx.report;
  const start = await getInfo(ctx);
  const { probe_interval_ms: interval, fail_threshold: threshold } = start.config.liveness;
  const rounds = [], allAttempts = [];
  for (let round = 1; round <= 10; round++) {
    const info = await getInfo(ctx);
    if (info.status === "Dead") break;
    const res = await untilLanded(ctx, {
      label: `probe_official r${round}`, signer: ctx.ops, method: "probe_official", args: {}, verdict: probeVerdict, terminal: /already ended/i, maxAttempts: 12,
      gate: async () => { // a failure counts only if spaced probe_interval after the last one
        const t = (await getInfo(ctx)).probe.last_probe_ms;
        const wait = t ? t + interval + 4000 - Date.now() : 0;
        if (wait > 0) { log(`  waiting ${Math.ceil(wait / 1000)} s so the next failure is spaced by probe_interval`); await sleep(wait); }
      },
    });
    allAttempts.push(...res.attempts);
    const after = await getInfo(ctx);
    rounds.push({ round, conclusive: res.conclusive, attempts: res.attempts.map((a) => a.outcome), consecutive_failures: after.probe.consecutive_failures, status: after.status });
    log(`  round ${round}: failures ${after.probe.consecutive_failures}/${threshold}, status ${after.status}`);
    if (res.terminal || !res.conclusive) break;
  }
  r.read("rounds", rounds);
  const end = await getInfo(ctx);
  assertOpsGasless(r, "death probes", { attempts: allAttempts }, ctx.ops, start.totals.ops_budget, end.totals.ops_budget);
  r.check("status is Dead", end.status === "Dead", end.status);
  r.check('cause is "probes"', end.cause === "probes", String(end.cause));
  r.check("died_at_ms is set", Number.isFinite(end.died_at_ms), String(end.died_at_ms));
  r.check(`consecutive_failures reached ${threshold}`, end.probe.consecutive_failures >= threshold, String(end.probe.consecutive_failures));
  r.read("inconclusive_attempts_ignored", rounds.flatMap((x) => x.attempts).filter((o) => o === "inconclusive").length);
  r.read("activity", await view(ctx.contract, "get_activity", { limit: 8 }));
}

export async function release(ctx) {
  const r = ctx.report;
  const info = await getInfo(ctx);
  if (info.released_key) r.note("key already released, verifying only");
  else {
    const res = await untilLanded(ctx, {
      label: "release", signer: ctx.ops, method: "release", args: {}, maxAttempts: 14, terminal: /already released/i, fallbackAfter: 5, pauseMs: 15000,
      verdict: (_b, a) => ({ conclusive: Boolean(a.released_key), detail: a.release.last_error ?? "key stored" }),
    });
    r.read("attempts", res.attempts);
    assertOpsGasless(r, "release", res, ctx.ops, info.totals.ops_budget, (await getInfo(ctx)).totals.ops_budget);
    r.check("release landed (conclusive)", res.conclusive || Boolean((await getInfo(ctx)).released_key), `${res.attempts.length} attempt(s)`);
  }
  const after = await getInfo(ctx);
  const key = after.released_key;
  // Public on chain once released; recorded in full so the proof (and the film) can show it without another RPC read.
  if (key) { r.read("released_key", key); r.read("released_at_ms", after.released_at_ms); }
  r.check("released_key is public on chain", Boolean(key) && /^[0-9a-f]{64}$/.test(key));
  if (key) r.check("sha256(K) equals key_commitment", sha256Hex(Buffer.from(key, "hex")) === after.config.key_commitment, `commitment ${after.config.key_commitment.slice(0, 12)}...`);
  r.check("released_at_ms is set", Number.isFinite(after.released_at_ms), String(after.released_at_ms));
}

export async function choose(ctx) {
  const r = ctx.report;
  const plan = [[ctx.players[2], "Refund"], [ctx.players[3], "Refund"], [ctx.players[0], "Pledge"], [ctx.players[1], "Pledge"]];
  for (const [id, choice] of plan) {
    const lic = await view(ctx.contract, "licence_of", { account_id: id });
    const pot = BigInt(lic.pot_share);
    if (lic.choice) { r.note(`${id} already chose ${lic.choice}`); continue; }
    const before = await getInfo(ctx), bal = await balance(id);
    const res = await act(ctx, id, "choose", { token_id: lic.token_id, choice }, { gas: 60 });
    r.tx(`choose ${choice} ${id}`, res);
    r.check(`${id} ${choice} accepted`, !res.failure, failText(res).slice(0, 120));
    await sleep(2500);
    await assertGasless(r, `choose ${choice}`, res, id, bal, choice === "Refund" ? pot : 0n);
    await sleep(2500);
    const after = await getInfo(ctx), balAfter = await balance(id);
    const rec = await view(ctx.contract, "licence_of", { account_id: id });
    r.check(`${id} choice recorded as ${choice}`, rec.choice === choice, String(rec.choice));
    if (choice === "Refund") {
      const delta = balAfter - bal;
      r.check(`${id} balance rose by about the pot share`, delta <= pot && delta >= pot - 10_000_000_000_000_000_000_000n, `${fmtN(delta)} vs ${fmtN(pot)} (gas tolerance 0.01 N; exact when gas-free)`);
      r.check("refunded total rose", BigInt(after.totals.refunded) - BigInt(before.totals.refunded) === pot);
    } else {
      r.check(`${id} pledge moved the pot share into the pool`, BigInt(after.totals.pool) - BigInt(before.totals.pool) === pot, `${fmtN(BigInt(after.totals.pool) - BigInt(before.totals.pool))} vs ${fmtN(pot)}`);
      r.check("pledged total rose", BigInt(after.totals.pledged) - BigInt(before.totals.pledged) === pot);
    }
  }
  for (const id of [ctx.players[0], ctx.players[2]]) {
    const lic = await view(ctx.contract, "licence_of", { account_id: id });
    const again = await act(ctx, id, "choose", { token_id: lic.token_id, choice: lic.choice === "Refund" ? "Pledge" : "Refund" }, { gas: 60 });
    r.tx(`choose again ${id}`, again);
    r.check(`a second choose on ${id}'s token is refused`, refusedWith(again, /Choice already made/), failText(again).slice(0, 120));
  }
  const end = await getInfo(ctx);
  r.read("pot_locked after", fmtN(end.totals.pot_locked));
  r.read("totals", end.totals);
}
