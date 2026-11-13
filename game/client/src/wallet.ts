// NEAR wallet sign-in via wallet-selector: one NEP-413 signature binds a session key to the account.
// MyNearWallet signs on its own page and redirects back; Meteor answers in place.
import type { Login } from "../../shared/protocol";

export type WalletId = "meteor-wallet" | "my-near-wallet";
const PENDING = "ember-rift.pending-login";
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));

interface Pending { message: string; nonce: string; recipient: string; secret: string; host: string }

async function selector() {
  const [{ Buffer }, core, meteor, mnw] = await Promise.all([
    import("buffer"),
    import("@near-wallet-selector/core"),
    import("@near-wallet-selector/meteor-wallet"),
    import("@near-wallet-selector/my-near-wallet"),
  ]);
  (globalThis as unknown as { Buffer: unknown }).Buffer ??= Buffer;
  const sel = await core.setupWalletSelector({ network: "testnet", modules: [meteor.setupMeteorWallet(), mnw.setupMyNearWallet()] });
  return { sel, Buffer };
}

/** Asks the wallet to sign the login. Resolves with a Login, or "redirect" when the wallet navigates away. */
export async function walletLogin(id: WalletId, message: string, recipient: string, secretHex: string, host: string): Promise<Login | "redirect"> {
  const { sel, Buffer } = await selector();
  const wallet = await sel.wallet(id);
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const pending: Pending = { message, nonce: b64(nonce), recipient, secret: secretHex, host };
  try { localStorage.setItem(PENDING, JSON.stringify(pending)); } catch { /* private mode: redirect flow cannot resume */ }
  const callbackUrl = location.href.split("#")[0];
  const signed = await wallet.signMessage({ message, recipient, nonce: Buffer.from(nonce), callbackUrl });
  if (!signed) return "redirect";
  try { localStorage.removeItem(PENDING); } catch { /* ignore */ }
  return { account_id: signed.accountId, public_key: signed.publicKey, signature: signed.signature, message, nonce: pending.nonce, recipient };
}

/** After a MyNearWallet redirect: rebuild the login from the URL and the pending record. */
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
