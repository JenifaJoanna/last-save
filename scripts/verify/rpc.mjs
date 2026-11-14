// Read-only NEAR and Base Sepolia access for `pnpm verify`. No keys, no signing, no transactions: only view calls,
// block/tx reads and plain HTTPS GETs. Failover is immediate (a 429 on one node moves to the next, no sleeping), then a short retry round.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = (v, d) => (v ?? d).split(",").map((s) => s.trim()).filter(Boolean);
export const NEAR_RPCS = list(process.env.NEAR_RPCS, "https://test.rpc.fastnear.com,https://near-testnet.drpc.org");
export const ARCHIVAL_RPCS = list(process.env.NEAR_ARCHIVAL_RPCS, "https://archival-rpc.testnet.fastnear.com,https://archival-rpc.testnet.near.org");
export const BASE_RPCS = list(process.env.BASE_SEPOLIA_RPCS, "https://sepolia.base.org,https://base-sepolia-rpc.publicnode.com");

export const nearblocksTx = (h) => `https://testnet.nearblocks.io/txns/${h}`;
export const nearblocksAccount = (a) => `https://testnet.nearblocks.io/address/${a}`;
export const basescanTx = (h) => `https://sepolia.basescan.org/tx/${h}`;

let inflight = 0;
const waiters = [];
const LIMIT = 6; // be gentle: the public endpoints rate-limit, and other jobs on this machine share them
async function slot(fn) {
  while (inflight >= LIMIT) await new Promise((r) => waiters.push(r));
  inflight++;
  try { return await fn(); } finally { inflight--; waiters.shift()?.(); }
}

/** JSON-RPC over `urls` with failover. A JSON-RPC error that is an answer (HANDLER_ERROR, UNKNOWN_*) is thrown with .rpc; transport errors move on. */
export async function jsonRpc(urls, method, params, { timeoutMs = 20_000, rounds = 2 } = {}) {
  let last;
  for (let round = 0; round < rounds; round++) {
    for (const url of urls) {
      try {
        const res = await slot(() => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }));
        if (res.status === 429 || res.status >= 500) throw new Error(`${new URL(url).host} HTTP ${res.status}`);
        const body = await res.json();
        if (body.error) {
          if (body.error.code === -429 || /rate limit/i.test(body.error.message ?? "")) throw new Error(`${new URL(url).host} rate limited`);
          throw Object.assign(new Error(JSON.stringify(body.error.cause ?? body.error).slice(0, 300)), { rpc: body.error });
        }
        return body.result;
      } catch (e) {
        if (e.rpc) throw e;
        last = e;
      }
    }
    await sleep(600 * (round + 1));
  }
  throw last ?? new Error("no RPC endpoint configured");
}

export const nearRpc = (method, params, opts) => jsonRpc(NEAR_RPCS, method, params, opts);

/** Calls a view method; returns the parsed JSON, or `missing` when the contract has no such method (a v1 contract has no evm views). */
export async function view(contract, method, args = {}, { finality = "final", missing = undefined } = {}) {
  const res = await nearRpc("query", { request_type: "call_function", finality, account_id: contract, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
  if (res.error) {
    if (/MethodNotFound|method .* not found|CodeDoesNotExist/i.test(String(res.error)) && missing !== undefined) return missing;
    throw new Error(String(res.error).slice(0, 160));
  }
  const text = Buffer.from(res.result).toString();
  return text ? JSON.parse(text) : null;
}

export async function accountState(id) {
  try { return await nearRpc("query", { request_type: "view_account", finality: "final", account_id: id }); }
  catch (e) { if (/UNKNOWN_ACCOUNT|does not exist/.test(String(e.message))) return null; throw e; }
}
export const accessKeys = async (id) => (await nearRpc("query", { request_type: "view_access_key_list", finality: "final", account_id: id })).keys;

/** Transaction lookup: ordinary nodes first, then archival nodes (ordinary ones forget transactions after ~2.5 days). `full` also returns receipts. */
export async function txLookup(hash, sender, { full = false } = {}) {
  const method = full ? "EXPERIMENTAL_tx_status" : "tx";
  const params = { tx_hash: hash, sender_account_id: sender, wait_until: "EXECUTED" };
  let lastErr;
  for (const urls of [NEAR_RPCS, ARCHIVAL_RPCS]) {
    try { return await jsonRpc(urls, method, params, { timeoutMs: 25_000, rounds: 1 }); }
    catch (e) { lastErr = e; if (e.rpc && !/UNKNOWN_TRANSACTION|NOT_SYNCED|DB Not Found/i.test(JSON.stringify(e.rpc))) break; }
  }
  throw lastErr;
}

/** GET bytes with a size cap; returns { bytes } or { status, error }. Never throws. */
export async function fetchBytes(url, { timeoutMs = 20_000, maxBytes = 64 * 1024 * 1024 } = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    if (!res.ok) return { status: res.status, error: `HTTP ${res.status}` };
    if (Number(res.headers.get("content-length") ?? 0) > maxBytes) return { status: 200, error: "larger than the size cap" };
    return { bytes: Buffer.from(await res.arrayBuffer()), status: res.status };
  } catch (e) { return { status: 0, error: String(e.message).slice(0, 80) }; }
}

export const evmRpc = (method, params = []) => jsonRpc(BASE_RPCS, method, params, { timeoutMs: 15_000 });
