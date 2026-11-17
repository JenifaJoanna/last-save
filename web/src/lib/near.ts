// Read-only NEAR access for the platform: failover RPC with backoff, views, formatting, explorer links.
import { PREVIEW, previewCodeHash, previewKeys, previewView } from "../preview/store";
export const NETWORK = "testnet";
// The default: the first alive standby store (lib/standby.ts picks it before the app loads), else the build's own.
const BUILD_CONTRACT: string = (typeof window !== "undefined" ? window.__lsStandby?.open : undefined)
  ?? (import.meta.env.VITE_LICENCE_CONTRACT as string | undefined) ?? "lastsave-licence.testnet";
const BUILD_FACTORY: string = (import.meta.env.VITE_FACTORY as string | undefined) ?? "lastsave-factory.testnet";
const INSTANCE_KEY = "lastsave:instance";
/** The licence instance this tab shows: ?instance=<name or account> (any factory instance), remembered for the tab, else
 *  the build's default. Picked once at load (switching reloads); ?instance=default returns to the default. */
function pickContract(): string {
  if (PREVIEW || typeof location === "undefined") return BUILD_CONTRACT;
  const ok = (v: string) => v === BUILD_CONTRACT || new RegExp(`^[a-z0-9][a-z0-9-]{0,40}\\.${BUILD_FACTORY.replace(/\./g, "\\.")}$`).test(v);
  try {
    const q = new URLSearchParams(location.search).get("instance");
    if (q !== null) {
      const v = q === "" || q === "default" ? BUILD_CONTRACT : (q.includes(".") ? q : `${q}.${BUILD_FACTORY}`).toLowerCase();
      if (ok(v)) { if (v === BUILD_CONTRACT) sessionStorage.removeItem(INSTANCE_KEY); else sessionStorage.setItem(INSTANCE_KEY, v); return v; }
    }
    const kept = sessionStorage.getItem(INSTANCE_KEY);
    if (kept && ok(kept)) return kept;
  } catch { /* storage blocked: the default instance */ }
  return BUILD_CONTRACT;
}
export const CONTRACT: string = pickContract();
export const DEFAULT_CONTRACT: string = BUILD_CONTRACT;
export const IS_DEFAULT_INSTANCE = CONTRACT === BUILD_CONTRACT;
export const STUDIO: string = (import.meta.env.VITE_STUDIO as string | undefined) ?? "lastsave-studio.testnet";
// Other instances read their official server from their own on-chain config (official_endpoint).
export const OFFICIAL_URL: string = IS_DEFAULT_INSTANCE ? ((import.meta.env.VITE_OFFICIAL_URL as string | undefined) ?? "").replace(/\/$/, "") : "";
const RPCS = ["https://near-testnet.drpc.org", "https://test.rpc.fastnear.com"];

export const txUrl = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;
export const accountUrl = (id: string) => `https://testnet.nearblocks.io/address/${id}`;
export const receiptUrl = (id: string) => `https://testnet.nearblocks.io/txns/${id}`;

export class RpcError extends Error {
  constructor(message: string, readonly kind: "missing" | "network" | "contract") { super(message); }
}

export async function rpc<T>(method: string, params: unknown): Promise<T> {
  let last: unknown;
  for (const url of RPCS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "ls", method, params }) });
        if (r.status === 429 || r.status >= 500) throw new Error(`rpc ${r.status}`);
        const body = await r.json();
        if (body.error) {
          const cause = JSON.stringify(body.error.cause ?? body.error);
          if (/UNKNOWN_ACCOUNT|does not exist|CodeDoesNotExist|MethodNotFound|CompilationError/.test(cause)) throw new RpcError(cause, "missing");
          throw new RpcError(cause, "contract");
        }
        return body.result as T;
      } catch (e) {
        if (e instanceof RpcError) throw e;
        last = e;
        await new Promise((res) => setTimeout(res, 300 * 2 ** attempt));
      }
    }
  }
  throw new RpcError(String(last ?? "RPC unreachable"), "network");
}

export async function view<T>(method: string, args: Record<string, unknown> = {}, contract = CONTRACT): Promise<T> {
  if (PREVIEW) return previewView(method, args) as T;
  const res = await rpc<{ result: number[] }>("query", { request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method,
    args_base64: btoa(JSON.stringify(args)) });
  const text = new TextDecoder().decode(Uint8Array.from(res.result));
  return (text ? JSON.parse(text) : null) as T;
}

export async function accessKeyCount(account: string): Promise<number> {
  if (PREVIEW) return previewKeys();
  const r = await rpc<{ keys: unknown[] }>("query", { request_type: "view_access_key_list", finality: "final", account_id: account });
  return r.keys.length;
}

export async function codeHash(account: string): Promise<string> {
  if (PREVIEW) return previewCodeHash();
  const r = await rpc<{ code_hash: string; global_contract_hash?: string | null }>("query", { request_type: "view_account", finality: "final", account_id: account });
  // An instance that runs a global contract reports the all-ones empty hash as code_hash; the code it runs is global_contract_hash.
  return r.global_contract_hash || r.code_hash;
}

const YOCTO = 10n ** 24n;
/** yoctoNEAR string -> "0.25" style string with up to `dp` decimals. */
export function near(yocto: string | number | bigint | null | undefined, dp = 3): string {
  if (yocto === null || yocto === undefined || yocto === "") return "0";
  let v: bigint;
  try { v = BigInt(String(yocto).split(".")[0]); } catch { return "0"; }
  const neg = v < 0n;
  if (neg) v = -v;
  const whole = v / YOCTO;
  const frac = (v % YOCTO).toString().padStart(24, "0").slice(0, dp).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toLocaleString("en-US")}${frac ? `.${frac}` : ""}`;
}
export const toYocto = (n: string) => {
  const [w, f = ""] = n.split(".");
  return (BigInt(w || "0") * YOCTO + BigInt((f + "0".repeat(24)).slice(0, 24))).toString();
};

export const shortAcct = (a: string) => a.replace(/\.testnet$/, "").replace(/^lastsave-/, "");
export const shortHash = (h: string, n = 6) => (h && h.length > n * 2 + 1 ? `${h.slice(0, n)}…${h.slice(-n)}` : h);

export function ago(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return "never";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 120) return `${s} seconds`;
  const m = Math.round(s / 60);
  if (m < 120) return `${m} minutes`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} hours` : `${Math.round(h / 24)} days`;
}
