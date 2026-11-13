// Ember Rift simulation: pure, deterministic for a given seed and input order.
// The server runs `step` at TICK_HZ; the client reuses `moveShip` to predict its own skiff.
import type { GameEvent, MatchResult, Phase, ShardState, ShipState, SkinId, Snap } from "./protocol";

export const TICK_HZ = 30;
export const DT = 1 / TICK_HZ;
export const ARENA_R = 620;
export const SHIP_R = 18;
const ACCEL = 900;
const DRAG = 2.6;
const DASH_DRAG = 0.9;
const DASH_IMPULSE = 540;
export const DASH_MS = 260;
export const DASH_CD_MS = 2200;
const KNOCK = 420;
const RESTITUTION = 0.85;
export const MATCH_MS = 90_000;
const COUNTDOWN_MS = 3_000;
const RESULTS_MS = 8_000;
const FALL_MS = 600;
const RESPAWN_MS = 1_400;
const INV_MS = 1_500;
const COLLECT_R = 28;
const MAX_SHARDS = 14;
const SHARD_EVERY_MS = 850;
const CORE_EVERY_MS = 20_000;
const CORE_VALUE = 5;
const KO_CREDIT_MS = 3_000;
const MAX_SHIPS = 8;
const TICK_MS = 1000 / TICK_HZ;

export interface Input { ax: number; ay: number; dash: boolean }

export interface Ship extends Omit<ShipState, "st"> {
  st: ShipState["st"];
  input: Input;
  dashHeld: boolean;
  fallMs: number;
  respawnMs: number;
  lastHitBy: string | null;
  lastHitAt: number;
  ack: number;
}

export interface World {
  tick: number;
  timeMs: number;
  phase: Phase;
  phaseLeftMs: number;
  ships: Map<string, Ship>;
  shards: ShardState[];
  nextShardId: number;
  shardTimer: number;
  coreTimer: number;
  rng: number;
  events: GameEvent[];
  /** set on the tick a match ends; the host persists it and clears it */
  ended: MatchResult[] | null;
  matchNo: number;
}

export function createWorld(seed = 1): World {
  return { tick: 0, timeMs: 0, phase: "lobby", phaseLeftMs: 0, ships: new Map(), shards: [], nextShardId: 1,
    shardTimer: 0, coreTimer: CORE_EVERY_MS / 2, rng: seed >>> 0 || 1, events: [], ended: null, matchNo: 0 };
}

function rand(w: World): number { // mulberry32
  w.rng = (w.rng + 0x6d2b79f5) >>> 0;
  let t = w.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const levelFor = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
export const xpForLevel = (level: number) => (level - 1) ** 2 * 100;
export const skinFor = (level: number): SkinId => (level >= 3 ? "emberwing" : "standard");

function spawnPoint(w: World): { x: number; y: number } {
  for (let i = 0; i < 12; i++) {
    const ang = rand(w) * Math.PI * 2;
    const r = ARENA_R * (0.35 + rand(w) * 0.35);
    const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
    let clear = true;
    for (const s of w.ships.values()) if (s.st === "alive" && Math.hypot(s.x - x, s.y - y) < SHIP_R * 6) clear = false;
    if (clear) return { x, y };
  }
  return { x: 0, y: ARENA_R * 0.5 };
}

export function addShip(w: World, id: string, profile: { level: number; skin: SkinId }): Ship | null {
  const existing = w.ships.get(id);
  if (existing) return existing;
  if (w.ships.size >= MAX_SHIPS) return null;
  const used = new Set([...w.ships.values()].map((s) => s.slot));
  let slot = 0;
  while (used.has(slot)) slot++;
  const p = spawnPoint(w);
  const ship: Ship = { id, slot, x: p.x, y: p.y, vx: 0, vy: 0, a: Math.atan2(-p.y, -p.x), st: "alive", dash: 0, cd: 0,
    inv: INV_MS, shards: 0, kos: 0, level: profile.level, skin: profile.skin, input: { ax: 0, ay: 0, dash: false },
    dashHeld: false, fallMs: 0, respawnMs: 0, lastHitBy: null, lastHitAt: -1e9, ack: 0 };
  w.ships.set(id, ship);
  w.events.push({ k: "spawn", id, x: ship.x, y: ship.y });
  return ship;
}

export function removeShip(w: World, id: string): void { w.ships.delete(id); }

export function setInput(w: World, id: string, input: Input, seq: number): void {
  const s = w.ships.get(id);
  if (!s || seq <= s.ack) return;
  const len = Math.hypot(input.ax, input.ay);
  const k = len > 1 ? 1 / len : 1;
  s.input = { ax: (Number(input.ax) || 0) * k, ay: (Number(input.ay) || 0) * k, dash: !!input.dash };
  s.ack = seq;
}

/** Movement for one skiff over dt seconds. Shared with client-side prediction. Returns true if a dash fired. */
export function moveShip(s: Pick<Ship, "x" | "y" | "vx" | "vy" | "a" | "dash" | "cd" | "inv" | "input" | "dashHeld">, dt: number): boolean {
  const { ax, ay, dash } = s.input;
  const len = Math.hypot(ax, ay);
  if (len > 0.08) {
    s.vx += (ax / Math.max(len, 1)) * ACCEL * dt;
    s.vy += (ay / Math.max(len, 1)) * ACCEL * dt;
    const target = Math.atan2(ay, ax);
    let d = target - s.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    s.a += d * Math.min(1, dt * 14);
  }
  let fired = false;
  if (dash && !s.dashHeld && s.cd <= 0) {
    const dir = len > 0.08 ? Math.atan2(ay, ax) : s.a;
    s.vx += Math.cos(dir) * DASH_IMPULSE;
    s.vy += Math.sin(dir) * DASH_IMPULSE;
    s.a = dir;
    s.dash = DASH_MS;
    s.cd = DASH_CD_MS;
    fired = true;
  }
  s.dashHeld = dash;
  const f = Math.exp(-(s.dash > 0 ? DASH_DRAG : DRAG) * dt);
  s.vx *= f; s.vy *= f;
  s.x += s.vx * dt; s.y += s.vy * dt;
  const ms = dt * 1000;
  s.dash = Math.max(0, s.dash - ms); s.cd = Math.max(0, s.cd - ms); s.inv = Math.max(0, s.inv - ms);
  return fired;
}

function collide(w: World, a: Ship, b: Ship): void {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d >= SHIP_R * 2 || d === 0) return;
  const nx = dx / d, ny = dy / d;
  const overlap = SHIP_R * 2 - d;
  a.x -= nx * overlap / 2; a.y -= ny * overlap / 2; b.x += nx * overlap / 2; b.y += ny * overlap / 2;
  const vrel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vrel >= 0) return;
  const j = (-(1 + RESTITUTION) * vrel) / 2;
  a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny;
  if (a.dash > 0) { b.vx += nx * KNOCK; b.vy += ny * KNOCK; }
  if (b.dash > 0) { a.vx -= nx * KNOCK; a.vy -= ny * KNOCK; }
  b.lastHitBy = a.id; b.lastHitAt = w.timeMs; a.lastHitBy = b.id; a.lastHitAt = w.timeMs;
  w.events.push({ k: "hit", a: a.id, b: b.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, power: Math.round(-vrel + (a.dash || b.dash ? KNOCK : 0)) });
}

function spawnShard(w: World, x: number, y: number, v: number): void {
  w.shards.push({ id: w.nextShardId++, x: Math.round(x), y: Math.round(y), v });
}

function knockOut(w: World, s: Ship): void {
  s.st = "falling"; s.fallMs = FALL_MS; s.dash = 0;
  const by = s.lastHitBy && w.timeMs - s.lastHitAt <= KO_CREDIT_MS ? s.lastHitBy : null;
  const killer = by ? w.ships.get(by) : undefined;
  if (killer) killer.kos++;
  const lost = Math.ceil(s.shards / 2);
  s.shards -= lost;
  const ang = Math.atan2(s.y, s.x);
  for (let i = 0; i < lost && w.shards.length < MAX_SHARDS + 10; i++) {
    const r = ARENA_R * (0.72 + rand(w) * 0.12), off = (rand(w) - 0.5) * 0.5;
    spawnShard(w, Math.cos(ang + off) * r, Math.sin(ang + off) * r, 1);
  }
  w.events.push({ k: "ko", victim: s.id, by: killer ? killer.id : null, x: s.x, y: s.y });
}

function resetForMatch(w: World): void {
  w.shards = []; w.shardTimer = 0; w.coreTimer = CORE_EVERY_MS / 2;
  for (const s of w.ships.values()) {
    const p = spawnPoint(w);
    Object.assign(s, { x: p.x, y: p.y, vx: 0, vy: 0, st: "alive", shards: 0, kos: 0, dash: 0, cd: 0, inv: INV_MS, lastHitBy: null });
  }
}

export const scoreOf = (s: { shards: number; kos: number }) => s.shards + 2 * s.kos;

function finishMatch(w: World): void {
  const ranked = [...w.ships.values()].sort((a, b) => scoreOf(b) - scoreOf(a) || b.kos - a.kos || a.slot - b.slot);
  const bonus = [60, 30, 15];
  w.ended = ranked.map((s, i) => ({ account_id: s.id, place: i + 1, shards: s.shards, kos: s.kos, score: scoreOf(s),
    xp_gained: scoreOf(s) * 10 + 50 + (bonus[i] ?? 0), level_before: s.level, level_after: s.level, unlocked: null }));
  w.matchNo++;
}

/** Advance one tick. Events for this tick are in w.events (cleared at the start of the next step). */
export function step(w: World): void {
  w.events = [];
  w.tick++; w.timeMs += TICK_MS;
  w.phaseLeftMs = Math.max(0, w.phaseLeftMs - TICK_MS);
  const ships = [...w.ships.values()];
  if (w.phase === "lobby" && ships.length > 0) { w.phase = "countdown"; w.phaseLeftMs = COUNTDOWN_MS; resetForMatch(w); }
  else if (w.phase === "countdown" && w.phaseLeftMs === 0) { w.phase = "live"; w.phaseLeftMs = MATCH_MS; }
  else if (w.phase === "live" && w.phaseLeftMs === 0) { w.phase = "results"; w.phaseLeftMs = RESULTS_MS; finishMatch(w); }
  else if (w.phase === "results" && w.phaseLeftMs === 0) {
    if (ships.length > 0) { w.phase = "countdown"; w.phaseLeftMs = COUNTDOWN_MS; resetForMatch(w); } else w.phase = "lobby";
  }
  if (ships.length === 0 && w.phase !== "results") w.phase = "lobby";

  for (const s of ships) {
    if (s.st === "falling") {
      s.fallMs -= TICK_MS; s.vx *= 0.9; s.vy *= 0.9;
      if (s.fallMs <= 0) { s.st = "respawning"; s.respawnMs = RESPAWN_MS; }
      continue;
    }
    if (s.st === "respawning") {
      s.respawnMs -= TICK_MS;
      if (s.respawnMs <= 0) {
        const p = spawnPoint(w);
        Object.assign(s, { st: "alive", x: p.x, y: p.y, vx: 0, vy: 0, inv: INV_MS, lastHitBy: null });
        w.events.push({ k: "spawn", id: s.id, x: s.x, y: s.y });
      }
      continue;
    }
    if (w.phase === "results") { s.vx *= 0.9; s.vy *= 0.9; s.x += s.vx * DT; s.y += s.vy * DT; continue; }
    if (moveShip(s, DT)) w.events.push({ k: "dash", id: s.id });
  }

  const live = ships.filter((s) => s.st === "alive");
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) if (live[i].inv <= 0 && live[j].inv <= 0) collide(w, live[i], live[j]);

  if (w.phase !== "live") return;
  for (const s of live) if (Math.hypot(s.x, s.y) > ARENA_R + SHIP_R * 0.4) knockOut(w, s);

  w.shardTimer += TICK_MS; w.coreTimer += TICK_MS;
  if (w.shardTimer >= SHARD_EVERY_MS && w.shards.filter((s) => s.v === 1).length < MAX_SHARDS) {
    w.shardTimer = 0;
    const ang = rand(w) * Math.PI * 2, r = Math.sqrt(rand(w)) * ARENA_R * 0.82;
    spawnShard(w, Math.cos(ang) * r, Math.sin(ang) * r, 1);
  }
  if (w.coreTimer >= CORE_EVERY_MS && !w.shards.some((s) => s.v === CORE_VALUE)) {
    w.coreTimer = 0; spawnShard(w, 0, 0, CORE_VALUE); w.events.push({ k: "core", x: 0, y: 0 });
  }
  for (const s of live) {
    if (s.st !== "alive") continue;
    for (let i = w.shards.length - 1; i >= 0; i--) {
      const sh = w.shards[i];
      if (Math.hypot(sh.x - s.x, sh.y - s.y) < COLLECT_R + (sh.v > 1 ? 8 : 0)) {
        s.shards += sh.v; w.shards.splice(i, 1);
        w.events.push({ k: "collect", id: s.id, x: sh.x, y: sh.y, v: sh.v });
      }
    }
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10;
export function toSnap(w: World, forId: string | null): Snap {
  const ships: ShipState[] = [...w.ships.values()].map((s) => ({ id: s.id, slot: s.slot, x: r1(s.x), y: r1(s.y), vx: r1(s.vx),
    vy: r1(s.vy), a: Math.round(s.a * 1000) / 1000, st: s.st, dash: Math.round(s.dash), cd: Math.round(s.cd), inv: Math.round(s.inv),
    shards: s.shards, kos: s.kos, level: s.level, skin: s.skin }));
  return { t: "snap", tick: w.tick, phase: w.phase, t_left_ms: Math.round(w.phaseLeftMs), ack: forId ? w.ships.get(forId)?.ack ?? 0 : 0,
    ships, shards: w.shards, ev: w.events };
}
