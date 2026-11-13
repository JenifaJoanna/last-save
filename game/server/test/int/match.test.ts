// Full matches on a real local Worker (wrangler dev) with a fake RPC. TIME_SCALE=15 compresses a 90 s match to about 6 s.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2";
import bs58 from "bs58";
import { generateSessionKey, fromBase64, toHex, utf8 } from "../../../shared/auth";
import { levelFor, skinFor } from "../../../shared/sim";
import { startDev, type Dev } from "../helpers/wrangler";
import { baseVars, fixture, getJson, join } from "../helpers/world";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pjoin } from "node:path";

const near = createRequire(import.meta.url)("near-api-js");
type Fx = Awaited<ReturnType<typeof fixture>>;
const open: any[] = [];
const track = <T>(b: T): T => { open.push(b); return b; };
const studio = generateSessionKey();

describe("one pilot alone, persistence and snapshots", () => {
  let fx: Fx, dev: Dev, persist: string;
  beforeAll(async () => {
    fx = await fixture(1);
    fx.rpc.allow("lastsave-studio.testnet", studio.public);
    persist = mkdtempSync(pjoin(tmpdir(), "lastsave-persist-"));
    dev = await startDev(baseVars(fx.rpc, { TIME_SCALE: "15", SNAPSHOT_SIGNER: studio.secret }), { persist });
  });
  afterAll(async () => { open.forEach((b) => b.close()); await dev?.stop(); await fx?.rpc.stop(); if (persist) rmSync(persist, { recursive: true, force: true }); });

  it("runs a 1-player match to results, persists xp, and posts a snapshot", async () => {
    const bot = track(await join(dev.wsUrl, fx.pilots[0]));
    expect(bot.denied).toBeNull();
    expect(bot.welcome).toMatchObject({ host_id: "official", epoch: null, tick_hz: 30, you: { level: 1, xp: 0, skin: "standard", matches: 0 } });
    await bot.waitFor((b: any) => b.results.length >= 1, 30_000, "results");
    const msg = bot.results[0];
    expect(msg.results).toHaveLength(1);
    const r = msg.results[0];
    expect(r).toMatchObject({ account_id: fx.pilots[0].account, place: 1, level_before: 1 });
    expect(r.xp_gained).toBeGreaterThanOrEqual(110);
    expect(msg.snapshot_seq).toBe(1);
    await bot.waitFor((b: any) => b.profile.matches === 1, 5000, "profile message");
    expect(bot.profile.xp).toBe(r.xp_gained);
    const p = await getJson(`${dev.url}/profile?account=${fx.pilots[0].account}`);
    expect(p).toMatchObject({ account_id: fx.pilots[0].account, xp: r.xp_gained, matches: 1 });

    // the snapshot reached the chain as a signed post_snapshot transaction
    for (let i = 0; i < 40 && !fx.rpc.sentTxs.length; i++) await new Promise((res) => setTimeout(res, 100));
    expect(fx.rpc.sentTxs).toHaveLength(1);
    const signed = near.transactions.SignedTransaction.decode(Buffer.from(fx.rpc.sentTxs[0], "base64"));
    expect(signed.transaction.signerId).toBe("lastsave-studio.testnet");
    expect(`ed25519:${bs58.encode(signed.transaction.publicKey.ed25519Key.data)}`).toBe(studio.public);
    const fc = signed.transaction.actions[0].functionCall;
    expect(fc.methodName).toBe("post_snapshot");
    const args = JSON.parse(Buffer.from(fc.args).toString());
    expect(args.seq).toBe(1);
    const blob = fromBase64(args.blob_base64);
    expect(toHex(sha256(blob))).toBe(args.hash);
    expect(JSON.parse(utf8.decode(blob)).players[fx.pilots[0].account]).toMatchObject({ xp: r.xp_gained, matches: 1, level: levelFor(r.xp_gained), skin: skinFor(levelFor(r.xp_gained)) });
    expect(ed25519.verify(Uint8Array.from(signed.signature.ed25519Signature.data), sha256(near.utils.serialize.serialize(near.transactions.SCHEMA.Transaction, signed.transaction)),
      ed25519.getPublicKey(bs58.decode(studio.secret.slice(8)).slice(0, 32)))).toBe(true);
  });

  it("keeps progress across a server restart", async () => {
    const before = await getJson(`${dev.url}/profile?account=${fx.pilots[0].account}`);
    const vars = baseVars(fx.rpc, { TIME_SCALE: "15" });
    await dev.stop();
    dev = await startDev(vars, { persist });
    expect(await getJson(`${dev.url}/profile?account=${fx.pilots[0].account}`)).toEqual(before);
  });
});

describe("four pilots, late join and progress across matches", () => {
  let fx: Fx, dev: Dev;
  beforeAll(async () => {
    fx = await fixture(5);
    dev = await startDev(baseVars(fx.rpc, { TIME_SCALE: "15" }));
  });
  afterAll(async () => { open.forEach((b) => b.close()); await dev?.stop(); await fx?.rpc.stop(); });

  it("puts four clients in one match, accepts a late joiner, and persists two matches", { timeout: 120_000 }, async () => {
    const four = [];
    for (const p of fx.pilots.slice(0, 4)) four.push(track(await join(dev.wsUrl, p)));
    for (const b of four) expect(b.denied).toBeNull();
    await four[0].waitFor((b: any) => b.snap?.ships.length === 4, 10_000, "four ships");
    const slots = new Set(four[0].snap.ships.map((s: any) => s.slot));
    expect(slots.size).toBe(4);

    const late = track(await join(dev.wsUrl, fx.pilots[4]));
    expect(late.denied).toBeNull();
    await late.waitFor((b: any) => b.snap?.ships.length === 5, 10_000, "late joiner sees five ships");
    expect(late.snap.phase).toMatch(/countdown|live|results/);

    for (const b of [...four, late]) await b.waitFor((x: any) => x.results.length >= 2, 60_000, "two matches");
    const first = four[0].results[0], second = four[0].results[1];
    expect(first.match_id).not.toBe(second.match_id);
    expect(first.results.length).toBeGreaterThanOrEqual(4);
    const sameOnAll = four.every((b: any) => b.results[0].match_id === first.match_id);
    expect(sameOnAll).toBe(true);

    const mira = fx.pilots[0].account;
    const r1 = first.results.find((r: any) => r.account_id === mira), r2 = second.results.find((r: any) => r.account_id === mira);
    expect(r1.level_before).toBe(1);
    expect(r2.level_before).toBe(r1.level_after);
    await new Promise((res) => setTimeout(res, 300));
    const p = await getJson(`${dev.url}/profile?account=${mira}`);
    const extra = four[0].results.length > 2 ? four[0].results.slice(2).reduce((n: number, m: any) => n + (m.results.find((r: any) => r.account_id === mira)?.xp_gained ?? 0), 0) : 0;
    expect(p.xp).toBeGreaterThanOrEqual(r1.xp_gained + r2.xp_gained);
    expect(p.xp).toBeLessThanOrEqual(r1.xp_gained + r2.xp_gained + extra + 400);
    expect(p.matches).toBeGreaterThanOrEqual(2);
    // level and skin on the ship come from the stored profile
    const ship = four[0].snap.ships.find((s: any) => s.id === mira);
    expect(ship.level).toBe(p.level);
    expect(ship.skin).toBe(p.skin);
  });
});
