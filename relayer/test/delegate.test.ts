import { describe, expect, it } from "vitest";
import {
  decodeSignedDelegate, delegateHash, encodeSignedDelegate, fromBase64, publicKeyFromSecret, relay, signDelegate,
  signerFromSecret, toBase64, verifyDelegateSignature,
} from "../client/delegate";
import { nearDelegate, RECEIVER, SENDER } from "./helpers";

describe("borsh decode of a delegate built by near-js", () => {
  const n = nearDelegate({ method: "choose", nonce: 5_000_007n, maxBlockHeight: 1_000_555n });
  const decoded = decodeSignedDelegate(fromBase64(n.b64));

  it("recovers every field", () => {
    expect(decoded.delegate.senderId).toBe(SENDER);
    expect(decoded.delegate.receiverId).toBe(RECEIVER);
    expect(decoded.delegate.nonce).toBe(5_000_007n);
    expect(decoded.delegate.maxBlockHeight).toBe(1_000_555n);
    expect(decoded.delegate.publicKey).toBe(n.publicKey);
    expect(decoded.delegate.actions).toHaveLength(1);
    expect(decoded.delegate.actions[0].methodName).toBe("choose");
    expect(JSON.parse(new TextDecoder().decode(decoded.delegate.actions[0].args))).toEqual({ token_id: "1" });
    expect(decoded.delegate.actions[0].deposit).toBe(0n);
  });

  it("re-encodes to the identical bytes", () => {
    expect(toBase64(encodeSignedDelegate(decoded))).toBe(n.b64);
  });

  it("verifies the near-js signature with our NEP-461 hash", () => {
    expect(verifyDelegateSignature(decoded)).toBe(true);
    expect(delegateHash(decoded.delegate)).toHaveLength(32);
  });

  it("rejects truncated and padded input", () => {
    const raw = fromBase64(n.b64);
    expect(() => decodeSignedDelegate(raw.slice(0, raw.length - 3))).toThrow();
    expect(() => decodeSignedDelegate(Uint8Array.from([...raw, 0]))).toThrow(/trailing/);
  });

  it("flags a non-function-call action", () => {
    const t = nearDelegate({ actionKind: "transfer" });
    expect(() => decodeSignedDelegate(fromBase64(t.b64))).toThrow(/only FunctionCall/);
  });
});

describe("client signing is byte-compatible with near-js", () => {
  it("signDelegate output decodes, re-encodes identically to a near-js build, and verifies", async () => {
    const n = nearDelegate();
    const secret = n.kp.toString();
    const b64 = await signDelegate(
      { senderId: SENDER, receiverId: RECEIVER, publicKey: publicKeyFromSecret(secret), nonce: 5_000_001n, maxBlockHeight: 1_000_300n,
        actions: [{ methodName: "report_down", args: { token_id: "1" }, gas: 100_000_000_000_000n }] },
      signerFromSecret(secret),
    );
    const d = decodeSignedDelegate(fromBase64(b64));
    expect(verifyDelegateSignature(d)).toBe(true);
    expect(b64).toBe(n.b64); // deterministic ed25519: identical bytes to the reference build
  });

  it("relay() posts the right body and surfaces errors", async () => {
    let seen: { url: string; body: unknown } | undefined;
    const ok = (async (url: string, init: RequestInit) => { seen = { url, body: JSON.parse(String(init.body)) }; return new Response(JSON.stringify({ hash: "H" })); }) as typeof fetch;
    expect(await relay("https://x.pages.dev/", "QUJD", ok)).toEqual({ hash: "H" });
    expect(seen).toEqual({ url: "https://x.pages.dev/relay", body: { signed_delegate: "QUJD" } });
    const bad = (async () => new Response(JSON.stringify({ error: "nope", code: "EXPIRED" }), { status: 400 })) as typeof fetch;
    await expect(relay("https://x.pages.dev/relay", "QUJD", bad)).rejects.toMatchObject({ message: "nope", code: "EXPIRED" });
  });
});
