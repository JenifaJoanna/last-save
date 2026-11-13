// Read-only NEAR access for the platform: failover RPC with backoff, views, formatting, explorer links.
export const NETWORK = "testnet";
export const CONTRACT: string = (import.meta.env.VITE_LICENCE_CONTRACT as string | undefined) ?? "lastsave-licence.testnet";
export const STUDIO: string = (import.meta.env.VITE_STUDIO as string | undefined) ?? "lastsave-studio.testnet";
export const OFFICIAL_URL: string = ((import.meta.env.VITE_OFFICIAL_URL as string | undefined) ?? "").replace(/\/$/, "");
const RPCS = ["https://test.rpc.fastnear.com", "https://near-testnet.drpc.org"];

export const txUrl = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;
export const accountUrl = (id: string) => `https://testnet.nearblocks.io/address/${id}`;
export const receiptUrl = (id: string) => `https://testnet.nearblocks.io/txns/${id}`;

export class RpcError extends Error {
  constructor(message: string, readonly kind: "missing" | "network" | "contract") { super(message); }
}

async function rpc<T>(method: string, params: unknown): Promise<T> {
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
  const res = await rpc<{ result: number[] }>("query", { request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method,
    args_base64: btoa(JSON.stringify(args)) });
  const text = new TextDecoder().decode(Uint8Array.from(res.result));
  return (text ? JSON.parse(text) : null) as T;
}

export async function accessKeyCount(account: string): Promise<number> {
  const r = await rpc<{ keys: unknown[] }>("query", { request_type: "view_access_key_list", finality: "final", account_id: account });
  return r.keys.length;
}

export async function codeHash(account: string): Promise<string> {
  const r = await rpc<{ code_hash: string }>("query", { request_type: "view_account", finality: "final", account_id: account });
  return r.code_hash;
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
