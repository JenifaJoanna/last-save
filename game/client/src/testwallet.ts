// Localhost-only scripted wallet for e2e: in a capture build (VITE_CAPTURE_SIGNER=1) opened on localhost with ?capture,
// a test script calls window.__lastSaveTestWallet(accountId, privateKey). The wallet then announces itself to NEAR
// Connect the way an extension wallet does, so the real picker → connect → "Sign the login" path runs without a person.
// It signs NEP-413 with the caller's nonce, exactly like a real wallet. Users never see it.
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { nep413Hash } from "./session";

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
interface MessageParams { message: string; recipient: string; nonce: Uint8Array | number[] }

export function installTestWallet(accountId: string, privateKey: string): void {
  const raw = bs58.decode(privateKey.replace(/^ed25519:/, "").trim());
  const seed = raw.slice(0, 32);
  const publicKey = `ed25519:${bs58.encode(ed25519.getPublicKey(seed))}`;
  const sign = (p: MessageParams) => ({ accountId, publicKey, signature: b64(ed25519.sign(nep413Hash(p.message, Uint8Array.from(p.nonce), p.recipient), seed)) });
  let connected = false;
  const account = { accountId, publicKey };
  const no = async () => { throw new Error("The localhost test wallet only signs logins."); };
  const wallet = {
    manifest: {
      id: "lastsave-test-wallet", name: "Test wallet (localhost)", icon: "", description: "Scripted e2e wallet, localhost only",
      website: "http://localhost", version: "1.0.0", executor: "", type: "injected", platform: {}, permissions: {},
      features: { signMessage: true, signInAndSignMessage: true, signInWithoutAddKey: true, signAndSendTransaction: false, signAndSendTransactions: false, testnet: true, mainnet: false },
    },
    signIn: async () => { connected = true; return [account]; },
    signInAndSignMessage: async (d: { messageParams: MessageParams }) => { connected = true; return [{ ...account, signedMessage: sign(d.messageParams) }]; },
    signOut: async () => { connected = false; },
    getAccounts: async () => (connected ? [account] : []),
    signMessage: async (p: MessageParams) => sign(p),
    signAndSendTransaction: no, signAndSendTransactions: no, signDelegateActions: no,
  };
  const announce = () => window.dispatchEvent(new CustomEvent("near-wallet-injected", { detail: wallet }));
  window.addEventListener("near-selector-ready", announce);
  announce();
}
