import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519";
import { bytesToHex } from "@noble/hashes/utils";
import { buildLoginMessage, fromBase64, generateSessionKey, nep413Hash, parseLoginMessage, receiptMessage, signHello, signLogin, signReceipt, toHex,
  verifyHello, verifyLoginSignature, verifyReceipt} from "../../../shared/auth";

const vec = JSON.parse(readFileSync(new URL("../../../../docs/test-vector-nep413.json", import.meta.url), "utf8"));
// The vector file omits the 32-byte nonce and the recipient; these are the values that reproduce its payload hash.
const NONCE = new Uint8Array(32).fill(7);
const RECIPIENT = "lastsave-licence.testnet";

describe("NEP-413 test vector", () => {
  it("reproduces the payload hash", () => {
    expect(bytesToHex(nep413Hash(vec.message, NONCE, RECIPIENT))).toBe(vec.payload_sha256);
  });
  it("verifies the canonical login signature", () => {
    const ok = verifyLoginSignature({ account_id: "lastsave-mira.testnet", public_key: vec.account_pk, signature: vec.login_signature_b64,
      message: vec.message, nonce: btoa(String.fromCharCode(...NONCE)), recipient: RECIPIENT });
    expect(ok).toBe(true);
  });
  it("rejects when any signed field changes", () => {
    const base = { account_id: "lastsave-mira.testnet", public_key: vec.account_pk, signature: vec.login_signature_b64,
      message: vec.message, nonce: btoa(String.fromCharCode(...NONCE)), recipient: RECIPIENT };
    expect(verifyLoginSignature({ ...base, recipient: "other.testnet" })).toBe(false);
    expect(verifyLoginSignature({ ...base, message: vec.message.replace("official", "evil") })).toBe(false);
    expect(verifyLoginSignature({ ...base, nonce: btoa(String.fromCharCode(...new Uint8Array(32).fill(8))) })).toBe(false);
  });
  it("matches the canonical receipt message and signature", () => {
    const r = { host: "official", epoch: null, nonce: "00112233445566778899aabbccddeeff", ts_ms: 1799999000000, account_id: "lastsave-mira.testnet" };
    expect(receiptMessage(r)).toBe(vec.receipt_message);
    expect(verifyReceipt({ ...r, signature: vec.receipt_signature_b64 }, vec.session_pk)).toBe(true);
    expect(verifyReceipt({ ...r, ts_ms: r.ts_ms + 1, signature: vec.receipt_signature_b64 }, vec.session_pk)).toBe(false);
  });
  it("parses the vector's login message", () => {
    expect(parseLoginMessage(vec.message)).toMatchObject({ host: "official", session_pubkey: vec.session_pk, exp_ms: 1800000000000 });
  });
});

describe("sign and verify round trips", () => {
  const acct = generateSessionKey();
  it("signLogin output verifies and binds the nonce", () => {
    const message = buildLoginMessage({ host: "official", sessionPubkey: generateSessionKey().public, expMs: Date.now() + 1000 });
    const login = signLogin({ accountId: "a.testnet", secretKey: acct.secret, message, recipient: RECIPIENT });
    expect(fromBase64(login.nonce)).toHaveLength(32);
    expect(verifyLoginSignature(login)).toBe(true);
    expect(verifyLoginSignature({ ...login, public_key: generateSessionKey().public })).toBe(false);
    expect(verifyLoginSignature({ ...login, signature: "AAAA" })).toBe(false);
  });
  it("accepts a 64-byte NEAR secret key (seed || public)", async () => {
    const { default: bs58 } = await import("bs58");
    const seed = ed25519.utils.randomPrivateKey();
    const full = `ed25519:${bs58.encode(new Uint8Array([...seed, ...ed25519.getPublicKey(seed)]))}`;
    const message = buildLoginMessage({ host: "official", sessionPubkey: generateSessionKey().public, expMs: 1 });
    const login = signLogin({ accountId: "a.testnet", secretKey: full, message, recipient: RECIPIENT });
    expect(login.public_key).toBe(`ed25519:${bs58.encode(ed25519.getPublicKey(seed))}`);
    expect(verifyLoginSignature(login)).toBe(true);
  });
  it("receipts sign with the session key only", () => {
    const k = generateSessionKey();
    const r = signReceipt({ host: "h.testnet", epoch: 3, nonce: toHex(new Uint8Array(16).fill(1)), tsMs: 5, accountId: "a.testnet", sessionSecret: k.secret });
    expect(verifyReceipt(r, k.public)).toBe(true);
    expect(verifyReceipt(r, generateSessionKey().public)).toBe(false);
    expect(verifyReceipt({ ...r, epoch: null }, k.public)).toBe(false);
  });
  it("hello proofs bind host, time and account", () => {
    const k = generateSessionKey();
    const proof = signHello({ host: "official", accountId: "a.testnet", sessionSecret: k.secret, tsMs: 1000 });
    expect(verifyHello({ host: "official", accountId: "a.testnet", sessionPubkey: k.public, proof })).toBe(true);
    expect(verifyHello({ host: "other", accountId: "a.testnet", sessionPubkey: k.public, proof })).toBe(false);
    expect(verifyHello({ host: "official", accountId: "b.testnet", sessionPubkey: k.public, proof })).toBe(false);
    expect(verifyHello({ host: "official", accountId: "a.testnet", sessionPubkey: k.public, proof: { ...proof, ts_ms: 1001 } })).toBe(false);
  });
});
