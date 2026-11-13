import { describe, expect, it } from "vitest";
import { attestQuerySchema, clientMsgSchema, profileQuerySchema } from "../../src/schemas";
import { makeHello, newPilot } from "../helpers/keys";

describe("zod boundaries", () => {
  const { login, proof } = makeHello(newPilot("lastsave-mira.testnet"));
  it("accepts well-formed client messages", () => {
    expect(clientMsgSchema.safeParse({ t: "hello", v: 1, login, proof }).success).toBe(true);
    expect(clientMsgSchema.safeParse({ t: "input", seq: 4, ax: 0.5, ay: -1, dash: false }).success).toBe(true);
    expect(clientMsgSchema.safeParse({ t: "ping", c: 12 }).success).toBe(true);
  });
  it("rejects junk", () => {
    const bad: unknown[] = [
      null, "hello", {}, { t: "nope" }, { t: "input", seq: -1, ax: 0, ay: 0, dash: false }, { t: "input", seq: 1, ax: "1", ay: 0, dash: false },
      { t: "input", seq: 1, ax: 1e9, ay: 0, dash: false }, { t: "input", seq: 1.5, ax: 0, ay: 0, dash: false }, { t: "input", seq: 1, ax: 0, ay: 0, dash: 1 },
      { t: "hello", v: 1, login: { ...login, account_id: "Bad Account!" }, proof },
      { t: "hello", v: 1, login: { ...login, public_key: "secp256k1:abc" }, proof },
      { t: "hello", v: 1, login, proof: { ts_ms: "now", signature: "x" } },
      { t: "hello", v: 1, login },
      { t: "receipt", receipt: { host: "h", epoch: -1, nonce: "zz", ts_ms: 1, account_id: "a.testnet", signature: "x" } },
      { t: "ping" },
    ];
    for (const b of bad) expect(clientMsgSchema.safeParse(b).success, JSON.stringify(b)?.slice(0, 80)).toBe(false);
  });
  it("validates HTTP queries", () => {
    expect(profileQuerySchema.safeParse({ account: "lastsave-mira.testnet" }).success).toBe(true);
    expect(profileQuerySchema.safeParse({ account: "../etc/passwd" }).success).toBe(false);
    expect(attestQuerySchema.safeParse({ nonce: "abc", from: "10", to: "20", epoch: "3" }).success).toBe(true);
    expect(attestQuerySchema.safeParse({ from: "-1" }).success).toBe(false);
    expect(attestQuerySchema.safeParse({ epoch: "1e3" }).success).toBe(false);
  });
});
