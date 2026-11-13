import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { signLogin, buildLoginMessage, generateSessionKey, signHello } from "../../../shared/auth";

export interface Pilot { account: string; secret: string; public: string }
export function newPilot(account: string): Pilot {
  const seed = ed25519.utils.randomPrivateKey();
  return { account, secret: `ed25519:${bs58.encode(seed)}`, public: `ed25519:${bs58.encode(ed25519.getPublicKey(seed))}` };
}

export function makeHello(p: Pilot, o: { host?: string; recipient?: string; expMs?: number; proofTs?: number; proofKey?: string } = {}) {
  const session = generateSessionKey();
  const host = o.host ?? "official";
  const message = buildLoginMessage({ host, sessionPubkey: session.public, expMs: o.expMs ?? Date.now() + 3_600_000 });
  const login = signLogin({ accountId: p.account, secretKey: p.secret, message, recipient: o.recipient ?? "lastsave-licence.testnet" });
  const proof = signHello({ host, accountId: p.account, sessionSecret: o.proofKey ?? session.secret, tsMs: o.proofTs });
  return { login, proof, session };
}
