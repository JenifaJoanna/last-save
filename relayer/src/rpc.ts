// JSON-RPC with failover across URLs and backoff on 429/5xx/network errors.
import { RelayError } from "./policy";

export interface RpcDeps {
  urls: string[];
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

export const DEFAULT_RPCS = "https://test.rpc.fastnear.com,https://near-testnet.drpc.org";

export async function rpc<T = any>(deps: RpcDeps, method: string, params: unknown): Promise<T> {
  let last: unknown;
  for (const url of deps.urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await deps.fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: "relay", method, params }),
        });
        if (res.status === 429 || res.status >= 500) throw new Error(`rpc status ${res.status}`);
        const body = (await res.json()) as { result?: T; error?: { name?: string; cause?: { name?: string }; data?: unknown; message?: string } };
        if (body.error) {
          // HANDLER_ERROR / REQUEST_VALIDATION_ERROR are real answers, not transport failures.
          if (body.error.name === "HANDLER_ERROR" || body.error.name === "REQUEST_VALIDATION_ERROR") {
            throw new RpcAnswer(body.error.cause?.name ?? body.error.name, JSON.stringify(body.error.cause ?? body.error).slice(0, 300));
          }
          throw new Error(body.error.name ?? body.error.message ?? "rpc error");
        }
        return body.result as T;
      } catch (e) {
        if (e instanceof RpcAnswer) throw e;
        last = e;
        await deps.sleep(300 * 2 ** attempt);
      }
    }
  }
  throw new RelayError("RPC_UNAVAILABLE", `no NEAR RPC answered (${last instanceof Error ? last.message : "unknown"})`, 502);
}

export class RpcAnswer extends Error {
  constructor(public kind: string, message: string) { super(message); }
}
