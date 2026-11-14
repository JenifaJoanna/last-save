// Tries the artifact mirrors in order and stops at the first copy whose sha256 matches the chain. One log line per mirror.
import { createHash } from "node:crypto";

const sha256Hex = (b) => createHash("sha256").update(b).digest("hex");

export async function defaultFetchBytes(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > 64 * 1024 * 1024) throw new Error("artifact is larger than 64 MiB");
  return Buffer.from(await res.arrayBuffer());
}

/** Human name for a mirror: the studio's own copy (kiln-cdn-*), Walrus, GitHub raw, the platform's Pages mirror, else the host. */
export function mirrorLabel(url) {
  const host = new URL(url).host;
  if (host.startsWith("kiln-cdn-")) return "studio copy";
  if (host.includes("walrus")) return "walrus";
  if (host === "raw.githubusercontent.com") return "github raw";
  if (host === "last-save.pages.dev") return "platform mirror";
  return "mirror";
}

/** 404/410, or Cloudflare 52x/530 (a deleted Pages project: the hostname no longer has an origin). */
const isGone = (st) => st === 404 || st === 410 || (st >= 520 && st <= 530);
const statusOf = (e) => e.status ?? Number(/HTTP (\d{3})/.exec(String(e.message))?.[1] ?? 0);

/**
 * Returns { bytes, url, tried: [{ url, label, outcome }], tampered }. Never throws for a bad mirror; the caller decides what no copy means.
 * Outcomes: "ok", "mismatch" (served bytes with the wrong sha256), "gone" (404/410), "error".
 */
export async function fetchFromMirrors({ urls, sha256, fetchBytes = defaultFetchBytes, log = () => {} }) {
  const want = String(sha256).toLowerCase();
  const tried = [];
  for (const url of urls) {
    const label = mirrorLabel(url);
    const host = new URL(url).host;
    try {
      const bytes = await fetchBytes(url);
      if (sha256Hex(bytes) === want) {
        log(`${label} ${host} … 200, sha256 matches on-chain ✓ (${bytes.length} bytes)`);
        tried.push({ url, label, outcome: "ok" });
        return { bytes, url, label, tried, tampered: tried.some((t) => t.outcome === "mismatch") };
      }
      log(`${label} ${host} … 200, sha256 DOES NOT match on-chain ✗ (skipped)`);
      tried.push({ url, label, outcome: "mismatch" });
    } catch (e) {
      const st = statusOf(e);
      if (isGone(st)) log(`${label} ${host} … ${st} (gone)`);
      else log(`${label} ${host} … ${st ? `HTTP ${st}` : "unreachable"}${st ? "" : ` (${String(e.message).slice(0, 80)})`}`);
      tried.push({ url, label, outcome: isGone(st) ? "gone" : "error", error: String(e.message).slice(0, 120) });
    }
  }
  return { bytes: null, url: null, label: null, tried, tampered: tried.some((t) => t.outcome === "mismatch") };
}
