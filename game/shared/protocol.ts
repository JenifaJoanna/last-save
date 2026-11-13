// Ember Rift wire protocol (JSON over one WebSocket at GET /ws). Owned by the coordinator.
// Server is authoritative; the client predicts only its own skiff and reconciles on `ack`.

export const PROTOCOL_VERSION = 1;

/** NEP-413 login (docs/INTERFACES.md §4.2). `message` is the JSON string that was signed. */
export interface Login {
  account_id: string;
  public_key: string; // "ed25519:<base58>"
  signature: string; // base64
  message: string; // {"app":"ember-rift","host":…,"session_pubkey":…,"exp_ms":…}
  nonce: string; // base64, 32 bytes
  recipient: string; // licence contract id
}

/** Session receipt signed by the session key (INTERFACES §4.3). */
export interface Receipt {
  host: string;
  epoch: number | null;
  nonce: string; // hex, 16 bytes
  ts_ms: number;
  account_id: string;
  signature: string; // base64
}

export interface Profile {
  account_id: string;
  level: number;
  xp: number;
  /** xp needed for the next level, so the client can draw progress */
  next_level_xp: number;
  skin: SkinId;
  matches: number;
}

export type SkinId = "standard" | "emberwing";
export type Phase = "lobby" | "countdown" | "live" | "results";

// ---------- client -> server ----------
export type ClientMsg =
  | { t: "hello"; v: number; login: Login }
  | { t: "input"; seq: number; ax: number; ay: number; dash: boolean }
  | { t: "receipt"; receipt: Receipt }
  | { t: "ping"; c: number };

// ---------- server -> client ----------
export interface ShipState {
  id: string; // account id
  slot: number; // 0..7, drives colour
  x: number; y: number; vx: number; vy: number;
  a: number; // facing angle, radians
  st: "alive" | "falling" | "respawning";
  dash: number; // ms of dash remaining (0 = not dashing)
  cd: number; // ms until dash is ready
  inv: number; // ms of spawn protection remaining
  shards: number;
  kos: number;
  level: number;
  skin: SkinId;
}

export interface ShardState { id: number; x: number; y: number; v: number /* value: 1 or 5 (ember core) */ }

export type GameEvent =
  | { k: "collect"; id: string; x: number; y: number; v: number }
  | { k: "hit"; a: string; b: string; x: number; y: number; power: number }
  | { k: "ko"; victim: string; by: string | null; x: number; y: number }
  | { k: "dash"; id: string }
  | { k: "spawn"; id: string; x: number; y: number }
  | { k: "core"; x: number; y: number };

export interface Snap {
  t: "snap";
  tick: number;
  phase: Phase;
  t_left_ms: number;
  ack: number; // last input seq applied for the receiving client
  ships: ShipState[];
  shards: ShardState[];
  ev: GameEvent[];
}

export interface MatchResult {
  account_id: string;
  place: number;
  shards: number;
  kos: number;
  score: number;
  xp_gained: number;
  level_before: number;
  level_after: number;
  unlocked: SkinId | null;
}

export type DeniedCode = "bad_signature" | "no_access_key" | "no_licence" | "expired" | "replay" | "wrong_host" | "full" | "bad_version";

export type ServerMsg =
  | { t: "welcome"; you: Profile; host_id: string; build_hash: string; epoch: number | null; tick_hz: number }
  | { t: "denied"; code: DeniedCode; error: string }
  | Snap
  | { t: "receipt_req"; host: string; epoch: number | null; nonce: string; ts_ms: number }
  | { t: "results"; match_id: string; results: MatchResult[]; snapshot_seq: number | null }
  | { t: "profile"; you: Profile }
  | { t: "pong"; c: number; s: number }
  | { t: "notice"; text: string };
