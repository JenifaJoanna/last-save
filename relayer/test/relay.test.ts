import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";
import { relayDelegate, resetState } from "../src/relay";
import worker from "../src/index";
import { mockChain, nearDelegate, RECEIVER, relayerKey, testEnv } from "./helpers";

const nearTx = createRequire(import.meta.url)("@near-js/transactions");
const sleep = async () => {};
const setup = (over = {}) => {
  const chain = mockChain(over);
  const env = testEnv(relayerKey().toString());
  const deps = { urls: ["https://rpc-a.invalid", "https://rpc-b.invalid"], fetch: chain.fetch, sleep };
  return { chain, env, deps, go: (raw: unknown) => relayDelegate({ signed_delegate: (raw as { b64: string }).b64 }, env, deps) };
};
const refuses = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toMatchObject({ code });
};

beforeEach(() => resetState());

describe("allowlist refusals (nothing reaches send_tx)", () => {
  it("wrong receiver", async () => {
    const s = setup();
    await refuses(s.go(nearDelegate({ receiver: "lastsave-licence.testnet" })), "RECEIVER_NOT_ALLOWED");
    expect(s.chain.sent).toHaveLength(0);
  });
  it("the locked v1 instance is not relayed unless explicitly listed", async () => {
    const s = setup();
    expect(s.env.ALLOWED_RECEIVERS).not.toContain("lastsave-licence.testnet");
    await refuses(s.go(nearDelegate({ receiver: "lastsave-licence.testnet" })), "RECEIVER_NOT_ALLOWED");
  });
  it.each(["register_host", "buy_licence", "attest", "add_mirror", "end_of_service", "post_snapshot", "nft_transfer"])("method %s", async (m) => {
    const s = setup();
    await refuses(s.go(nearDelegate({ method: m })), "METHOD_NOT_ALLOWED");
    expect(s.chain.sent).toHaveLength(0);
  });
  it("deposit above zero", async () => {
    const s = setup();
    await refuses(s.go(nearDelegate({ deposit: 1n })), "DEPOSIT_NOT_ZERO");
  });
  it("gas above 300 Tgas", async () => {
    const s = setup();
    await refuses(s.go(nearDelegate({ gas: 300_000_000_000_001n })), "GAS_TOO_HIGH");
  });
  it("non function-call action", async () => {
    const s = setup();
    await refuses(s.go(nearDelegate({ actionKind: "transfer" })), "ACTION_NOT_ALLOWED");
  });
  it("bad signature, before any RPC is spent", async () => {
    const s = setup();
    let rpcCalls = 0;
    s.deps.fetch = (async (...a: Parameters<typeof fetch>) => { rpcCalls++; return s.chain.fetch(...a); }) as typeof fetch;
    await refuses(s.go(nearDelegate({ tamper: true })), "BAD_SIGNATURE");
    expect(rpcCalls).toBe(0);
  });
  it("expired max_block_height", async () => {
    const s = setup();
    await refuses(s.go(nearDelegate({ maxBlockHeight: 999_999n })), "EXPIRED");
    await refuses(s.go(nearDelegate({ maxBlockHeight: 1_000_002n })), "EXPIRED"); // inside the safety margin
    expect(s.chain.sent).toHaveLength(0);
  });
  it("sender key unknown, nonce stale, key limited to another contract or method", async () => {
    await refuses(setup({ senderKey: "missing" }).go(nearDelegate()), "KEY_NOT_FOUND");
    await refuses(setup({ senderKey: { nonce: 5_000_001, permission: "FullAccess" } }).go(nearDelegate()), "NONCE_USED");
    const other = { nonce: 5_000_000, permission: { FunctionCall: { receiver_id: "elsewhere.testnet", method_names: [] } } };
    await refuses(setup({ senderKey: other }).go(nearDelegate()), "KEY_PERMISSION");
    const narrow = { nonce: 5_000_000, permission: { FunctionCall: { receiver_id: RECEIVER, method_names: ["choose"] } } };
    await refuses(setup({ senderKey: narrow }).go(nearDelegate({ method: "report_down" })), "KEY_PERMISSION");
  });
  it("malformed bodies", async () => {
    const s = setup();
    await expect(relayDelegate({}, s.env, s.deps)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(relayDelegate({ signed_delegate: "!!notbase64!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" }, s.env, s.deps)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(relayDelegate({ signed_delegate: "QUJD".repeat(20) }, s.env, s.deps)).rejects.toMatchObject({ code: "BAD_BORSH" });
  });
  it("unconfigured relayer", async () => {
    const s = setup();
    await expect(relayDelegate({ signed_delegate: "x" }, { ...s.env, RELAYER_KEY: "" }, s.deps)).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });
});

describe("accepted relays", () => {
  it.each(["choose", "report_down", "probe_official", "release", "claim_epoch", "sign_evm_payout", "bump_evm_payout", "set_payout_evm"])("%s is wrapped and sent", async (m) => {
    const s = setup();
    const { hash } = await s.go(nearDelegate({ method: m }));
    expect(hash).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
    expect(s.chain.sent).toHaveLength(1);
  });
  it("the outer tx is signed by the relayer, targets the sender, carries one Delegate action wrapping the user's exact bytes", async () => {
    const s = setup();
    const n = nearDelegate();
    await s.go(n);
    const raw = Buffer.from(s.chain.sent[0], "base64");
    const text = raw.toString("latin1");
    expect(text).toContain("lastsave-relayer.testnet");
    expect(text).toContain("lastsave-mira.testnet");
    expect(raw.includes(Buffer.from(n.b64, "base64"))).toBe(true);
    // the reference decoder agrees it is a well-formed SignedTransaction with a single Delegate action
    const decoded = nearTx.decodeSignedTransaction(raw);
    expect(decoded.transaction.signerId).toBe("lastsave-relayer.testnet");
    expect(decoded.transaction.receiverId).toBe("lastsave-mira.testnet");
    expect(decoded.transaction.actions).toHaveLength(1);
    expect(Object.keys(decoded.transaction.actions[0])).toEqual(["signedDelegate"]);
    expect(decoded.transaction.actions[0].signedDelegate.delegateAction.actions[0].functionCall.methodName).toBe("report_down");
  });
  it("uses a fresh nonce for each concurrent relay", async () => {
    const s = setup();
    await Promise.all([s.go(nearDelegate({ nonce: 5_000_001n })), s.go(nearDelegate({ nonce: 5_000_002n }))]);
    expect(new Set(s.chain.sent).size).toBe(2);
  });
  it("retries on InvalidNonce, treats a send timeout as accepted, surfaces other rejections", async () => {
    const a = setup({ sendError: { kind: "INVALID_TRANSACTION", message: "InvalidNonce", times: 1 } });
    await a.go(nearDelegate());
    expect(a.chain.sent).toHaveLength(1);
    const b = setup({ sendError: { kind: "TIMEOUT_ERROR", message: "TIMEOUT" } });
    await expect(b.go(nearDelegate())).resolves.toHaveProperty("hash");
    const c = setup({ sendError: { kind: "INVALID_TRANSACTION", message: "NotEnoughBalance" } });
    await refuses(c.go(nearDelegate()), "RELAY_REJECTED");
  });
  it("fails over to the second RPC when the first returns 500", async () => {
    const s = setup();
    const inner = s.chain.fetch;
    s.deps.fetch = (async (url: string, init: RequestInit) => (String(url).includes("rpc-a") ? new Response("", { status: 503 }) : inner(url, init))) as typeof fetch;
    await expect(s.go(nearDelegate())).resolves.toHaveProperty("hash");
  });
  it("reports RPC_UNAVAILABLE when every RPC is down", async () => {
    const s = setup();
    s.deps.fetch = (async () => new Response("", { status: 502 })) as typeof fetch;
    await refuses(s.go(nearDelegate()), "RPC_UNAVAILABLE");
  });
});

describe("rate limit", () => {
  it("limits one sender per minute and the whole relayer globally", async () => {
    const s = setup();
    s.env.RATE_LIMIT_PER_MIN = "2";
    const go = (nonce: bigint) => relayDelegate({ signed_delegate: nearDelegate({ nonce }).b64 }, s.env, s.deps, 1_000_000);
    await go(5_000_001n); await go(5_000_002n);
    await expect(go(5_000_003n)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    resetState();
    s.env.GLOBAL_LIMIT_PER_MIN = "1";
    await go(5_000_001n);
    await expect(go(5_000_002n)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("HTTP surface", () => {
  const env = testEnv(relayerKey().toString());
  it("GET /health lists receivers and methods", async () => {
    const res = await worker.fetch(new Request("https://r.test/health"), env);
    const body = (await res.json()) as { ok: boolean; methods: string[]; receivers: string[] };
    expect(body.ok).toBe(true);
    expect(body.methods).toContain("bump_evm_payout");
    expect(body.methods).not.toContain("register_host");
    expect(body.receivers).toContain(RECEIVER);
  });
  it("returns { error, code } with CORS, never a stack", async () => {
    const res = await worker.fetch(new Request("https://r.test/relay", { method: "POST", body: "not json" }), env);
    expect(res.status).toBe(400);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual({ error: "body must be JSON", code: "BAD_REQUEST" });
    expect((await worker.fetch(new Request("https://r.test/relay"), env)).status).toBe(405);
    expect((await worker.fetch(new Request("https://r.test/relay", { method: "OPTIONS" }), env)).status).toBe(204);
    expect((await worker.fetch(new Request("https://r.test/nope"), env)).status).toBe(404);
  });
});
