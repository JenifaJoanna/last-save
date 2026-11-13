// Phases a-e: everything that happens while the game is Alive. Nothing here ends the instance's life.
import { call, rpc, view } from "../lib/near.mjs";
import { BotPool } from "./bots.mjs";
import { getInfo, probeVerdict, untilLanded } from "./outlayer.mjs";
import { balance, failText, fmtN, getJson, log, refusedWith, sha256Hex, sleep } from "./util.mjs";

const decodeBlob = (b64) => JSON.parse(Buffer.from(b64, "base64").toString("utf8"));

/** Connects the four players to the official server (once per run; reconnects dropped sockets). */
export async function ensurePool(ctx) {
  if (ctx.pool?.bots.length) { await ctx.pool.revive(); return ctx.pool; }
  ctx.pool = await new BotPool({ baseUrl: ctx.officialUrl, hostId: "official", recipient: ctx.contract, accounts: ctx.players }).start();
  return ctx.pool;
}

export async function preflight(ctx) {
  const r = ctx.report;
  const info = await getInfo(ctx);
  r.check("status is Alive", info.status === "Alive", info.status);
  r.check("key is escrowed", info.escrowed);
  r.check("escrow verified by attest", info.escrow_verified, `attested_at_ms ${info.attested_at_ms ?? "none"}`);
  const keys = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: ctx.contract })).keys;
  r.read("contract_access_keys", keys.map((k) => ({ public_key: k.public_key, permission: k.access_key.permission === "FullAccess" ? "FullAccess" : "FunctionCall" })));
  r.read("contract_locked", keys.length === 0);
  r.read("config", { price: info.config.price, fund_bps: info.config.fund_bps, liveness: info.config.liveness, pool: info.config.pool, official_endpoint: info.config.official_endpoint, studio: info.config.studio });
  r.read("totals", info.totals);
  const price = BigInt(info.config.price);
  ctx.studio = info.config.studio;
  const health = await getJson(`${ctx.officialUrl}/health`).catch((e) => ({ ok: false, text: e.message }));
  r.check("official server answers /health", health.ok && health.body?.ok === true, health.ok ? `host ${health.body?.host_id}, build ${String(health.body?.build_hash).slice(0, 12)}` : health.text);
  r.check("official server runs the committed build", health.body?.build_hash === info.config.artifact.build_hash);
  const balances = {};
  for (const id of [...ctx.players, ctx.fanhost, ctx.studio]) balances[id] = fmtN(await balance(id));
  r.read("balances", balances);
  for (const id of ctx.players) {
    const lic = await view(ctx.contract, "licence_of", { account_id: id });
    const bal = await balance(id);
    r.check(`${id} can afford a licence or holds one`, lic !== null || bal >= price + 300_000_000_000_000_000_000_000n, `${fmtN(bal)}`);
  }
}

export async function buy(ctx) {
  const r = ctx.report;
  const info = await getInfo(ctx);
  const price = BigInt(info.config.price);
  const pot = (price * BigInt(info.config.fund_bps)) / 10000n;
  const studioBefore = await balance(info.config.studio);
  const supplyBefore = info.totals.supply, potBefore = BigInt(info.totals.pot_locked);
  let bought = 0n;
  for (const id of ctx.players) {
    let lic = await view(ctx.contract, "licence_of", { account_id: id });
    if (lic) { r.note(`${id} already holds licence ${lic.token_id}; not buying again`); }
    else {
      const before = await balance(id);
      const res = await call(id, ctx.contract, "buy_licence", {}, { gas: 60, deposit: price });
      r.tx(`buy_licence ${id}`, res);
      lic = await view(ctx.contract, "licence_of", { account_id: id });
      r.check(`${id} bought: tx succeeded`, !res.failure, failText(res).slice(0, 120));
      if (!res.failure) { bought += 1n; r.read(`spent ${id}`, fmtN(before - (await balance(id)))); }
    }
    r.check(`${id} holds a licence token`, lic?.owner_id === id, lic ? `token ${lic.token_id}` : "none");
    r.check(`${id} pot_share is 40% of the price`, lic && BigInt(lic.pot_share) === pot, lic ? `${fmtN(lic.pot_share)} of ${fmtN(price)}` : "none");
    r.read(`licence ${id}`, lic);
  }
  await sleep(4000);
  const after = await getInfo(ctx);
  if (bought > 0n) {
    r.check("supply rose by the number bought", after.totals.supply - supplyBefore === Number(bought), `${supplyBefore} -> ${after.totals.supply}`);
    r.check("locked pot rose by 40% of each price", BigInt(after.totals.pot_locked) - potBefore === pot * bought, `${fmtN(BigInt(after.totals.pot_locked) - potBefore)}`);
    const delta = (await balance(info.config.studio)) - studioBefore;
    const expected = (price - pot) * bought, tol = 20_000_000_000_000_000_000_000n * bought; // mint storage comes out of the studio share
    r.read("studio balance delta", `${fmtN(delta)} (expected ${fmtN(expected)} minus mint storage)`);
    r.check("studio received the rest (60% minus mint storage)", delta >= expected - tol && delta <= expected + tol / 2n, `${fmtN(delta)} vs ${fmtN(expected)}`);
  } else r.note("no new buys this run, studio delta not measured");
  r.read("totals after", after.totals);
}

export async function play(ctx) {
  const r = ctx.report;
  const profile = async (id) => (await getJson(`${ctx.officialUrl}/profile?account=${encodeURIComponent(id)}`)).body;
  const xpBefore = {};
  for (const id of ctx.players) xpBefore[id] = (await profile(id))?.xp ?? 0;
  const snapBefore = await view(ctx.contract, "get_snapshot", {});
  const pool = await ensurePool(ctx);
  const joined = await pool.joined();
  r.read("joined", joined.map((j) => ({ account: j.account, joined: j.joined, denied: j.denied })));
  r.check("all 4 players signed in (NEP-413 login accepted)", joined.every((j) => j.joined), joined.filter((j) => !j.joined).map((j) => `${j.account}:${j.denied}`).join(" "));
  const health = (await getJson(`${ctx.officialUrl}/health`)).body;
  r.check("/health shows 4 players online", health?.players_online === 4, `players_online ${health?.players_online}`);
  const want = ctx.opts.matches ?? 2;
  log(`  playing ${want} matches (a match is ~100 s); this takes a few minutes`);
  const counts = await pool.matches(want, (want * 110 + 120) * 1000);
  r.read("matches finished per bot", counts);
  r.check(`every bot finished ${want} matches`, Math.min(...counts) >= want, counts.join(", "));
  const xpAfter = {};
  for (const id of ctx.players) xpAfter[id] = (await profile(id))?.xp ?? 0;
  r.read("xp before", xpBefore); r.read("xp after", xpAfter);
  for (const id of ctx.players) r.check(`${id} xp increased`, xpAfter[id] > xpBefore[id], `${xpBefore[id]} -> ${xpAfter[id]}`);

  let snap = null;
  for (let i = 0; i < 30; i++) {
    snap = await view(ctx.contract, "get_snapshot", {});
    if (snap && snap.seq > (snapBefore?.seq ?? -1)) break;
    await sleep(3000);
  }
  r.check("on-chain snapshot seq increased", Boolean(snap) && snap.seq > (snapBefore?.seq ?? -1), `${snapBefore?.seq ?? "none"} -> ${snap?.seq ?? "none"}`);
  if (snap) {
    const blob = Buffer.from(snap.blob_base64, "base64");
    const body = decodeBlob(snap.blob_base64);
    r.check("snapshot hash matches its blob", sha256Hex(blob) === snap.hash);
    r.check("snapshot holds all 4 accounts", ctx.players.every((id) => body.players?.[id]), Object.keys(body.players ?? {}).join(", "));
    r.read("snapshot", { seq: snap.seq, hash: snap.hash, at_ms: snap.at_ms, players: body.players });
    ctx.lastSnapshot = body;
  }
  const now = Date.now();
  const att = await getJson(`${ctx.officialUrl}/attest?nonce=e2e${now.toString(16)}&host=official&from=${now - 180_000}&to=${now}`);
  const sessions = att.body?.sessions ?? [];
  r.check("/attest returns signed sessions", sessions.length > 0 && sessions.every((s) => s.login?.signature && s.receipt?.signature), `${sessions.length} sessions`);
  r.check("/attest sessions cover all 4 players", new Set(sessions.map((s) => s.receipt?.account_id)).size === 4, [...new Set(sessions.map((s) => s.receipt?.account_id))].join(", "));
  r.check("/attest echoes the nonce and the committed build", att.body?.build_hash === (await getInfo(ctx)).config.artifact.build_hash && String(att.body?.nonce).startsWith("e2e"));
}

export async function probeAlive(ctx) {
  const r = ctx.report;
  await ensurePool(ctx);
  await ctx.pool.joined();
  const before = await getInfo(ctx);
  const res = await untilLanded(ctx, { label: "probe_official", signer: ctx.ops, method: "probe_official", args: {}, verdict: probeVerdict, terminal: /already ended/i });
  r.read("attempts", res.attempts);
  r.check("a conclusive probe landed", res.conclusive, `${res.attempts.length} attempt(s), ${res.attempts.filter((a) => a.outcome === "inconclusive").length} inconclusive`);
  const after = await getInfo(ctx);
  r.check("consecutive_failures is 0", after.probe.consecutive_failures === 0, String(after.probe.consecutive_failures));
  r.check("last_alive_ms updated", after.probe.last_alive_ms !== null && after.probe.last_alive_ms !== before.probe.last_alive_ms, `${before.probe.last_alive_ms ?? "none"} -> ${after.probe.last_alive_ms}`);
  r.check("status still Alive", after.status === "Alive");
  r.read("activity", await view(ctx.contract, "get_activity", { limit: 4 }));
}

export async function reportDown(ctx) {
  const r = ctx.report;
  const holder = ctx.players[0];
  const lic = await view(ctx.contract, "licence_of", { account_id: holder });
  const before = await getInfo(ctx);
  const first = await call(holder, ctx.contract, "report_down", { token_id: lic.token_id }, { gas: 50 });
  r.tx(`report_down ${holder}`, first);
  const already = refusedWith(first, /Already reported/);
  if (already) r.note("this token had already reported inside the window (resumed run)");
  else r.check("report_down accepted", !first.failure, failText(first).slice(0, 120));
  const mid = await getInfo(ctx);
  r.read("reports", { in_window: mid.reports_in_window, needed: mid.reports_needed });
  r.check("one report is below quorum", mid.reports_in_window >= 1 && mid.reports_in_window < mid.reports_needed, `${mid.reports_in_window} of ${mid.reports_needed}`);
  r.check("game is still Alive", mid.status === "Alive");
  r.check("report counted", already || mid.reports_in_window === before.reports_in_window + 1, `${before.reports_in_window} -> ${mid.reports_in_window}`);
  const second = await call(holder, ctx.contract, "report_down", { token_id: lic.token_id }, { gas: 50 });
  r.tx(`report_down again ${holder}`, second);
  r.check("same token reporting again in the window is refused", refusedWith(second, /Already reported/), failText(second).slice(0, 120));
  r.check("refused report did not change the count", (await getInfo(ctx)).reports_in_window === mid.reports_in_window);
}
