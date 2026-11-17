// Capture/e2e-only test signer: lets scripts drive every contract action from a local build with testnet test
// accounts. It has no user-facing UI. It runs only on localhost AND only in a build made with VITE_CAPTURE_SIGNER=1;
// a capture script then sets sessionStorage "lastsave.devsigner" = {"accountId","privateKey"} before loading the page,
// or calls window.__lastSaveCapture.signIn({ accountId, privateKey }). It is never "your wallet".
import { CONTRACT } from "./near";

const LOCAL = typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname);
export const DEV_ALLOWED = LOCAL && import.meta.env.VITE_CAPTURE_SIGNER === "1";
const KEY = "lastsave.devsigner";

export interface DevSession { accountId: string; privateKey: string }

export function loadDev(): DevSession | null {
  if (!DEV_ALLOWED) return null;
  try { const j = JSON.parse(sessionStorage.getItem(KEY) ?? "null"); return j?.accountId && j?.privateKey ? j : null; } catch { return null; }
}
export function saveDev(s: DevSession | null): void {
  if (!DEV_ALLOWED) return;
  try { if (s) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

export async function devCall(s: DevSession, method: string, args: Record<string, unknown>, gasTgas: number, depositYocto: string, receiverId: string = CONTRACT): Promise<{ hash: string; failure: string | null }> {
  if (!DEV_ALLOWED) throw new Error("The test signer only runs on localhost.");
  const [{ Buffer }, nearApi] = await Promise.all([import("buffer"), import("near-api-js")]);
  (globalThis as unknown as { Buffer: unknown }).Buffer ??= Buffer;
  const { Account, Connection, InMemorySigner, KeyPair, keyStores, providers } = nearApi;
  const store = new keyStores.InMemoryKeyStore();
  await store.setKey("testnet", s.accountId, KeyPair.fromString(s.privateKey as `ed25519:${string}`));
  const provider = new providers.FailoverRpcProvider(["https://near-testnet.drpc.org", "https://test.rpc.fastnear.com"].map((url) => new providers.JsonRpcProvider({ url }, { retries: 4, backoff: 1.8, wait: 500 })));
  const account = new Account(new Connection("testnet", provider, new InMemorySigner(store), ""), s.accountId);
  const outcome = await account.functionCall({ contractId: receiverId, methodName: method, args, gas: BigInt(gasTgas) * 10n ** 12n, attachedDeposit: BigInt(depositYocto) });
  const failure = [outcome.status, ...outcome.receipts_outcome.map((r) => r.outcome.status)].find((st) => typeof st === "object" && st && "Failure" in st);
  const text = failure ? JSON.stringify(failure) : null;
  return { hash: outcome.transaction_outcome.id, failure: text ? (text.match(/"([^"]{8,140})"\}*$/)?.[1] ?? "The contract refused it.") : null };
}
