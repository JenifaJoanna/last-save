// NEAR wallet sign-in via NEAR Connect (@hot-labs/near-connect): one NEP-413 signature binds a session key to the
// account, in two taps: connect, then sign (see connectWallet).
import type { NearConnector, NearWalletBase, SignedMessage } from "@hot-labs/near-connect";
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

/** Step 1, one tap: connect a wallet through NEAR Connect (no message yet), or reuse the one already connected.
 *  Signing in two taps is deliberate: a wallet that signs in its own window (Meteor web) opens that window only from a
 *  fresh tap. The old one-step connect-and-sign lost Meteor's signature and then opened a second, blocked window. */
export async function connectWallet(): Promise<{ wallet: NearWalletBase; accountId: string }> {
  const c = await connector();
  try {
    const w = await c.wallet();
    const a = await w.getAccounts();
    if (a[0]?.accountId) return { wallet: w, accountId: a[0].accountId };
  } catch { /* nothing connected yet */ }
  const w = await c.connect();
  const a = await w.getAccounts();
  if (!a[0]?.accountId) throw new Error("The wallet did not share an account.");
  return { wallet: w, accountId: a[0].accountId };
}

/** Step 2, called straight from a tap: the wallet signs the NEP-413 login. Nothing is awaited before signMessage, so a
 *  wallet window opens inside the tap. Resolves with a Login, or "redirect" when the wallet navigates away. */
export function signLogin(wallet: NearWalletBase, message: string, recipient: string, secretHex: string, host: string): Promise<Login | "redirect"> {
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const pending: Pending = { message, nonce: b64(nonce), recipient, secret: secretHex, host };
  try { localStorage.setItem(PENDING, JSON.stringify(pending)); } catch { /* private mode: redirect flow cannot resume */ }
  return wallet.signMessage({ message, recipient, nonce }).then((signed: SignedMessage | null | undefined) => {
    if (!signed) return "redirect" as const;
    try { localStorage.removeItem(PENDING); } catch { /* ignore */ }
    return { account_id: signed.accountId, public_key: signed.publicKey, signature: signed.signature, message, nonce: pending.nonce, recipient };
  });
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
