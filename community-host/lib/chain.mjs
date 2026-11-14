// Read-only views on the licence contract over NEAR JSON-RPC, with failover. Same shape the host CLI's chain object has.
import { Refusal } from "../vendor/refusal.mjs";

export function chainFor(contract, rpcs, fetchImpl = fetch) {
  async function view(method, args = {}) {
    let last = "no RPC answered";
    for (const url of rpcs) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(20_000),
            body: JSON.stringify({ jsonrpc: "2.0", id: "ch", method: "query", params: { request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } }) });
          if (res.status === 429 || res.status >= 500) throw new Error(`${new URL(url).host} HTTP ${res.status}`);
          const body = await res.json();
          const result = body.result;
          if (result?.error) throw new Refusal("no_instance", `${contract} is not a Last Save licence instance (${String(result.error).slice(0, 120)}).`);
          if (body.error?.cause?.name === "UNKNOWN_ACCOUNT") throw new Refusal("no_instance", `${contract} does not exist on NEAR testnet. Check LICENCE_CONTRACT.`);
          if (body.error) throw new Error(String(body.error.cause?.name ?? body.error.name ?? "rpc error"));
          const text = Buffer.from(result.result).toString();
          return text ? JSON.parse(text) : null;
        } catch (e) {
          if (e instanceof Refusal) throw e;
          last = e.message;
          await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
        }
      }
    }
    throw new Refusal("chain_unreachable", `Could not read ${contract} from NEAR (${last}).`);
  }
  return { info: () => view("get_info"), releaseInfo: () => view("release_info"), snapshot: () => view("get_snapshot") };
}
