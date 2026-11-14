// Mirrors each posted snapshot to Walrus testnet through the public HTTP publisher. Non-blocking and best effort: the on-chain
// snapshot is authoritative, so a failure here is logged in the store and never affects the game or the post_snapshot transaction.
export const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
export const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";
const EPOCHS = 53;

export interface WalrusPut { ok: boolean; blobId: string | null; error: string | null }

/** PUT the canonical snapshot JSON (the exact bytes whose sha256 is on-chain). `publisher` of "off" or "" disables it. */
export async function putSnapshot(json: string, publisher: string, fetchImpl: typeof fetch = fetch): Promise<WalrusPut> {
  if (!publisher || publisher === "off") return { ok: false, blobId: null, error: "disabled" };
  try {
    const res = await fetchImpl(`${publisher.replace(/\/$/, "")}/v1/blobs?epochs=${EPOCHS}&permanent=true`, {
      method: "PUT", body: new TextEncoder().encode(json), signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { ok: false, blobId: null, error: `publisher HTTP ${res.status}` };
    const body = await res.json() as { newlyCreated?: { blobObject?: { blobId?: string } }; alreadyCertified?: { blobId?: string } };
    const blobId = body.newlyCreated?.blobObject?.blobId ?? body.alreadyCertified?.blobId ?? null;
    return blobId ? { ok: true, blobId, error: null } : { ok: false, blobId: null, error: "unexpected publisher response" };
  } catch (e) {
    return { ok: false, blobId: null, error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}
