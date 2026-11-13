// Phases j-l: after death. A fan buys into the pool, hosts the game, players return with their progress, the host is paid.
import { unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { call, createSubAccount, deleteAccount, NETWORK, view } from "../lib/near.mjs";
import { BotPool } from "./bots.mjs";
import { startHost } from "./hostproc.mjs";
import { getInfo, untilLanded } from "./outlayer.mjs";
import { balance, failText, fmtN, getJson, log, refusedWith, sleep } from "./util.mjs";

export async function postDeathBuy(ctx) {
  const r = ctx.report;
  const info = await getInfo(ctx);
  const price = BigInt(info.config.price);
  r.check("game is Dead before the post-death buy", info.status === "Dead", info.status);
  let lic = await view(ctx.contract, "licence_of", { account_id: ctx.fanhost });
  if (lic) r.note(`${ctx.fanhost} already holds licence ${lic.token_id}; not buying again`);
  else {
    const res = await call(ctx.fanhost, ctx.contract, "buy_licence", {}, { gas: 60, deposit: price });
    r.tx(`buy_licence ${ctx.fanhost}`, res);
    r.check("post-death buy accepted", !res.failure, failText(res).slice(0, 120));
    await sleep(3000);
    const after = await getInfo(ctx);
    const poolDelta = BigInt(after.totals.pool) - BigInt(info.totals.pool);
    r.check("pool rose by the price minus mint storage", poolDelta <= price && poolDelta >= price - 20_000_000_000_000_000_000_000n, `${fmtN(poolDelta)} of ${fmtN(price)}`);
    r.check("locked pot unchanged", BigInt(after.totals.pot_locked) === BigInt(info.totals.pot_locked));
    r.check("live supply unchanged (a post-death token is not a live holder)", after.totals.live_supply === info.totals.live_supply, `${info.totals.live_supply} -> ${after.totals.live_supply}`);
    lic = await view(ctx.contract, "licence_of", { account_id: ctx.fanhost });
  }
  r.check("token minted to the fan", lic?.owner_id === ctx.fanhost, lic ? `token ${lic.token_id}` : "none");
  r.check("pot_share is 0 and the token is post_death", lic && BigInt(lic.pot_share) === 0n && lic.post_death === true);
  const ch = await call(ctx.fanhost, ctx.contract, "choose", { token_id: lic.token_id, choice: "Refund" }, { gas: 60 });
  r.tx("choose (must be refused)", ch);
  r.check("a post-death licence cannot choose", refusedWith(ch, /no locked share/), failText(ch).slice(0, 120));
}

/** Starts the fan host (once) and signs the four players in to it. */
export async function ensureHostBots(ctx) {
  if (!ctx.host || ctx.host.exited) {
    ctx.host = await startHost(ctx);
    ctx.report.tx("register_host", { hash: ctx.host.registerHash, url: ctx.host.registerUrl, failure: null });
  }
  if (ctx.hostPool?.bots.length) { await ctx.hostPool.revive(); return ctx.hostPool; }
  ctx.hostPool = await new BotPool({ baseUrl: ctx.host.endpoint, hostId: ctx.fanhost, recipient: ctx.contract, accounts: ctx.players }).start();
  const joined = await ctx.hostPool.joined(30_000);
  ctx.hostEpoch0 = Math.min(...joined.map((j) => j.epoch).filter((e) => Number.isFinite(e)));
  return ctx.hostPool;
}

export async function hostPhase(ctx) {
  const r = ctx.report;
  const snap = await view(ctx.contract, "get_snapshot", {});
  r.check("an on-chain snapshot exists to restore", Boolean(snap), snap ? `seq ${snap.seq}` : "none");
  const body = snap ? JSON.parse(Buffer.from(snap.blob_base64, "base64").toString("utf8")) : { players: {} };
  const pool = await ensureHostBots(ctx);
  const hosts = await view(ctx.contract, "get_hosts", {});
  const me = hosts.find((h) => h.host_id === ctx.fanhost);
  r.check("host registered on chain with its endpoint", me?.endpoint === ctx.host.endpoint, me?.endpoint ?? "not registered");
  r.read("host", { endpoint: ctx.host.endpoint, registered_at_ms: me?.registered_at_ms, epoch_at_join: ctx.hostEpoch0 });
  const joined = await pool.joined(30_000);
  r.check("all 4 players signed in to the community host", joined.every((j) => j.joined), joined.filter((j) => !j.joined).map((j) => `${j.account}:${j.denied}`).join(" "));
  const restored = {};
  for (const id of ctx.players) {
    const want = body.players[id];
    const p = (await getJson(`${ctx.host.endpoint}/profile?account=${encodeURIComponent(id)}`)).body;
    restored[id] = { snapshot: want ? { level: want.level, xp: want.xp } : null, host: p ? { level: p.level, xp: p.xp } : null };
    r.check(`${id} progress restored (same level and xp as the last on-chain snapshot)`, Boolean(want && p) && p.level === want.level && p.xp === want.xp,
      `snapshot ${want?.level}/${want?.xp} vs host ${p?.level}/${p?.xp}`);
  }
  r.read("restored", restored);
  r.check("snapshot-restored xp is above the 0 of a fresh server", ctx.players.some((id) => (body.players[id]?.xp ?? 0) > 0));
  await denyNonHolder(ctx);
}

async function denyNonHolder(ctx) {
  const r = ctx.report;
  const id = `e2e-nl-${Date.now().toString(36)}.${ctx.fanhost}`;
  let created = false;
  try {
    const c = await createSubAccount(ctx.fanhost, id, "0.05");
    created = true;
    r.tx(`create throwaway ${id}`, c);
    await sleep(4000);
    const nl = await new BotPool({ baseUrl: ctx.host.endpoint, hostId: ctx.fanhost, recipient: ctx.contract, accounts: [id] }).start();
    const res = (await nl.joined(20_000))[0];
    nl.stop();
    r.check("a non-holder is denied with no_licence", res.denied === "no_licence", `joined ${res.joined}, denied ${res.denied}`);
  } catch (e) {
    r.check("a non-holder is denied with no_licence", false, String(e.message).slice(0, 200));
  } finally {
    if (created) {
      try {
        const d = await deleteAccount(id, ctx.fanhost);
        r.tx(`delete throwaway ${id}`, d);
        const dir = process.env.LASTSAVE_KEYS_DIR ?? join(homedir(), ".near-credentials");
        try { unlinkSync(join(dir, NETWORK, `${id}.json`)); } catch { /* no key file */ }
      } catch (e) { r.note(`throwaway ${id} not deleted: ${String(e.message).slice(0, 120)}`); }
    }
  }
}

export async function claim(ctx) {
  const r = ctx.report;
  const pool = await ensureHostBots(ctx);
  const info0 = await getInfo(ctx);
  const first = Number.isFinite(ctx.hostEpoch0) ? ctx.hostEpoch0 : info0.current_epoch;
  const epochMs = info0.config.pool.epoch_ms;
  r.read("epoch_ms", epochMs);
  const claimsOf = async () => (await view(ctx.contract, "get_claims", { from_index: 0, limit: 200 })).filter((c) => c.host_id === ctx.fanhost);
  let paid = null, epoch = null;
  for (const candidate of [first, first + 1]) {
    log(`  waiting for epoch ${candidate} to complete (bots stay connected to the host)`);
    for (let i = 0; i < 150; i++) {
      const cur = (await getInfo(ctx)).current_epoch;
      if (cur !== null && cur > candidate) break;
      await pool.revive();
      await sleep(5000);
    }
    const poolBefore = BigInt((await getInfo(ctx)).totals.pool);
    const res = await untilLanded(ctx, {
      label: `claim_epoch ${candidate}`, signer: ctx.fanhost, method: "claim_epoch", args: { epoch: candidate }, maxAttempts: 6, terminal: /already paid/i,
      verdict: async () => {
        const c = (await claimsOf()).find((x) => x.epoch === candidate);
        const act = (await view(ctx.contract, "get_activity", { limit: 1 }))[0];
        return { conclusive: Boolean(c), detail: c ? `paid ${fmtN(c.paid)}, ${c.verified} verified` : `${act?.outcome ?? "?"}: ${act?.detail ?? ""}` };
      },
    });
    r.read(`attempts epoch ${candidate}`, res.attempts);
    const rec = (await claimsOf()).find((x) => x.epoch === candidate);
    if (rec) { paid = { rec, poolBefore }; epoch = candidate; break; }
    r.note(`epoch ${candidate} produced no payment; trying the next epoch`);
  }
  r.check("claim_epoch landed for a completed epoch", Boolean(paid), `epoch ${epoch ?? "none"}`);
  if (paid) {
    const after = await getInfo(ctx);
    const host = (await view(ctx.contract, "get_hosts", {})).find((h) => h.host_id === ctx.fanhost);
    r.check("host was paid more than 0", BigInt(paid.rec.paid) > 0n, fmtN(paid.rec.paid));
    r.check("at least one verified session behind the claim", paid.rec.verified >= 1, String(paid.rec.verified));
    r.check("host earned total matches the claim", BigInt(host.earned) >= BigInt(paid.rec.paid) && host.epochs_paid >= 1, `earned ${fmtN(host.earned)}, epochs_paid ${host.epochs_paid}`);
    r.check("pool decreased", BigInt(after.totals.pool) < paid.poolBefore, `${fmtN(paid.poolBefore)} -> ${fmtN(after.totals.pool)}`);
    r.check("paid_out total rose", BigInt(after.totals.paid_out) >= BigInt(paid.rec.paid), fmtN(after.totals.paid_out));
    const again = await call(ctx.fanhost, ctx.contract, "claim_epoch", { epoch }, { gas: 300, deposit: "0.02" });
    r.tx(`claim_epoch ${epoch} again`, again);
    r.check("a second claim of the same epoch is refused", refusedWith(again, /already paid/i), failText(again).slice(0, 120));
    r.read("claim", { epoch, ...paid.rec });
  }
}
