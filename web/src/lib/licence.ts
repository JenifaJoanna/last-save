// Contract read model: normalises get_info and friends defensively, polls, exposes hooks.
import { useEffect, useRef, useState } from "react";
import { accessKeyCount, CONTRACT, RpcError, view } from "./near";

type J = Record<string, unknown>;
const o = (v: unknown): J => (v && typeof v === "object" ? (v as J) : {});
const s = (v: unknown, d = ""): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : d);
const n = (v: unknown, d = 0): number => (typeof v === "number" ? v : typeof v === "string" && v !== "" && !isNaN(Number(v)) ? Number(v) : d);
const b = (v: unknown): boolean => v === true;

export interface Info {
  title: string; studio: string; price: string; fundBps: number; royaltyBps: number;
  status: "Alive" | "Dead"; cause: string | null; diedAt: number | null;
  escrowed: boolean; escrowVerified: boolean; attestedAt: number | null;
  releaseState: "Sealed" | "InFlight" | "Released"; releasedKey: string | null; releasedAt: number | null; releaseError: string | null;
  supply: number; liveSupply: number; potLocked: string; pool: string; refunded: string; pledged: string; paidOut: string;
  failures: number; failThreshold: number; lastAlive: number | null; lastProbe: number | null; probeInFlight: boolean; probeError: string | null;
  probeIntervalMs: number; receiptWindowMs: number; reportWindowMs: number; quorumBps: number; reportsInWindow: number; reportsNeeded: number | null;
  epochMs: number; payPerSession: string; epochCap: string; currentEpoch: number | null;
  officialEndpoint: string; artifactSha: string; buildHash: string; releaseSha: string; probeSha: string; keyCommitment: string;
  snapshot: { seq: number; hash: string; at: number } | null;
}

export function normalizeInfo(raw: unknown): Info {
  const r = o(raw), c = o(r.config), live = o(c.liveness), pool = o(c.pool), t = o(r.totals), p = o(r.probe), rel = o(r.release);
  const snap = o(r.snapshot);
  const releasedKey = s(r.released_key ?? rel.released_key) || null;
  const state = s(rel.state ?? r.release_state, releasedKey || b(rel.released) ? "Released" : b(rel.in_flight) ? "InFlight" : "Sealed");
  return {
    title: s(c.title, "Ember Rift"), studio: s(c.studio), price: s(c.price, "0"), fundBps: n(c.fund_bps), royaltyBps: n(c.royalty_bps),
    status: s(r.status) === "Dead" ? "Dead" : "Alive", cause: s(r.cause) || null, diedAt: n(r.died_at_ms) || null,
    escrowed: b(r.escrowed), escrowVerified: b(r.escrow_verified), attestedAt: n(r.attested_at_ms) || null,
    releaseState: (["Sealed", "InFlight", "Released"].includes(state) ? state : releasedKey ? "Released" : "Sealed") as Info["releaseState"],
    releasedKey, releasedAt: n(r.released_at_ms ?? rel.released_at_ms) || null, releaseError: s(rel.last_error ?? r.release_error) || null,
    supply: n(t.supply), liveSupply: n(t.live_supply), potLocked: s(t.pot_locked, "0"), pool: s(t.pool, "0"), refunded: s(t.refunded, "0"),
    pledged: s(t.pledged, "0"), paidOut: s(t.paid_out, "0"),
    failures: n(p.consecutive_failures), failThreshold: n(live.fail_threshold, 3), lastAlive: n(p.last_alive_ms) || null, lastProbe: n(p.last_probe_ms) || null,
    probeInFlight: b(p.in_flight), probeError: s(p.last_error) || null,
    probeIntervalMs: n(live.probe_interval_ms), receiptWindowMs: n(live.receipt_window_ms), reportWindowMs: n(live.report_window_ms), quorumBps: n(live.quorum_bps, 5000),
    reportsInWindow: n(r.reports_in_window), reportsNeeded: r.reports_needed === undefined || r.reports_needed === null ? null : n(r.reports_needed), epochMs: n(pool.epoch_ms), payPerSession: s(pool.pay_per_session, "0"), epochCap: s(pool.epoch_cap, "0"),
    currentEpoch: r.current_epoch === null || r.current_epoch === undefined ? null : n(r.current_epoch),
    officialEndpoint: s(c.official_endpoint), artifactSha: s(o(c.artifact).sha256), buildHash: s(o(c.artifact).build_hash),
    releaseSha: s(o(c.release).sha256), probeSha: s(o(c.probe).sha256), keyCommitment: s(c.key_commitment),
    snapshot: snap.hash ? { seq: n(snap.seq), hash: s(snap.hash), at: n(snap.at_ms) } : null,
  };
}

export interface LicenceView { tokenId: string; owner: string; potShare: string; choice: string | null; mintedAt: number; postDeath: boolean }
export const normalizeLicence = (raw: unknown): LicenceView | null => {
  if (!raw) return null;
  const r = o(raw);
  return { tokenId: s(r.token_id), owner: s(r.owner_id), potShare: s(r.pot_share, "0"), choice: s(r.choice) || null, mintedAt: n(r.minted_at_ms), postDeath: b(r.post_death) };
};

export interface HostView { hostId: string; endpoint: string; registeredAt: number; epochsPaid: number; sessionsPaid: number; earned: string }
export const normalizeHosts = (raw: unknown): HostView[] => (Array.isArray(raw) ? raw : []).map((h) => {
  const r = o(h);
  return { hostId: s(r.host_id), endpoint: s(r.endpoint), registeredAt: n(r.registered_at_ms), epochsPaid: n(r.epochs_paid), sessionsPaid: n(r.sessions_paid), earned: s(r.earned, "0") };
});

export interface Activity { kind: string; at: number; text: string; detail: J }
export const normalizeActivity = (raw: unknown): Activity[] => (Array.isArray(raw) ? raw : []).map((a) => {
  const r = o(a);
  return { kind: s(r.kind ?? r.event ?? r.type, "event"), at: n(r.at_ms ?? r.timestamp_ms ?? r.at), text: s(r.text ?? r.summary ?? r.result), detail: r };
});

export type Load<T> = { data: T | null; error: string | null; missing: boolean; loading: boolean; refresh: () => void };

/** Polls a view; keeps the last good value through transient RPC failures. */
export function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[] = []): Load<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; missing: boolean; loading: boolean }>({ data: null, error: null, missing: false, loading: true });
  const tick = useRef(0);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    const id = ++tick.current;
    const run = async () => {
      try {
        const data = await fn();
        if (alive && id === tick.current) setState({ data, error: null, missing: false, loading: false });
      } catch (e) {
        if (!alive || id !== tick.current) return;
        const missing = e instanceof RpcError && e.kind === "missing";
        setState((prev) => ({ data: prev.data, error: missing ? null : "Could not reach NEAR testnet. Retrying…", missing, loading: false }));
      }
    };
    void run();
    const t = window.setInterval(run, ms);
    return () => { alive = false; window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, ms]);
  return { ...state, refresh: () => setNonce((x) => x + 1) };
}

export const useInfo = (ms = 4000) => usePoll(async () => normalizeInfo(await view("get_info")), ms);
export const useMyLicence = (accountId: string | null, ms = 6000) =>
  usePoll(async () => (accountId ? normalizeLicence(await view("licence_of", { account_id: accountId })) : null), ms, [accountId]);
export const useHosts = (ms = 8000) => usePoll(async () => normalizeHosts(await view("get_hosts")), ms);
export const useActivity = (ms = 4000) => usePoll(async () => normalizeActivity(await view("get_activity", { limit: 30 })), ms);
export const useLockedKeys = () => usePoll(() => accessKeyCount(CONTRACT), 30000);
export const useTokens = (ms = 8000) => usePoll(async () => {
  const raw = await view<unknown[]>("nft_tokens", { from_index: "0", limit: 50 });
  return (Array.isArray(raw) ? raw : []).map((t) => ({ tokenId: s(o(t).token_id), owner: s(o(t).owner_id) }));
}, ms);

export interface PlayerProgress { level: number; xp: number; skin: string; matches: number; kos: number; shards: number }
/** Latest on-chain progress snapshot (the copy that outlives the studio). */
export const useSnapshot = (ms = 10000) => usePoll(async () => {
  const raw = o(await view("get_snapshot"));
  if (!raw.blob_base64) return null;
  let players: Record<string, PlayerProgress> = {};
  try {
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s(raw.blob_base64)), (c) => c.charCodeAt(0))));
    players = o(json.players) as unknown as Record<string, PlayerProgress>;
  } catch { players = {}; }
  return { seq: n(raw.seq), hash: s(raw.hash), at: n(raw.at_ms), players };
}, ms);
