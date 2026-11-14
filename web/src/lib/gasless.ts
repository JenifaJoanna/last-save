// Gas-free holder actions (NEP-366): the player's key signs a delegate action, the relayer wraps it and pays gas.
// The relayer can only pay: it cannot change the signed actions, and it only forwards zero-deposit calls.
// The key is a function-call key this app generates and asks the wallet to add at sign-in (NEAR Connect's
// addFunctionCallKey): it can only call the zero-deposit methods below on this licence instance.
import { newSecret, publicKeyFromSecret, relay, signDelegate, signerFromSecret } from "../../../relayer/client/delegate";
import { CONTRACT, rpc } from "./near";

export const RELAYER_URL: string = (import.meta.env.VITE_RELAYER_URL as string | undefined) ?? "";
const RELAYER_ACCOUNT: string = (import.meta.env.VITE_RELAYER_ACCOUNT as string | undefined) ?? "";
export const GASLESS_METHODS = new Set(["choose", "report_down", "probe_official", "release", "claim_epoch", "sign_evm_payout", "bump_evm_payout", "set_payout_evm"]);
/** Inner gas ceiling: the delegate's function call plus its overhead must fit one 300 Tgas transaction. */
const MAX_INNER_TGAS = 250;
/** The key's own allowance only matters if the account ever sends with it directly; the relayer pays delegate gas. */
export const KEY_ALLOWANCE_YOCTO = "250000000000000000000000";

const slot = (accountId: string) => `lastsave:fckey:${CONTRACT}:${accountId}`;

let covers: Promise<boolean> | null = null;
/** True when the relayer pays for this licence instance (its /health lists CONTRACT). If it does not, the app asks
 *  for no gas-free key and every action goes through the user's wallet instead of failing at the relayer. */
export function relayerCovers(): Promise<boolean> {
  if (!RELAYER_URL) return Promise.resolve(false);
  covers ??= fetch(`${RELAYER_URL.replace(/\/$/, "")}/health`)
    .then((r) => r.json() as Promise<{ ok?: boolean; receivers?: string[] }>)
    .then((h) => !!h.ok && (h.receivers ?? []).includes(CONTRACT))
    .catch(() => { covers = null; return false; });
  return covers;
}

export { newSecret, publicKeyFromSecret };

/** The function-call key this browser holds for `accountId` on this instance, if any. */
export function loadKey(accountId: string): string | null {
  try { const v = localStorage.getItem(slot(accountId)); return v && v.startsWith("ed25519:") ? v : null; } catch { return null; }
}
export function saveKey(accountId: string, secret: string | null): void {
  try { if (secret) localStorage.setItem(slot(accountId), secret); else localStorage.removeItem(slot(accountId)); } catch { /* storage blocked: no gas-free mode */ }
}

type AccessKeyView = { nonce: number; permission: "FullAccess" | { FunctionCall: { receiver_id: string; method_names: string[] } } };

/** True when `publicKey` is on `accountId` and may call this instance (full access, or a function-call key for CONTRACT). */
export async function keyUsable(accountId: string, publicKey: string): Promise<boolean> {
  try {
    const ak = await rpc<AccessKeyView>("query", { request_type: "view_access_key", finality: "optimistic", account_id: accountId, public_key: publicKey });
    return ak.permission === "FullAccess" || ak.permission.FunctionCall.receiver_id === CONTRACT;
  } catch { return false; }
}

/** Waits for a wallet-added key to show up on chain (wallets add it in the sign-in transaction). */
export async function waitForKey(accountId: string, publicKey: string, tries = 10): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (await keyUsable(accountId, publicKey)) return true;
    await sleep(1500);
  }
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Outcome = { status: unknown; receipts_outcome: { outcome: { status: unknown } }[] };

export async function gaslessCall(accountId: string, secret: string, method: string, args: Record<string, unknown>, gasTgas: number): Promise<{ hash: string; failure: string | null; pending?: boolean }> {
  const publicKey = publicKeyFromSecret(secret);
  const [ak, head] = await Promise.all([
    rpc<{ nonce: number }>("query", { request_type: "view_access_key", finality: "final", account_id: accountId, public_key: publicKey }),
    rpc<{ header: { height: number } }>("block", { finality: "final" }),
  ]);
  const signed = await signDelegate({
    senderId: accountId, publicKey, receiverId: CONTRACT, nonce: BigInt(ak.nonce) + 1n, maxBlockHeight: BigInt(head.header.height) + 100n,
    actions: [{ methodName: method, args, gas: BigInt(Math.min(gasTgas, MAX_INNER_TGAS)) * 10n ** 12n }],
  }, signerFromSecret(secret));
  const { hash } = await relay(RELAYER_URL, signed);
  if (!RELAYER_ACCOUNT) return { hash, failure: null, pending: true };
  for (let i = 0; i < 40; i++) {
    try {
      const o = await rpc<Outcome>("EXPERIMENTAL_tx_status", { tx_hash: hash, sender_account_id: RELAYER_ACCOUNT, wait_until: "FINAL" });
      const bad = [o.status, ...o.receipts_outcome.map((r) => r.outcome.status)].find((st) => typeof st === "object" && st && "Failure" in st);
      const text = bad ? JSON.stringify(bad) : null;
      return { hash, failure: text ? (text.match(/"([^"]{8,140})"\}*$/)?.[1] ?? "The contract refused it.") : null };
    } catch { await sleep(2000); }
  }
  return { hash, failure: null, pending: true };
}
