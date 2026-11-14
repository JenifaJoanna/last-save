// Walrus testnet blob storage over the public HTTP publisher / aggregator (no key, no account).
// Docs: https://docs.wal.app/docs/http-api/storing-blobs  (PUT /v1/blobs?epochs=N&permanent=true -> newlyCreated | alreadyCertified)
//       https://docs.wal.app/docs/http-api/reading-blobs  (GET /v1/blobs/<blobId>)
// Public endpoints cap a request at 10 MiB. Testnet epochs are 1 day, at most 53 ahead, and testnet may be wiped.
import { createHash } from "node:crypto";

export const WALRUS_TESTNET = {
  publisher: "https://publisher.walrus-testnet.walrus.space",
  aggregator: "https://aggregator.walrus-testnet.walrus.space",
};
export const MAX_PUBLIC_BYTES = 10 * 1024 * 1024;
export const MAX_EPOCHS = 53;

const sha256Hex = (b) => createHash("sha256").update(b).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const walrusBlobUrl = (blobId, aggregator = WALRUS_TESTNET.aggregator) => `${aggregator.replace(/\/$/, "")}/v1/blobs/${blobId}`;
export const storeUrl = (publisher, epochs) => `${publisher.replace(/\/$/, "")}/v1/blobs?epochs=${epochs}&permanent=true`;

/** Pulls { blobId, endEpoch, created } out of a publisher response; throws on anything else. */
export function parseStoreResponse(json) {
  const made = json?.newlyCreated?.blobObject;
  if (made?.blobId) return { blobId: String(made.blobId), endEpoch: made.storage?.endEpoch ?? null, created: true, cost: json.newlyCreated.cost ?? null };
  const had = json?.alreadyCertified;
  if (had?.blobId) return { blobId: String(had.blobId), endEpoch: had.endEpoch ?? null, created: false, cost: null };
  throw new Error(`unexpected publisher response: ${JSON.stringify(json).slice(0, 200)}`);
}

/** PUT bytes to the publisher. Retries 5xx / network errors. Returns { blobId, endEpoch, created, url }. */
export async function walrusStore(bytes, { publisher = WALRUS_TESTNET.publisher, aggregator = WALRUS_TESTNET.aggregator, epochs = MAX_EPOCHS,
  fetchImpl = fetch, retries = 2, backoffMs = 1500, timeoutMs = 120_000 } = {}) {
  if (bytes.length > MAX_PUBLIC_BYTES) throw new Error(`${bytes.length} bytes exceeds the public publisher's 10 MiB limit`);
  if (!Number.isInteger(epochs) || epochs < 1 || epochs > MAX_EPOCHS) throw new Error(`epochs must be 1..${MAX_EPOCHS}`);
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchImpl(storeUrl(publisher, epochs), { method: "PUT", body: bytes, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status >= 400 && res.status < 500) throw Object.assign(new Error(`publisher HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`), { fatal: true });
      if (!res.ok) throw new Error(`publisher HTTP ${res.status}`);
      const out = parseStoreResponse(await res.json());
      return { ...out, url: walrusBlobUrl(out.blobId, aggregator) };
    } catch (e) {
      last = e;
      if (e.fatal) break;
      if (i < retries) await sleep(backoffMs * (i + 1));
    }
  }
  throw new Error(`walrus store failed: ${last?.message ?? last}`);
}

/** GET a blob back and compare its sha256. A just-certified blob can 404 briefly through the aggregator's cache: retry with backoff. */
export async function walrusVerify(blobId, sha256, { aggregator = WALRUS_TESTNET.aggregator, fetchImpl = fetch, retries = 6, backoffMs = 2000, timeoutMs = 60_000 } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchImpl(walrusBlobUrl(blobId, aggregator), { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`aggregator HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const got = sha256Hex(bytes);
      if (got !== String(sha256).toLowerCase()) throw Object.assign(new Error(`blob ${blobId} hashes to ${got}, expected ${sha256}`), { fatal: true });
      return { ok: true, size: bytes.length, sha256: got };
    } catch (e) {
      last = e;
      if (e.fatal) break;
      if (i < retries) await sleep(backoffMs * (i + 1));
    }
  }
  throw new Error(`walrus verify failed: ${last?.message ?? last}`);
}
