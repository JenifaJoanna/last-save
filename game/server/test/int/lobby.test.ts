// Admission, capacity, reconnect, /attest and CORS on a real local Worker (real-time simulation).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateSessionKey, parseLoginMessage, verifyLoginSignature, verifyReceipt } from "../../../shared/auth";
import { makeHello, newPilot } from "../helpers/keys";
import { startDev, type Dev } from "../helpers/wrangler";
import { baseVars, fixture, getJson, join } from "../helpers/world";

type Fx = Awaited<ReturnType<typeof fixture>>;
let fx: Fx, dev: Dev;
const open: any[] = [];
const track = <T>(b: T): T => { open.push(b); return b; };

beforeAll(async () => {
  fx = await fixture(9);
  dev = await startDev(baseVars(fx.rpc));
});
afterAll(async () => { open.forEach((b) => b.close()); await dev?.stop(); await fx?.rpc.stop(); });

/** Opens a raw socket and sends one hello built from `h`, returning the first denial or welcome. */
async function rawHello(h: ReturnType<typeof makeHello>, v = 1): Promise<any> {
  const ws = new WebSocket(dev.wsUrl);
  const got: any = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no answer")), 10_000);
    ws.addEventListener("open", () => ws.send(JSON.stringify({ t: "hello", v, login: h.login, proof: h.proof })));
    ws.addEventListener("message", (e) => { const m = JSON.parse(String(e.data)); if (m.t === "denied" || m.t === "welcome") { clearTimeout(t); resolve(m); } });
  });
  ws.close();
  return got;
}

describe("admission", () => {
  it("denies with the right code", async () => {
    const nolic = newPilot("lastsave-nolicence.testnet");
    fx.rpc.allow(nolic.account, nolic.public, { licence: false });
    const stranger = newPilot("lastsave-stranger.testnet");
    const p = fx.pilots[0];
    const cases: [string, ReturnType<typeof makeHello>, string][] = [
      ["no licence", makeHello(nolic), "no_licence"],
      ["no access key", makeHello(stranger), "no_access_key"],
      ["wrong host", makeHello(p, { host: "lastsave-fanhost.testnet" }), "wrong_host"],
      ["expired", makeHello(p, { expMs: Date.now() - 5000 }), "expired"],
      ["stale proof", makeHello(p, { proofTs: Date.now() - 90_000 }), "replay"],
      ["proof by another key", makeHello(p, { proofKey: generateSessionKey().secret }), "bad_signature"],
      ["wrong recipient", makeHello(p, { recipient: "x.testnet" }), "bad_signature"],
    ];
    for (const [label, h, code] of cases) expect(await rawHello(h), label).toMatchObject({ t: "denied", code });
    expect(await rawHello(makeHello(p), 99)).toMatchObject({ t: "denied", code: "bad_version" });
  });

  it("answers junk with notices and drops the socket after repeated junk", async () => {
    const ws = new WebSocket(dev.wsUrl);
    const msgs: any[] = [];
    const closed = new Promise<void>((r) => ws.addEventListener("close", () => r()));
    ws.addEventListener("message", (e) => msgs.push(JSON.parse(String(e.data))));
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    for (let i = 0; i < 8; i++) ws.send(i % 2 ? "{nope" : JSON.stringify({ t: "input", seq: -3, ax: "x" }));
    await closed;
    expect(msgs[0]).toMatchObject({ t: "notice" });
  });

  it("answers a non-WebSocket request to /ws with 426 and a JSON error", async () => {
    const res = await fetch(`${dev.url}/ws`);
    expect(res.status).toBe(426);
    expect(await res.json()).toMatchObject({ error: expect.any(String), code: "upgrade_required" });
  });
});

describe("capacity, reconnect and attest", () => {
  it("takes 8 pilots, refuses a 9th with `full`, and lets a pilot reconnect to the same ship", { timeout: 60_000 }, async () => {
    const eight: any[] = [];
    for (const p of fx.pilots.slice(0, 8)) eight.push(track(await join(dev.wsUrl, p, { play: false })));
    for (const b of eight) expect(b.denied).toBeNull();
    const ninth = track(await join(dev.wsUrl, fx.pilots[8], { play: false }));
    expect(ninth.denied).toMatchObject({ t: "denied", code: "full" });

    await eight[0].waitFor((b: any) => b.snap?.ships.length === 8, 10_000, "eight ships");
    expect(new Set(eight[0].snap.ships.map((s: any) => s.slot)).size).toBe(8);

    // reconnect the third pilot with the same login and a fresh proof
    const target = eight[2];
    await target.waitFor((b: any) => b.snap?.ships.some((s: any) => s.id === b.accountId), 5000, "own ship");
    const before = target.snap.ships.find((s: any) => s.id === target.accountId);
    target.close();
    await target.waitFor((b: any) => b.closed, 5000, "close");
    target.msgs.length = 0; target.snap = null; target.profile = null;
    await target.connect();
    await target.waitFor((b: any) => b.profile && b.snap, 10_000, "rejoin");
    expect(target.denied).toBeNull();
    const after = target.snap.ships.find((s: any) => s.id === target.accountId);
    expect(target.snap.ships).toHaveLength(8);
    expect(after.slot).toBe(before.slot);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(40);
    expect(after.shards).toBe(before.shards);
  });

  it("serves /attest with verifiable sessions", async () => {
    await new Promise((r) => setTimeout(r, 500));
    const now = Date.now();
    const a = await getJson(`${dev.url}/attest?nonce=n0nce-42&host=official&from=${now - 600_000}&to=${now + 60_000}`);
    expect(a).toMatchObject({ host_id: "official", build_hash: "dev", nonce: "n0nce-42" });
    expect(Math.abs(a.now_ms - now)).toBeLessThan(5000);
    expect(a.sessions.length).toBeGreaterThanOrEqual(8);
    const perAccount = new Map<string, number>();
    for (const { login, receipt } of a.sessions) {
      expect(verifyLoginSignature(login)).toBe(true);
      const msg = parseLoginMessage(login.message)!;
      expect(verifyReceipt(receipt, msg.session_pubkey)).toBe(true);
      expect(receipt).toMatchObject({ host: "official", epoch: null, account_id: login.account_id });
      expect(receipt.ts_ms).toBeGreaterThanOrEqual(now - 600_000);
      perAccount.set(login.account_id, (perAccount.get(login.account_id) ?? 0) + 1);
    }
    expect(Math.max(...perAccount.values())).toBeLessThanOrEqual(2);
    for (let i = 1; i < a.sessions.length; i++) expect(a.sessions[i - 1].receipt.ts_ms).toBeGreaterThanOrEqual(a.sessions[i].receipt.ts_ms);
    const none = await getJson(`${dev.url}/attest?nonce=x&host=official&from=0&to=1000`);
    expect(none.sessions).toEqual([]);
    const wrong = await fetch(`${dev.url}/attest?nonce=x&host=someone-else.testnet`);
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toMatchObject({ code: "wrong_host" });
    expect((await fetch(`${dev.url}/attest?from=abc`)).status).toBe(400);
  });
});

describe("HTTP surface", () => {
  it("/health, /profile and /attest send CORS headers, OPTIONS is answered, and /health makes no RPC calls", async () => {
    const before = JSON.stringify(fx.rpc.calls);
    for (const path of ["/health", "/profile?account=lastsave-mira.testnet", "/attest?nonce=a"]) {
      const res = await fetch(`${dev.url}${path}`, { headers: { origin: "https://app.example.pages.dev" } });
      expect(res.status, path).toBe(200);
      expect(res.headers.get("access-control-allow-origin"), path).toBe("*");
    }
    const pre = await fetch(`${dev.url}/health`, { method: "OPTIONS", headers: { origin: "https://app.example.pages.dev", "access-control-request-method": "GET" } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("*");
    expect(JSON.stringify(fx.rpc.calls)).toBe(before);
    const h = await getJson(`${dev.url}/health`);
    expect(h).toMatchObject({ ok: true, host_id: "official", build_hash: "dev" });
    expect(h.players_online).toBeGreaterThanOrEqual(1);
    expect(h.match).toHaveProperty("phase");
  });

  it("returns a default profile for unknown pilots and JSON errors for bad input", async () => {
    expect(await getJson(`${dev.url}/profile?account=lastsave-newcomer.testnet`)).toEqual({ account_id: "lastsave-newcomer.testnet", level: 1, xp: 0, skin: "standard", matches: 0 });
    const bad = await fetch(`${dev.url}/profile?account=NOT%20VALID`);
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ code: "bad_account" });
    const post = await fetch(`${dev.url}/health`, { method: "POST" });
    expect(post.status).toBe(405);
    expect(await post.json()).toMatchObject({ code: "method_not_allowed" });
  });

  it("serves the placeholder client at /", async () => {
    const res = await fetch(`${dev.url}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Ember Rift");
  });

  it("accepts WebSocket upgrades from any Origin", async () => {
    const ws = new WebSocket(dev.wsUrl, { headers: { origin: "https://elsewhere.example.pages.dev" } } as any);
    const state = await new Promise<string>((r) => { ws.addEventListener("open", () => r("open")); ws.addEventListener("error", () => r("error")); });
    expect(state).toBe("open");
    ws.close();
  });
});

