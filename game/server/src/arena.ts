// The Arena Durable Object: one global room (8 players), authoritative 30 Hz simulation, auth, progression, receipts, snapshots.
import { DurableObject } from "cloudflare:workers";
import type { ClientMsg, GameEvent, Login, MatchResult, ServerMsg } from "../../shared/protocol";
import { PROTOCOL_VERSION } from "../../shared/protocol";
import { TICK_HZ, addShip, createWorld, removeShip, setInput, skinFor, step, toSnap, type World } from "../../shared/sim";
import { Chain, epochOf } from "./chain";
import { loadConfig, type Config, type Env } from "./env";
import { errorJson, handleAttest, handleProfile, json } from "./http";
import { verifyJoin } from "./login";
import { SnapshotPoster } from "./poster";
import { checkReceipt, newRequest, type Pending } from "./receipts";
import { clientMsgSchema } from "./schemas";
import { buildSnapshot, verifyRestore } from "./snapshot";
import { Store } from "./store";

const TICK_MS = 1000 / TICK_HZ;
const GRACE_MS = 20_000;
const HELLO_TIMEOUT_MS = 10_000;
const MAX_SOCKETS = 64;
const EPOCH_REFRESH_MS = 30_000;

interface Session {
  ws: WebSocket; connectedAt: number; verifying: boolean; strikes: number; budget: number;
  account: string | null; pubkey: string; expMs: number; loginId: number; pending: Map<string, Pending>;
}
interface Attachment { account: string; pubkey: string; expMs: number; loginId: number }

export class Arena extends DurableObject<Env> {
  private cfg: Config;
  private chain: Chain;
  private store: Store;
  private poster: SnapshotPoster | null = null;
  private fatal: { code: string; error: string } | null = null;
  private world: World = createWorld(Date.now() & 0xffffff);
  private sessions = new Map<WebSocket, Session>();
  private byAccount = new Map<string, Session>();
  private grace = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private acc = 0;
  private tickNo = 0;
  private refillAt = 0;
  private purgeAt = Date.now();
  private evBuf: GameEvent[] = [];
  private phase = this.world.phase;
  private epoch: number | null = null;
  private epochLoaded = false;
  private epochAt = 0;
  private epochBusy = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.cfg = loadConfig(env);
    this.chain = new Chain({ urls: this.cfg.rpcUrls, cacheMs: this.cfg.rpcCacheMs, backoffMs: this.cfg.rpcBackoffMs });
    this.store = new Store(ctx.storage.sql, (fn) => ctx.storage.transactionSync(fn));
    if (this.cfg.snapshotSigner) this.poster = new SnapshotPoster(this.chain, this.cfg.snapshotSigner, this.cfg.studioAccount, this.cfg.licenceContract);
    this.restore();
    for (const ws of ctx.getWebSockets()) this.rehydrate(ws);
    if (this.sessions.size) this.startLoop();
  }

  private restore(): void {
    if (!this.cfg.restoreSnapshot || !this.store.isEmpty()) return;
    const r = verifyRestore(this.cfg.restoreSnapshot);
    if (r.ok) this.store.importSnapshot(r.snapshot, r.hash);
    else this.fatal = { code: r.code, error: r.error };
  }

  private rehydrate(ws: WebSocket): void {
    const a = ws.deserializeAttachment() as Attachment | null;
    const s: Session = { ws, connectedAt: Date.now(), verifying: false, strikes: 0, budget: 120, account: null, pubkey: "", expMs: 0, loginId: 0, pending: new Map() };
    this.sessions.set(ws, s);
    if (!a?.account) return;
    Object.assign(s, { account: a.account, pubkey: a.pubkey, expMs: a.expMs, loginId: a.loginId });
    const p = this.store.profile(a.account);
    if (addShip(this.world, a.account, { level: p.level, skin: p.skin })) this.byAccount.set(a.account, s);
  }

  // ---------- HTTP ----------
  async fetch(request: Request): Promise<Response> {
    if (this.fatal) return errorJson(503, this.fatal.error, this.fatal.code);
    const url = new URL(request.url);
    switch (url.pathname) {
      case "/health": return json({ ok: true, host_id: this.cfg.hostId, build_hash: this.cfg.buildHash, players_online: this.byAccount.size,
        match: { phase: this.world.phase, t_left_ms: Math.round(this.world.phaseLeftMs), no: this.world.matchNo, ships: this.world.ships.size } });
      case "/attest": return handleAttest(url, this.store, this.cfg, Date.now());
      case "/profile": return handleProfile(url, this.store);
      case "/ws": return this.upgrade(request);
      default: return errorJson(404, "not found", "not_found");
    }
  }

  private upgrade(request: Request): Response {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return errorJson(426, "expected a WebSocket upgrade", "upgrade_required");
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) return errorJson(503, "too many connections", "busy");
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    this.sessions.set(pair[1], { ws: pair[1], connectedAt: Date.now(), verifying: false, strikes: 0, budget: 120, account: null, pubkey: "", expMs: 0, loginId: 0, pending: new Map() });
    this.startLoop();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // ---------- sockets ----------
  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    let s = this.sessions.get(ws);
    if (!s) { this.rehydrate(ws); s = this.sessions.get(ws)!; this.startLoop(); }
    if (typeof data !== "string" || data.length > 8192) { ws.close(1009, "message too large"); return; }
    if (--s.budget < 0) { ws.close(1008, "rate limit"); return; }
    let msg: ClientMsg;
    try { msg = clientMsgSchema.parse(JSON.parse(data)) as ClientMsg; } catch {
      if (++s.strikes > 5) ws.close(1008, "too many bad messages"); else this.send(ws, { t: "notice", text: "malformed message ignored" });
      return;
    }
    switch (msg.t) {
      case "hello": return this.onHello(s, msg);
      case "input": if (s.account) setInput(this.world, s.account, { ax: msg.ax, ay: msg.ay, dash: msg.dash }, msg.seq); return;
      case "receipt": return this.onReceipt(s, msg.receipt);
      case "ping": this.send(ws, { t: "pong", c: msg.c, s: Date.now() }); return;
    }
  }

  webSocketClose(ws: WebSocket, code?: number): void {
    this.drop(ws);
    try { ws.close(code && code >= 1000 && code < 5000 && code !== 1005 && code !== 1006 ? code : 1000, "bye"); } catch { /* already closed */ }
  }
  webSocketError(ws: WebSocket): void { this.drop(ws); }

  private drop(ws: WebSocket): void {
    const s = this.sessions.get(ws);
    this.sessions.delete(ws);
    if (!s?.account || this.byAccount.get(s.account) !== s) return;
    this.byAccount.delete(s.account);
    const ship = this.world.ships.get(s.account);
    if (ship) { ship.input = { ax: 0, ay: 0, dash: false }; this.grace.set(s.account, Date.now() + GRACE_MS); }
  }

  private async onHello(s: Session, msg: Extract<ClientMsg, { t: "hello" }>): Promise<void> {
    if (s.account || s.verifying) return;
    if (msg.v !== PROTOCOL_VERSION) return this.deny(s, "bad_version", `protocol version ${msg.v} is not supported (server speaks ${PROTOCOL_VERSION})`);
    s.verifying = true;
    try {
      const check = await verifyJoin({ login: msg.login as Login, proof: msg.proof, hostId: this.cfg.hostId, licenceContract: this.cfg.licenceContract, chain: this.chain, nowMs: Date.now() });
      if (!check.ok) return this.deny(s, check.code, check.error);
      await this.ensureEpoch();
      const profile = this.store.profile(check.accountId);
      const ship = addShip(this.world, check.accountId, { level: profile.level, skin: profile.skin });
      if (!ship) return this.deny(s, "full", "the arena is full (8 pilots), try again after this match");
      const old = this.byAccount.get(check.accountId);
      if (old && old !== s) { this.sessions.delete(old.ws); this.send(old.ws, { t: "notice", text: "signed in from another tab" }); old.ws.close(1000, "replaced"); }
      this.grace.delete(check.accountId);
      Object.assign(s, { account: check.accountId, pubkey: check.sessionPubkey, expMs: check.expMs, loginId: this.store.saveLogin(msg.login as Login, check.sessionPubkey, check.expMs) });
      this.byAccount.set(check.accountId, s);
      s.ws.serializeAttachment({ account: check.accountId, pubkey: s.pubkey, expMs: s.expMs, loginId: s.loginId } satisfies Attachment);
      this.send(s.ws, { t: "welcome", you: profile, host_id: this.cfg.hostId, build_hash: this.cfg.buildHash, epoch: this.epoch, tick_hz: TICK_HZ });
      this.requestReceipt(s);
    } catch {
      this.deny(s, "no_access_key", "could not verify the login right now, try again");
    } finally { s.verifying = false; }
  }

  private deny(s: Session, code: Extract<ServerMsg, { t: "denied" }>["code"], error: string): void {
    this.send(s.ws, { t: "denied", code, error });
    s.ws.close(1008, code);
  }

  private onReceipt(s: Session, r: Extract<ClientMsg, { t: "receipt" }>["receipt"]): void {
    if (!s.account) return;
    const why = checkReceipt(r, { hostId: this.cfg.hostId, account: s.account, pubkey: s.pubkey, expMs: s.expMs, pending: s.pending });
    if (why) { this.send(s.ws, { t: "notice", text: `receipt rejected: ${why}` }); return; }
    s.pending.delete(r.nonce);
    this.store.saveReceipt(r, s.loginId);
  }

  private requestReceipt(s: Session): void {
    if (!s.account) return;
    const req = newRequest(this.cfg.hostId, this.epoch, Date.now());
    s.pending.set(req.nonce, { ts_ms: req.ts_ms, epoch: req.epoch });
    while (s.pending.size > 8) s.pending.delete(s.pending.keys().next().value as string);
    this.send(s.ws, req);
  }

  private send(ws: WebSocket, m: ServerMsg): void { try { ws.send(JSON.stringify(m)); } catch { /* socket already closed */ } }

  // ---------- epoch ----------
  private async ensureEpoch(): Promise<void> {
    if (this.cfg.hostId === "official") { this.epochLoaded = true; return; }
    if (!this.epochLoaded) await this.refreshEpoch();
  }

  private async refreshEpoch(): Promise<void> {
    if (this.epochBusy || this.cfg.hostId === "official") return;
    this.epochBusy = true;
    try {
      const info = await this.chain.epochInfo(this.cfg.licenceContract);
      const next = epochOf(Date.now(), info);
      const changed = this.epochLoaded && next !== this.epoch;
      this.epoch = next; this.epochLoaded = true;
      if (changed) for (const s of this.byAccount.values()) this.requestReceipt(s);
    } catch { /* keep the previous epoch; retried in 30 s */ } finally { this.epochAt = Date.now(); this.epochBusy = false; }
  }

  // ---------- simulation loop ----------
  private startLoop(): void {
    if (this.timer) return;
    this.lastTick = Date.now(); this.acc = 0;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private stopLoop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.world = createWorld(Date.now() & 0xffffff);
    this.phase = this.world.phase; this.evBuf = [];
  }

  private tick(): void {
    const now = Date.now();
    this.acc = Math.min(this.acc + (now - this.lastTick), TICK_MS * 4);
    this.lastTick = now;
    this.housekeeping(now);
    for (let n = 0; n < 4 && this.acc >= TICK_MS - 1.5; n++) {
      this.acc -= TICK_MS;
      for (let i = 0; i < this.cfg.timeScale; i++) this.stepOnce();
      if (++this.tickNo % 2 === 0) this.broadcast();
    }
    if (this.sessions.size === 0 && this.world.ships.size === 0) this.stopLoop();
  }

  private housekeeping(now: number): void {
    for (const [account, until] of this.grace) if (now >= until) { this.grace.delete(account); if (!this.byAccount.has(account)) removeShip(this.world, account); }
    for (const s of this.sessions.values()) if (!s.account && !s.verifying && now - s.connectedAt > HELLO_TIMEOUT_MS) s.ws.close(1008, "hello timeout");
    if (now - this.refillAt >= 1000) { this.refillAt = now; for (const s of this.sessions.values()) s.budget = 120; }
    if (this.cfg.hostId !== "official" && now - this.epochAt > EPOCH_REFRESH_MS && this.sessions.size) void this.refreshEpoch();
    if (now - this.purgeAt >= 3_600_000) { this.purgeAt = now; this.store.purge(now); }
  }

  private stepOnce(): void {
    step(this.world);
    this.evBuf.push(...this.world.events);
    if (this.world.phase !== this.phase) {
      this.phase = this.world.phase;
      if (this.phase === "countdown") for (const s of this.byAccount.values()) this.requestReceipt(s);
    }
    if (this.world.ended) { const r = this.world.ended; this.world.ended = null; this.finishMatch(r); }
  }

  private broadcast(): void {
    const ev = this.evBuf; this.evBuf = [];
    for (const s of this.byAccount.values()) {
      const snap = toSnap(this.world, s.account!);
      snap.ev = ev;
      this.send(s.ws, snap);
    }
  }

  private finishMatch(raw: MatchResult[]): void {
    const results = this.store.applyResults(raw);
    for (const r of results) {
      const ship = this.world.ships.get(r.account_id);
      if (ship) { ship.level = r.level_after; ship.skin = skinFor(r.level_after); }
    }
    const matchNo = Number(this.store.getMeta("matches") ?? 0);
    const seq = this.snapshotAfterMatch();
    const msg: ServerMsg = { t: "results", match_id: `${this.cfg.hostId}-${matchNo}`, results, snapshot_seq: this.poster ? seq : null };
    for (const s of this.byAccount.values()) { this.send(s.ws, msg); this.send(s.ws, { t: "profile", you: this.store.profile(s.account!) }); }
  }

  private snapshotAfterMatch(): number {
    const seq = this.store.nextSnapshotSeq();
    const built = buildSnapshot({ at_ms: Date.now(), game: "ember-rift", players: this.store.allPlayers(), seq });
    this.store.saveSnapshot(seq, built.hash, built.json, Date.now(), this.poster ? "pending" : "local");
    if (this.poster) {
      const p = this.poster;
      this.ctx.waitUntil(p.post(seq, built.hash, built.blobBase64).then((r) => this.store.markSnapshot(seq, r.ok ? "posted" : "failed", r.tx, r.error)));
    }
    return seq;
  }
}
