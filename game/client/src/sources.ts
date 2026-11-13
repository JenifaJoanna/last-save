// Frame sources: Online (server-authoritative, predicted) and Practice (local sim with bots,
// also used as the live "attract" arena behind the sign-in card).
import type { GameEvent, MatchResult, Phase, Profile, ServerMsg, ShardState, ShipState } from "../../shared/protocol";
import { addShip, createWorld, levelFor, setInput, skinFor, step, toSnap, xpForLevel, type Input, type World } from "../../shared/sim";
import { Connection, type ConnState } from "./net/connection";
import { SnapBuffer } from "./net/interp";
import { Predictor } from "./net/predict";
import { helloProof, signReceipt, type Session } from "./session";

export interface Frame { ships: ShipState[]; shards: ShardState[]; phase: Phase; tLeft: number; events: GameEvent[] }
export interface Source { ownId: string | null; cooldown: number; fixedTick(input: Input): void; frame(now: number): Frame; stop(): void }
export interface SourceEvents {
  profile: (p: Profile) => void;
  results: (r: MatchResult[]) => void;
  conn: (s: ConnState, attempt: number) => void;
  denied: (code: Extract<ServerMsg, { t: "denied" }>["code"]) => void;
  notice: (text: string) => void;
}

export class Online implements Source {
  ownId: string | null = null;
  private buffer = new SnapBuffer();
  private pred = new Predictor();
  private conn: Connection;
  private live = false;
  private pinger: number;
  epoch: number | null = null;

  constructor(wsUrl: string, private session: Session, private ev: SourceEvents) {
    this.conn = new Connection(wsUrl, {
      hello: async () => ({ t: "hello", v: 1, login: session.login, proof: helloProof(session) }),
      state: (s, a) => { this.live = s === "live"; if (s !== "live") this.buffer.reset(); ev.conn(s, a); },
      message: (m) => this.onMessage(m),
    });
    this.conn.start();
    this.pinger = window.setInterval(() => this.conn.ping(), 2000);
  }

  get rtt(): number { return this.conn.rtt; }
  get cooldown(): number { return this.pred.cooldown; }

  private onMessage(m: ServerMsg): void {
    switch (m.t) {
      case "welcome": this.ownId = m.you.account_id; this.epoch = m.epoch; this.ev.profile(m.you); break;
      case "profile": this.ev.profile(m.you); break;
      case "snap": {
        this.buffer.push(m, performance.now());
        this.pred.reconcile(m.ships.find((s) => s.id === this.ownId), m.ack);
        break;
      }
      case "receipt_req": this.conn.send({ t: "receipt", receipt: signReceipt(this.session, m) }); break;
      case "results": this.ev.results(m.results); break;
      case "denied": this.ev.denied(m.code); break;
      case "notice": this.ev.notice(m.text); break;
      default: break;
    }
  }

  fixedTick(input: Input): void {
    if (!this.live) return;
    const seq = this.pred.tick(input);
    this.conn.send({ t: "input", seq, ax: Math.round(input.ax * 1000) / 1000, ay: Math.round(input.ay * 1000) / 1000, dash: input.dash });
  }

  frame(now: number): Frame {
    this.pred.decay(1 / 60);
    const s = this.buffer.sample(now);
    const ships = s.ships.map((sh) => (sh.id === this.ownId ? this.pred.apply(sh) : sh));
    const l = this.buffer.latest;
    return { ships, shards: s.shards, phase: l?.phase ?? "lobby", tLeft: l?.t_left_ms ?? 0, events: this.buffer.drainEvents(now) };
  }

  stop(): void { window.clearInterval(this.pinger); this.conn.stop(); }
}

const BOTS = ["kestrel.bot", "vanta.bot", "juniper.bot", "osprey.bot"];

export class Practice implements Source {
  ownId: string | null;
  private w: World;
  private seq = 0;
  private events: GameEvent[] = [];
  private xp = 0;

  constructor(withPlayer: boolean, private ev?: Pick<SourceEvents, "profile" | "results">, bots = 3) {
    this.w = createWorld((Math.random() * 2 ** 31) | 0);
    this.ownId = withPlayer ? "you.practice" : null;
    if (this.ownId) addShip(this.w, this.ownId, { level: 1, skin: "standard" });
    BOTS.slice(0, bots).forEach((b, i) => addShip(this.w, b, { level: 2 + i * 2, skin: skinFor(2 + i * 2) }));
    this.emitProfile();
  }

  private emitProfile(): void {
    if (!this.ownId || !this.ev) return;
    const level = levelFor(this.xp);
    this.ev.profile({ account_id: "practice", level, xp: this.xp, next_level_xp: xpForLevel(level + 1), skin: skinFor(level), matches: this.w.matchNo });
  }

  get cooldown(): number { return this.ownId ? this.w.ships.get(this.ownId)?.cd ?? 0 : 0; }

  fixedTick(input: Input): void {
    this.seq++;
    if (this.ownId) setInput(this.w, this.ownId, input, this.seq);
    for (const s of this.w.ships.values()) {
      if (s.id === this.ownId) continue;
      let tx = 0, ty = 0, best = 1e9, dash = false;
      for (const sh of this.w.shards) { const d = Math.hypot(sh.x - s.x, sh.y - s.y) / sh.v; if (d < best) { best = d; tx = sh.x; ty = sh.y; } }
      for (const o of this.w.ships.values()) {
        if (o.id !== s.id && o.st === "alive" && Math.hypot(o.x - s.x, o.y - s.y) < 110) { tx = o.x; ty = o.y; dash = Math.random() < 0.06; }
      }
      const edge = Math.hypot(s.x, s.y) > 520;
      if (edge) { tx = 0; ty = 0; }
      const dx = tx - s.x, dy = ty - s.y, l = Math.hypot(dx, dy) || 1;
      setInput(this.w, s.id, { ax: dx / l, ay: dy / l, dash }, this.seq);
    }
    step(this.w);
    this.events.push(...this.w.events);
    if (this.w.ended) {
      const res = this.w.ended;
      this.w.ended = null;
      const me = res.find((r) => r.account_id === this.ownId);
      if (me && this.ev) {
        me.level_before = levelFor(this.xp);
        this.xp += me.xp_gained;
        me.level_after = levelFor(this.xp);
        if (me.level_after >= 3 && me.level_before < 3) me.unlocked = "emberwing";
        const own = this.ownId ? this.w.ships.get(this.ownId) : undefined;
        if (own) { own.level = me.level_after; own.skin = skinFor(me.level_after); }
        this.ev.results(res);
        this.emitProfile();
      }
    }
  }

  frame(): Frame {
    const s = toSnap(this.w, this.ownId);
    const events = this.events;
    this.events = [];
    return { ships: s.ships, shards: s.shards, phase: s.phase, tLeft: s.t_left_ms, events };
  }

  stop(): void { /* nothing to release */ }
}
