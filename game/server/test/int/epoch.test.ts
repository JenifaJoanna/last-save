// Fan-host behaviour: epoch from get_info, epoch-scoped attest, snapshot restore and refusal.
import { afterAll, describe, expect, it } from "vitest";
import { parseLoginMessage, verifyLoginSignature, verifyReceipt, toBase64, utf8 } from "../../../shared/auth";
import { buildSnapshot } from "../../src/snapshot";
import { startDev, type Dev } from "../helpers/wrangler";
import { baseVars, fixture, getJson, join } from "../helpers/world";

const HOST = "lastsave-fanhost.testnet";
const stops: (() => Promise<void>)[] = [];
afterAll(async () => { for (const s of stops) await s(); });

const snapshot = () => buildSnapshot({ at_ms: 1_800_000_000_000, game: "ember-rift", seq: 12,
  players: { "lastsave-mira.testnet": { kos: 9, level: 3, matches: 6, shards: 88, skin: "emberwing", xp: 530 } } });

describe("fan host", () => {
  it("reports the epoch, stamps receipts with it, and restores a verified snapshot", { timeout: 90_000 }, async () => {
    const fx = await fixture(2);
    fx.rpc.info = { released_at_ms: Date.now() - 250_000, pool: { epoch_ms: 120_000 } };
    const snap = snapshot();
    const dev: Dev = await startDev(baseVars(fx.rpc, { HOST_ID: HOST, RESTORE_SNAPSHOT: JSON.stringify({ seq: 12, hash: snap.hash, blob_base64: snap.blobBase64 }) }));
    stops.push(async () => { await dev.stop(); await fx.rpc.stop(); });

    expect(await getJson(`${dev.url}/profile?account=lastsave-mira.testnet`)).toEqual({ account_id: "lastsave-mira.testnet", level: 3, xp: 530, skin: "emberwing", matches: 6 });
    const bot = await join(dev.wsUrl, fx.pilots[0], { hostId: HOST });
    expect(bot.denied).toBeNull();
    expect(bot.welcome).toMatchObject({ host_id: HOST, epoch: 2, you: { level: 3, skin: "emberwing" } });
    await bot.waitFor((b: any) => b.receipts >= 1, 5000, "receipt request");
    await new Promise((r) => setTimeout(r, 400));

    const now = Date.now();
    const inEpoch = await getJson(`${dev.url}/attest?nonce=e2&host=${HOST}&epoch=2&from=${now - 60_000}&to=${now + 60_000}`);
    expect(inEpoch.sessions.length).toBeGreaterThanOrEqual(1);
    expect(inEpoch.sessions.length).toBeLessThanOrEqual(2);
    const { login, receipt } = inEpoch.sessions[0];
    expect(verifyLoginSignature(login)).toBe(true);
    expect(verifyReceipt(receipt, parseLoginMessage(login.message)!.session_pubkey)).toBe(true);
    expect(receipt).toMatchObject({ host: HOST, epoch: 2 });
    expect((await getJson(`${dev.url}/attest?nonce=e3&host=${HOST}&epoch=3`)).sessions).toEqual([]);
    expect((await getJson(`${dev.url}/attest?nonce=e2&host=${HOST}&epoch=2&from=${now + 10_000}`)).sessions).toEqual([]);
    bot.close();
  });

  it("an official login is refused on a fan host (wrong_host)", { timeout: 60_000 }, async () => {
    const fx = await fixture(1);
    const dev = await startDev(baseVars(fx.rpc, { HOST_ID: HOST }));
    stops.push(async () => { await dev.stop(); await fx.rpc.stop(); });
    const bot = await join(dev.wsUrl, fx.pilots[0], { hostId: "official" });
    expect(bot.denied).toMatchObject({ code: "wrong_host" });
  });
});

describe("snapshot restore refusal", () => {
  it("refuses to serve when the snapshot hash does not match", { timeout: 60_000 }, async () => {
    const fx = await fixture(1);
    const snap = snapshot();
    const tampered = toBase64(utf8.encode(snap.json.replace('"xp":530', '"xp":99999')));
    const dev = await startDev(baseVars(fx.rpc, { HOST_ID: HOST, RESTORE_SNAPSHOT: JSON.stringify({ seq: 12, hash: snap.hash, blob_base64: tampered }) }));
    stops.push(async () => { await dev.stop(); await fx.rpc.stop(); });
    for (const path of ["/health", "/profile?account=lastsave-mira.testnet", "/attest"]) {
      const res = await fetch(`${dev.url}${path}`);
      expect(res.status, path).toBe(503);
      expect(await res.json()).toMatchObject({ code: "snapshot_mismatch", error: expect.any(String) });
    }
    const ws = new WebSocket(dev.wsUrl);
    const outcome = await new Promise<string>((r) => { ws.addEventListener("open", () => r("open")); ws.addEventListener("error", () => r("refused")); ws.addEventListener("close", () => r("refused")); });
    expect(outcome).toBe("refused");
  });
});
