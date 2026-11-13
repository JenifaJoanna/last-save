import { describe, expect, it } from "vitest";
import { buildLoginMessage, generateSessionKey, signHello, signLogin } from "../../../shared/auth";
import { Chain } from "../../src/chain";
import { verifyJoin } from "../../src/login";
import { makeHello, newPilot } from "../helpers/keys";
import { FakeRpc } from "../helpers/fakeRpc";

const CONTRACT = "lastsave-licence.testnet";
const mira = newPilot("lastsave-mira.testnet");

async function setup() {
  const rpc = await new FakeRpc().start();
  rpc.allow(mira.account, mira.public);
  const chain = new Chain({ urls: [rpc.url], cacheMs: 60_000, backoffMs: 1 });
  const join = (h: ReturnType<typeof makeHello>, host = "official") =>
    verifyJoin({ login: h.login, proof: h.proof, hostId: host, licenceContract: CONTRACT, chain, nowMs: Date.now() });
  return { rpc, chain, join };
}

describe("login verification", () => {
  it("accepts a valid login and lets the same login reconnect with fresh proofs", async () => {
    const { rpc, join } = await setup();
    const h = makeHello(mira);
    expect(await join(h)).toMatchObject({ ok: true, accountId: mira.account });
    const again = { ...h, proof: signHello({ host: "official", accountId: mira.account, sessionSecret: h.session.secret }) };
    expect(await join(again)).toMatchObject({ ok: true });
    expect(await join(again)).toMatchObject({ ok: true });
    await rpc.stop();
  });

  it("rejects a bad wallet signature", async () => {
    const { rpc, join } = await setup();
    const h = makeHello(mira);
    const forged = { ...h, login: { ...h.login, signature: signLogin({ accountId: mira.account, secretKey: newPilot("x").secret, message: h.login.message, recipient: CONTRACT }).signature } };
    expect(await join(forged)).toMatchObject({ ok: false, code: "bad_signature" });
    await rpc.stop();
  });

  it("rejects the wrong host", async () => {
    const { rpc, join } = await setup();
    expect(await join(makeHello(mira, { host: "lastsave-fanhost.testnet" }))).toMatchObject({ ok: false, code: "wrong_host" });
    await rpc.stop();
  });

  it("rejects an expired login and one that lives longer than 24 h", async () => {
    const { rpc, join } = await setup();
    expect(await join(makeHello(mira, { expMs: Date.now() - 1000 }))).toMatchObject({ ok: false, code: "expired" });
    expect(await join(makeHello(mira, { expMs: Date.now() + 25 * 3600_000 }))).toMatchObject({ ok: false, code: "expired" });
    await rpc.stop();
  });

  it("rejects a key that is not an access key of the account", async () => {
    const { rpc, join } = await setup();
    expect(await join(makeHello(newPilot(mira.account)))).toMatchObject({ ok: false, code: "no_access_key" });
    await rpc.stop();
  });

  it("rejects an account without a licence", async () => {
    const { rpc, join } = await setup();
    const kofi = newPilot("lastsave-kofi.testnet");
    rpc.allow(kofi.account, kofi.public, { licence: false });
    expect(await join(makeHello(kofi))).toMatchObject({ ok: false, code: "no_licence" });
    await rpc.stop();
  });

  it("rejects a login signed for another licence contract", async () => {
    const { rpc, join } = await setup();
    expect(await join(makeHello(mira, { recipient: "other.testnet" }))).toMatchObject({ ok: false, code: "bad_signature" });
    await rpc.stop();
  });

  it("denies a stale proof as replay", async () => {
    const { rpc, join } = await setup();
    expect(await join(makeHello(mira, { proofTs: Date.now() - 61_000 }))).toMatchObject({ ok: false, code: "replay" });
    expect(await join(makeHello(mira, { proofTs: Date.now() + 120_000 }))).toMatchObject({ ok: false, code: "replay" });
    expect(await join(makeHello(mira, { proofTs: Date.now() - 50_000 }))).toMatchObject({ ok: true });
    await rpc.stop();
  });

  it("denies a proof signed by a different key as bad_signature", async () => {
    const { rpc, join } = await setup();
    const stranger = generateSessionKey();
    expect(await join(makeHello(mira, { proofKey: stranger.secret }))).toMatchObject({ ok: false, code: "bad_signature" });
    await rpc.stop();
  });

  it("rejects a login message that is not an Ember Rift login", async () => {
    const { rpc, join } = await setup();
    const h = makeHello(mira);
    const message = buildLoginMessage({ host: "official", sessionPubkey: h.session.public, expMs: Date.now() + 1000 }).replace("ember-rift", "other-app");
    const login = signLogin({ accountId: mira.account, secretKey: mira.secret, message, recipient: CONTRACT });
    expect(await join({ ...h, login })).toMatchObject({ ok: false, code: "bad_signature" });
    await rpc.stop();
  });
});

describe("chain client", () => {
  it("caches answers for the cache window", async () => {
    const { rpc, chain } = await setup();
    await chain.hasAccessKey(mira.account, mira.public);
    await chain.hasAccessKey(mira.account, mira.public);
    await chain.licenceOf(CONTRACT, mira.account);
    await chain.licenceOf(CONTRACT, mira.account);
    expect(rpc.calls.view_access_key ?? 0).toBe(0);
    expect(rpc.calls.licence_of).toBe(1);
    expect(rpc.calls.query).toBe(2);
    await rpc.stop();
  });

  it("expires the cache after the window", async () => {
    const rpc = await new FakeRpc().start();
    rpc.allow(mira.account, mira.public);
    let t = 1000;
    const chain = new Chain({ urls: [rpc.url], cacheMs: 60_000, backoffMs: 1, now: () => t });
    await chain.licenceOf(CONTRACT, mira.account);
    t += 59_000; await chain.licenceOf(CONTRACT, mira.account);
    t += 2_000; await chain.licenceOf(CONTRACT, mira.account);
    expect(rpc.calls.licence_of).toBe(2);
    await rpc.stop();
  });

  it("fails over to the second RPC and retries with backoff on 5xx", async () => {
    const dead = await new FakeRpc().start();
    const live = await new FakeRpc().start();
    live.allow(mira.account, mira.public);
    dead.failNext = 99;
    const sleeps: number[] = [];
    const chain = new Chain({ urls: [dead.url, live.url], cacheMs: 0, backoffMs: 10, sleep: async (ms) => { sleeps.push(ms); } });
    expect(await chain.hasAccessKey(mira.account, mira.public)).toBe(true);
    expect(sleeps).toEqual([10, 20, 40]);
    expect(live.calls.query).toBe(1);
    await dead.stop(); await live.stop();
  });

  it("reads epoch settings from get_info", async () => {
    const rpc = await new FakeRpc().start();
    rpc.info = { released_at_ms: 1_000_000, pool: { epoch_ms: 120_000 } };
    const chain = new Chain({ urls: [rpc.url], cacheMs: 0, backoffMs: 1 });
    expect(await chain.epochInfo(CONTRACT)).toEqual({ releasedAtMs: 1_000_000, epochMs: 120_000 });
    await rpc.stop();
  });
});
