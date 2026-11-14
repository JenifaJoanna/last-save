// Gas-free holder actions (NEP-366): the player's key signs a delegate action, the relayer wraps it and pays gas.
// The relayer can only pay: it cannot change the signed actions, and it only forwards zero-deposit calls.
import { publicKeyFromSecret, relay, signDelegate, signerFromSecret } from "../../../relayer/client/delegate";
import { CONTRACT, rpc } from "./near";

export const RELAYER_URL: string = (import.meta.env.VITE_RELAYER_URL as string | undefined) ?? "";
const RELAYER_ACCOUNT: string = (import.meta.env.VITE_RELAYER_ACCOUNT as string | undefined) ?? "";
export const GASLESS_METHODS = new Set(["choose", "report_down", "probe_official", "release", "claim_epoch", "sign_evm_payout", "bump_evm_payout", "set_payout_evm"]);
/** Inner gas ceiling: the delegate's function call plus its overhead must fit one 300 Tgas transaction. */
const MAX_INNER_TGAS = 250;

/** A function-call key the wallet left in this browser at sign-in (MyNearWallet's near-api-js keystore), if any. */
export function browserKey(accountId: string): string | null {
  try {
    const v = localStorage.getItem(`near-api-js:keystore:${accountId}:testnet`);
    return v && v.startsWith("ed25519:") ? v : null;
  } catch { return null; }
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
