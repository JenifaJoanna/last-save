// Shared NEAR helper for scripts: failover RPC with backoff, key loading, calls.
// RPCs: NEAR_RPCS (comma list) or fastnear primary + drpc fallback.
// Keys: LASTSAVE_KEYS_DIR (a near-credentials style dir) or ~/.near-credentials,
// or an in-memory key passed by the caller (generated-account path for demo:fresh).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import nearApi from "near-api-js";

const { Account, Connection, KeyPair, InMemorySigner, keyStores, providers, utils } = nearApi;
export const NETWORK = "testnet";
export const RPCS = (process.env.NEAR_RPCS ?? "https://test.rpc.fastnear.com,https://near-testnet.drpc.org")
  .split(",").map((s) => s.trim()).filter(Boolean);
export const explorerTx = (hash) => `https://testnet.nearblocks.io/txns/${hash}`;
export const explorerAccount = (id) => `https://testnet.nearblocks.io/address/${id}`;
export const NEAR = (n) => BigInt(utils.format.parseNearAmount(String(n)));
export const TGAS = (n) => BigInt(n) * 10n ** 12n;

export function provider() {
  const opts = { retries: 6, backoff: 1.8, wait: 600 };
  return new providers.FailoverRpcProvider(RPCS.map((url) => new providers.JsonRpcProvider({ url }, opts)));
}

export function keyStore(extra = {}) {
  const dir = process.env.LASTSAVE_KEYS_DIR ?? join(homedir(), ".near-credentials");
  const fsStore = new keyStores.UnencryptedFileSystemKeyStore(dir);
  const mem = new keyStores.InMemoryKeyStore();
  const merged = new keyStores.MergeKeyStore([mem, fsStore], { writeKeyStoreIndex: 0 });
  for (const [id, secret] of Object.entries(extra)) mem.setKey(NETWORK, id, KeyPair.fromString(secret));
  return { store: merged, mem };
}

let shared;
export function connection(extraKeys = {}) {
  if (shared && !Object.keys(extraKeys).length) return shared;
  const { store, mem } = keyStore(extraKeys);
  const conn = new Connection(NETWORK, provider(), new InMemorySigner(store), "");
  shared = { conn, store, mem };
  return shared;
}

/** Loads, into memory, whichever local key for `id` is actually an access key on chain. */
const loaded = new Set();
export async function ensureKey(id) {
  if (loaded.has(id)) return;
  const { mem } = connection();
  if (await mem.getKey(NETWORK, id)) { loaded.add(id); return; }
  const dir = join(process.env.LASTSAVE_KEYS_DIR ?? join(homedir(), ".near-credentials"), NETWORK);
  const candidates = [];
  const single = join(dir, `${id}.json`);
  if (existsSync(single)) candidates.push(single);
  if (existsSync(join(dir, id))) for (const f of readdirSync(join(dir, id))) candidates.push(join(dir, id, f));
  const onChain = new Set((await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: id })).keys.map((k) => k.public_key));
  for (const file of candidates) {
    const j = JSON.parse(readFileSync(file, "utf8"));
    const secret = j.private_key ?? j.secret_key;
    if (secret && onChain.has(j.public_key)) { await mem.setKey(NETWORK, id, KeyPair.fromString(secret)); loaded.add(id); return; }
  }
  throw new Error(`no local key for ${id} matches its on-chain access keys`);
}

export const account = (id) => new Account(connection().conn, id);

/** Raw JSON-RPC with failover across RPCS and backoff on 429/5xx/network errors. */
export async function rpc(method, params) {
  let last;
  for (const url of RPCS) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: "ls", method, params }) });
        if (res.status === 429 || res.status >= 500) throw new Error(`${url} ${res.status}`);
        const body = await res.json();
        if (body.error) {
          const err = new Error(JSON.stringify(body.error.cause ?? body.error).slice(0, 400));
          err.rpc = body.error;
          throw err;
        }
        return body.result;
      } catch (e) {
        if (e.rpc && e.rpc.name === "HANDLER_ERROR") throw e; // a real answer, not a transport failure
        last = e;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  }
  throw last;
}

export async function view(contractId, method, args = {}, finality = "optimistic") {
  const res = await rpc("query", {
    request_type: "call_function", finality, account_id: contractId, method_name: method,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  const text = Buffer.from(res.result).toString();
  return text ? JSON.parse(text) : null;
}

/** Signs locally, submits, then polls by hash until FINAL, so a long OutLayer
 * yield (tens of seconds) never loses the tx. Returns { hash, url, value, failure, logs }. */
export async function sendActions(signerId, receiverId, actions) {
  await ensureKey(signerId);
  const { mem } = connection();
  const kp = await mem.getKey(NETWORK, signerId);
  const pk = kp.getPublicKey();
  const ak = await rpc("query", { request_type: "view_access_key", finality: "final", account_id: signerId, public_key: pk.toString() });
  const block = await rpc("block", { finality: "final" });
  const tx = nearApi.transactions.createTransaction(signerId, pk, receiverId, BigInt(ak.nonce) + 1n, actions, utils.serialize.base_decode(block.header.hash));
  const [hashBytes, signed] = await nearApi.transactions.signTransaction(tx, new InMemorySigner(mem), signerId, NETWORK);
  const hash = utils.serialize.base_encode(hashBytes);
  const b64 = Buffer.from(signed.encode()).toString("base64");
  await rpc("send_tx", { signed_tx_base64: b64, wait_until: "INCLUDED" }).catch((e) => {
    if (!/TIMEOUT|timeout|already|InvalidNonce/.test(String(e.message))) throw e;
  });
  let outcome;
  for (let i = 0; i < 60 && !outcome; i++) {
    try {
      const r = await rpc("tx", { tx_hash: hash, sender_account_id: signerId, wait_until: "FINAL" });
      if (r?.final_execution_status === "FINAL" || r?.status?.SuccessValue !== undefined || r?.status?.Failure) outcome = r;
    } catch (e) {
      if (!/TIMEOUT|PENDING|UNKNOWN_TRANSACTION|timeout|429|fetch failed/.test(String(e.message))) throw e;
    }
    if (!outcome) await new Promise((res) => setTimeout(res, 3000));
  }
  if (!outcome) throw new Error(`tx ${hash} not final after polling (${explorerTx(hash)})`);
  const failure = [outcome.status, ...outcome.receipts_outcome.map((r) => r.outcome.status)].find((st) => st?.Failure);
  let value = null;
  try { value = providers.getTransactionLastResult(outcome); } catch { /* no value */ }
  return { hash, url: explorerTx(hash), value, failure: failure?.Failure ?? null, logs: outcome.receipts_outcome.flatMap((r) => r.outcome.logs) };
}

export async function call(signerId, contractId, method, args = {}, { gas = 100, deposit = "0" } = {}) {
  const amount = typeof deposit === "bigint" ? deposit : NEAR(deposit);
  return sendActions(signerId, contractId, [nearApi.transactions.functionCall(method, args, TGAS(gas), amount)]);
}

export async function accountState(id) {
  try {
    return await rpc("query", { request_type: "view_account", finality: "final", account_id: id });
  } catch (e) {
    if (/UNKNOWN_ACCOUNT|does not exist/.test(String(e?.message ?? e))) return null;
    throw e;
  }
}

/** Creates `newId` (a sub-account of parentId) with a fresh key saved to the file key store. */
export async function createSubAccount(parentId, newId, initialNear) {
  await ensureKey(parentId);
  const kp = KeyPair.fromRandom("ed25519");
  await connection().store.keyStores[1].setKey(NETWORK, newId, kp);
  const outcome = await account(parentId).createAccount(newId, kp.getPublicKey(), NEAR(initialNear));
  return { hash: outcome.transaction_outcome.id, url: explorerTx(outcome.transaction_outcome.id), publicKey: kp.getPublicKey().toString() };
}

export async function deploy(accountId, wasmBytes, init) {
  await ensureKey(accountId);
  const acc = account(accountId);
  const actions = [nearApi.transactions.deployContract(wasmBytes)];
  if (init) actions.push(nearApi.transactions.functionCall(init.method, init.args, TGAS(init.gas ?? 50), 0n));
  const outcome = await acc.signAndSendTransaction({ receiverId: accountId, actions });
  return { hash: outcome.transaction_outcome.id, url: explorerTx(outcome.transaction_outcome.id) };
}

export async function deleteAccount(accountId, beneficiaryId) {
  await ensureKey(accountId);
  const outcome = await account(accountId).deleteAccount(beneficiaryId);
  return { hash: outcome.transaction_outcome.id, url: explorerTx(outcome.transaction_outcome.id) };
}
