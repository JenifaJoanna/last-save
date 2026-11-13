// Receipt requests and verification (docs/INTERFACES.md 4.3).
import { toHex, verifyReceipt } from "../../shared/auth";
import type { Receipt } from "../../shared/protocol";

export interface Pending { ts_ms: number; epoch: number | null }

export function newRequest(host: string, epoch: number | null, nowMs: number) {
  return { t: "receipt_req" as const, host, epoch, nonce: toHex(crypto.getRandomValues(new Uint8Array(16))), ts_ms: nowMs };
}

export function checkReceipt(r: Receipt, p: { hostId: string; account: string; pubkey: string; expMs: number; pending: Map<string, Pending> }): string | null {
  const want = p.pending.get(r.nonce);
  if (!want) return "unknown receipt nonce";
  if (r.host !== p.hostId) return "receipt is for a different host";
  if (r.account_id !== p.account) return "receipt is for a different account";
  if (r.epoch !== want.epoch || r.ts_ms !== want.ts_ms) return "receipt does not match the request";
  if (r.ts_ms >= p.expMs) return "login expired before this receipt";
  if (!verifyReceipt(r, p.pubkey)) return "receipt signature does not verify";
  return null;
}
