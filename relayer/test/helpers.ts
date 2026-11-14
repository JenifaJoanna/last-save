// Test helpers: a real delegate action built by the official near-js libraries, and a mock NEAR RPC.
import { createRequire } from "node:module";
import { sha256 } from "@noble/hashes/sha2";
import { toBase64 } from "../client/delegate";
import type { Env } from "../src/relay";

const require = createRequire(import.meta.url);
const tx = require("@near-js/transactions");
const crypto = require("@near-js/crypto");

export const RECEIVER = "lastsave-v2dev.lastsave-studio.testnet";
export const SENDER = "lastsave-mira.testnet";

export interface NearDelegateOpts {
  receiver?: string;
  method?: string;
  deposit?: bigint;
  gas?: bigint;
  maxBlockHeight?: bigint;
  nonce?: bigint;
  actionKind?: "functionCall" | "transfer";
  tamper?: boolean;
  keyPair?: any;
}

/** Builds and signs with @near-js/transactions (the reference implementation). */
export function nearDelegate(o: NearDelegateOpts = {}) {
  const kp = o.keyPair ?? crypto.KeyPair.fromRandom("ed25519");
  const action = o.actionKind === "transfer"
    ? tx.actionCreators.transfer(1n)
    : tx.actionCreators.functionCall(o.method ?? "report_down", { token_id: "1" }, o.gas ?? 100_000_000_000_000n, o.deposit ?? 0n);
  const delegateAction = tx.buildDelegateAction({
    senderId: SENDER,
    receiverId: o.receiver ?? RECEIVER,
    actions: [action],
    nonce: o.nonce ?? 5_000_001n,
    maxBlockHeight: o.maxBlockHeight ?? 1_000_300n,
    publicKey: kp.getPublicKey(),
  });
  const hash = sha256(tx.encodeDelegateAction(delegateAction));
  const sig = kp.sign(hash).signature;
  const signature = new tx.Signature({ keyType: 0, data: o.tamper ? sig.map((b: number) => b ^ 1) : sig });
  const signed = new tx.SignedDelegate({ delegateAction, signature });
  return { b64: toBase64(tx.encodeSignedDelegate(signed)), kp, publicKey: kp.getPublicKey().toString() as string };
}

export const relayerKey = () => crypto.KeyPair.fromRandom("ed25519");

export interface MockChain {
  height: number;
  senderKey: { nonce: number; permission: unknown } | "missing";
  relayerNonce: number;
  sent: string[];
  sendError?: { kind: string; message: string; times?: number };
  fetch: typeof fetch;
}

/** Mock NEAR RPC. */
export function mockChain(over: Partial<MockChain> = {}): MockChain {
  const c: MockChain = { height: 1_000_000, senderKey: { nonce: 5_000_000, permission: "FullAccess" }, relayerNonce: 100, sent: [], fetch: undefined as never, ...over };
  c.fetch = (async (_url: string, init: RequestInit) => {
    const { method, params } = JSON.parse(String(init.body));
    const ok = (result: unknown) => new Response(JSON.stringify({ jsonrpc: "2.0", id: "x", result }));
    const fail = (name: string, cause: string, info?: unknown) =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: "x", error: { name: "HANDLER_ERROR", cause: { name: cause, info } } }));
    if (method === "block") return ok({ header: { height: c.height } });
    if (method === "query") {
      if (params.account_id === SENDER) return c.senderKey === "missing" ? fail("UNKNOWN_ACCESS_KEY", "UNKNOWN_ACCESS_KEY") : ok(c.senderKey);
      return ok({ nonce: c.relayerNonce, block_hash: "11111111111111111111111111111111", permission: "FullAccess" });
    }
    if (method === "send_tx") {
      if (c.sendError && (c.sendError.times ?? 1) > 0) {
        c.sendError.times = (c.sendError.times ?? 1) - 1;
        return fail("x", c.sendError.kind, { InvalidTxError: c.sendError.message });
      }
      c.sent.push(params.signed_tx_base64);
      return ok({ final_execution_status: "INCLUDED" });
    }
    return new Response("{}", { status: 500 });
  }) as typeof fetch;
  return c;
}

export const testEnv = (key: string): Env => ({
  ALLOWED_RECEIVERS: `${RECEIVER},other-instance.testnet`,
  RELAYER_ACCOUNT: "lastsave-relayer.testnet",
  RELAYER_KEY: key,
  RPC_URLS: "https://rpc-a.invalid,https://rpc-b.invalid",
});
