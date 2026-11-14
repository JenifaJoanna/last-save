// NEAR wallet sign-in via NEAR Connect (@hot-labs/near-connect): one NEP-413 signature binds a session key to the
// account. Wallets that can sign during sign-in do it in one step; others sign right after connecting.
import type { NearConnector, SignedMessage } from "@hot-labs/near-connect";
import type { Login } from "../../shared/protocol";

const PENDING = "ember-rift.pending-login";
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));

interface Pending { message: string; nonce: string; recipient: string; secret: string; host: string }

let shared: Promise<NearConnector> | null = null;
function connector(): Promise<NearConnector> {
  shared ??= import("@hot-labs/near-connect").then(({ NearConnector: C }) =>
    new C({ network: "testnet", providers: { testnet: ["https://near-testnet.drpc.org", "https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"] }, features: { testnet: true, signMessage: true }, footerBranding: null }));
  return shared;
}

/** Asks a wallet (picked in NEAR Connect) to sign the login. Resolves with a Login, or "redirect" when the wallet navigates away. */
export async function walletLogin(message: string, recipient: string, secretHex: string, host: string): Promise<Login | "redirect"> {
  const c = await connector();
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const pending: Pending = { message, nonce: b64(nonce), recipient, secret: secretHex, host };
  try { localStorage.setItem(PENDING, JSON.stringify(pending)); } catch { /* private mode: redirect flow cannot resume */ }
  const atSignIn = new Promise<SignedMessage | null>((res) => {
    c.once("wallet:signInAndSignMessage", (p) => res(p.accounts[0]?.signedMessage ?? null));
    setTimeout(() => res(null), 120_000);
  });
  const wallet = await c.connect({ signMessageParams: { message, recipient, nonce } });
  let signed = await Promise.race([atSignIn, new Promise<null>((r) => setTimeout(() => r(null), 1500))]);
  signed ??= await wallet.signMessage({ message, recipient, nonce });
  if (!signed) return "redirect";
  try { localStorage.removeItem(PENDING); } catch { /* ignore */ }
  return { account_id: signed.accountId, public_key: signed.publicKey, signature: signed.signature, message, nonce: pending.nonce, recipient };
}

/** After a wallet that signs on its own page redirects back: rebuild the login from the URL and the pending record. */
export function resumeRedirectLogin(): { login: Login; secret: string; host: string } | { error: string } | null {
  const params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
  const accountId = params.get("accountId"), publicKey = params.get("publicKey"), signature = params.get("signature");
  const err = params.get("error") ?? params.get("errorCode");
  let pending: Pending | null = null;
  try { pending = JSON.parse(localStorage.getItem(PENDING) ?? "null"); } catch { pending = null; }
  if (!pending) return null;
  if (err) { localStorage.removeItem(PENDING); history.replaceState(null, "", location.pathname); return { error: "The wallet did not sign the login." }; }
  if (!accountId || !publicKey || !signature) return null;
  localStorage.removeItem(PENDING);
  history.replaceState(null, "", location.pathname + location.search.replace(/[?&](accountId|publicKey|signature)=[^&]*/g, ""));
  return { login: { account_id: accountId, public_key: publicKey, signature, message: pending.message, nonce: pending.nonce, recipient: pending.recipient },
    secret: pending.secret, host: pending.host };
}
