// NEAR JSON-RPC client for Workers: failover across RPC_URLS, backoff on 429/5xx/network errors, 60 s answer cache.
import { toBase64 } from "../../shared/auth";

export class RpcError extends Error {
  constructor(message: string, readonly kind: "handler" | "transport", readonly name_: string = "") { super(message); }
}

export interface ChainOpts {
  urls: string[];
  cacheMs: number;
  backoffMs: number;
  fetchFn?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface LicenceView { token_id: string; owner_id: string; [k: string]: unknown }
export interface ChainInfo { releasedAtMs: number | null; epochMs: number | null }

const ATTEMPTS = 3;

export class Chain {
  private cache = new Map<string, { at: number; value: unknown }>();
  private inflight = new Map<string, Promise<unknown>>();
  private fetchFn: typeof fetch;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;
  constructor(private opts: ChainOpts) {
    this.fetchFn = opts.fetchFn ?? ((i, init) => fetch(i, init));
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Raw JSON-RPC with failover and backoff. A HANDLER_ERROR is a real answer and is thrown without retry. */
  async rpc<T = any>(method: string, params: unknown): Promise<T> {
    let last: unknown = new RpcError("no RPC configured", "transport");
    for (const url of this.opts.urls) {
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        try {
          const res = await this.fetchFn(url, { method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: "ls", method, params }) });
          if (res.status === 429 || res.status >= 500) throw new RpcError(`rpc ${res.status}`, "transport");
          const body = (await res.json()) as { result?: T; error?: { name?: string; cause?: { name?: string }; data?: unknown; message?: string } };
          if (body.error) {
            const name = body.error.cause?.name ?? body.error.name ?? "";
            if (body.error.name === "HANDLER_ERROR" || /UNKNOWN_|INVALID_|NOT_ENOUGH/.test(name)) {
              throw new RpcError(String(body.error.data ?? body.error.message ?? name), "handler", name);
            }
            throw new RpcError(String(body.error.message ?? "rpc error"), "transport", name);
          }
          return body.result as T;
        } catch (e) {
          if (e instanceof RpcError && e.kind === "handler") throw e;
          last = e;
          await this.sleep(this.opts.backoffMs * 2 ** attempt);
        }
      }
    }
    throw last instanceof RpcError ? last : new RpcError(String((last as Error)?.message ?? last), "transport");
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    const t = this.now();
    if (hit && t - hit.at < this.opts.cacheMs) return hit.value as T;
    const running = this.inflight.get(key);
    if (running) return running as Promise<T>;
    const p = load().then((value) => { this.cache.set(key, { at: this.now(), value }); return value; })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  /** true iff `publicKey` is an access key of `accountId` (finality: final). */
  hasAccessKey(accountId: string, publicKey: string): Promise<boolean> {
    return this.cached(`ak|${accountId}|${publicKey}`, async () => {
      try {
        const r = await this.rpc("query", { request_type: "view_access_key", finality: "final", account_id: accountId, public_key: publicKey });
        return !(r && typeof r === "object" && "error" in r);
      } catch (e) {
        if (e instanceof RpcError && e.kind === "handler") return false;
        throw e;
      }
    });
  }

  async view<T = unknown>(contract: string, method: string, args: unknown = {}): Promise<T> {
    const r = await this.rpc<{ result: number[]; error?: string }>("query", {
      request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method,
      args_base64: toBase64(new TextEncoder().encode(JSON.stringify(args))),
    });
    if (r.error) throw new RpcError(r.error, "handler");
    const text = new TextDecoder().decode(Uint8Array.from(r.result));
    return (text ? JSON.parse(text) : null) as T;
  }

  /** licence_of(account) on the licence contract, or null when the account holds no licence. */
  licenceOf(contract: string, accountId: string): Promise<LicenceView | null> {
    return this.cached(`lic|${contract}|${accountId}`, () => this.view<LicenceView | null>(contract, "licence_of", { account_id: accountId }));
  }

  /** Epoch settings for fan hosts, read from get_info. Tolerant of both flat and nested field layouts. */
  async epochInfo(contract: string): Promise<ChainInfo> {
    const info = await this.view<Record<string, any>>(contract, "get_info", {});
    const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
    const released = info?.released_at_ms ?? info?.released_at ?? info?.release?.released_at_ms ?? info?.release?.released_at;
    const epochMs = info?.pool?.epoch_ms ?? info?.config?.pool?.epoch_ms ?? info?.config?.epoch_ms ?? info?.epoch_ms;
    return { releasedAtMs: num(released), epochMs: num(epochMs) };
  }

  clearCache(): void { this.cache.clear(); }
}

export const epochOf = (nowMs: number, info: ChainInfo): number | null =>
  info.releasedAtMs !== null && info.epochMs && nowMs >= info.releasedAtMs ? Math.floor((nowMs - info.releasedAtMs) / info.epochMs) : null;
