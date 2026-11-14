// Best-effort: the official server lists the Walrus blob ids of its latest snapshots at /health. When it is still up, find the one for the
// snapshot being restored and confirm the blob hashes to the on-chain snapshot hash. The on-chain snapshot stays authoritative.
import { createHash } from "node:crypto";
import { walrusBlobUrl } from "./walrus.mjs";

export async function walrusFindSnapshot({ endpoint, restore, fetchImpl = fetch }) {
  if (!endpoint || !restore) return null;
  const res = await fetchImpl(`${endpoint.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return null;
  const health = await res.json();
  const row = (health?.walrus?.latest ?? []).find((r) => Number(r.seq) === Number(restore.seq));
  if (!row?.blob_id) return null;
  const url = row.url ?? walrusBlobUrl(row.blob_id, health.walrus.aggregator);
  const blob = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) });
  if (!blob.ok) return null;
  const hash = createHash("sha256").update(Buffer.from(await blob.arrayBuffer())).digest("hex");
  return hash === String(restore.hash).toLowerCase() ? { blob_id: row.blob_id, url } : null;
}
