// Pixi scene: camera, layers, shards, event juice. Fed a render state each frame.
import { Application, Container, Sprite, Text, Texture } from "pixi.js";
import type { GameEvent, ShardState, ShipState } from "../../../shared/protocol";
import { ARENA_R } from "../../../shared/sim";
import { Arena, Backdrop } from "./arena";
import { captureEvents } from "./capture-log";
import { Fx } from "./fx";
import { displayName, Ships } from "./ships";
import { EMBER, makeTextures, SHARD_CYAN, type Textures } from "./textures";

export interface RenderState { ships: ShipState[]; shards: ShardState[]; ownId: string | null }
interface Floater { t: Text; vy: number; life: number; max: number }

export class Scene {
  readonly app = new Application();
  private tex!: Textures;
  private fx = new Fx();
  private backdrop!: Backdrop;
  private arena!: Arena;
  private ships!: Ships;
  private world = new Container();
  private shardLayer = new Container();
  private textLayer = new Container();
  private shardSprites = new Map<number, { s: Container; born: number; core: boolean }>();
  private floaters: Floater[] = [];
  private cam = { x: 0, y: 0, s: 1 };
  private time = 0;
  // Juice: hit-stop slows effects (never the simulation), a camera punch-zoom, and a white flash frame.
  private flash = new Sprite(Texture.WHITE);
  private slow = 0;
  private punch = 0;
  private flashA = 0;
  private lastShips = new Map<string, ShipState>();
  private calm = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({ resizeTo: parent, background: "#07060d", antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
    parent.appendChild(this.app.canvas);
    this.tex = makeTextures();
    this.backdrop = new Backdrop(this.tex);
    this.arena = new Arena(this.tex, this.fx);
    this.ships = new Ships(this.tex, this.fx);
    this.world.addChild(this.arena.layer, this.shardLayer, this.ships.layer, this.fx.layer, this.ships.tags, this.textLayer);
    this.flash.alpha = 0; this.flash.blendMode = "add";
    this.app.stage.addChild(this.backdrop.layer, this.world, this.flash);
    const onResize = () => { this.backdrop.resize(this.app.screen.width, this.app.screen.height); this.flash.width = this.app.screen.width; this.flash.height = this.app.screen.height; };
    this.app.renderer.on("resize", onResize);
    onResize();
  }

  colorOf(id: string): number { return this.ships.colorOf(id); }

  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.world.x + x * this.world.scale.x, y: this.world.y + y * this.world.scale.y };
  }

  /** One impact: `stop` s of slowed effects, a camera punch, a flash frame. Off under reduced motion. */
  private impact(stop: number, punch: number, flash: number): void {
    if (this.calm) return;
    this.slow = Math.max(this.slow, stop);
    this.punch = Math.min(1, this.punch + punch);
    this.flashA = Math.min(0.28, this.flashA + flash);
  }

  frame(rs: RenderState, dt: number): void {
    this.time += dt;
    const fdt = this.slow > 0 ? dt * 0.12 : dt;
    this.slow = Math.max(0, this.slow - dt);
    this.punch = Math.max(0, this.punch - dt * 5.5);
    this.flashA = Math.max(0, this.flashA - dt * 5);
    this.flash.alpha = this.flashA;
    for (const s of rs.ships) this.lastShips.set(s.id, s);
    const t = this.time;
    const { width: w, height: h } = this.app.screen;
    const fit = Math.min(w, h) / (ARENA_R * 2 + 170);
    const own = rs.ships.find((s) => s.id === rs.ownId);
    const scale = (own ? Math.max(fit, 0.5) : fit) * (1 + 0.07 * this.punch * this.punch);
    let tx = 0, ty = 0;
    if (own && own.st === "alive") {
      const follow = scale > fit * 1.05 ? 1 : 0.08;
      tx = own.x * follow; ty = own.y * follow;
    }
    const k = 1 - Math.exp(-dt * 4);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k; this.cam.s += (scale - this.cam.s) * k;
    const sh = this.fx.shake * this.fx.shake * 16;
    this.world.scale.set(this.cam.s);
    this.world.position.set(w / 2 - this.cam.x * this.cam.s + (Math.random() - 0.5) * sh, h / 2 - this.cam.y * this.cam.s + (Math.random() - 0.5) * sh);

    this.backdrop.update(t, dt, this.cam.x, this.cam.y);
    this.arena.update(t, dt);
    this.updateShards(rs.shards, t);
    this.ships.update(rs.ships, rs.ownId, dt, t, 0.92 / this.cam.s);
    this.fx.update(fdt);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt; f.t.y += f.vy * dt; f.vy *= Math.exp(-3 * dt);
      f.t.alpha = Math.min(1, f.life / (f.max * 0.4));
      f.t.scale.set(1 + 0.25 * Math.max(0, 1 - (f.max - f.life) * 6));
      if (f.life <= 0) { f.t.destroy(); this.floaters.splice(i, 1); }
    }
  }

  private updateShards(shards: ShardState[], t: number): void {
    const seen = new Set<number>();
    for (const sh of shards) {
      seen.add(sh.id);
      let e = this.shardSprites.get(sh.id);
      if (!e) {
        const core = sh.v > 1;
        // Pixi v8: only Containers take children, so the shard and its glow share one (glow drawn on top, as before).
        const s = new Container();
        const shard = new Sprite(core ? this.tex.core : this.tex.shard);
        shard.anchor.set(0.5);
        s.addChild(shard);
        if (core) shard.blendMode = "add";
        else {
          const g = new Sprite(this.tex.glow);
          g.anchor.set(0.5); g.tint = SHARD_CYAN; g.blendMode = "add"; g.alpha = 0.5; g.scale.set(0.9);
          s.addChild(g);
        }
        this.shardLayer.addChild(s);
        e = { s, born: t, core };
        this.shardSprites.set(sh.id, e);
      }
      const age = Math.min(1, (t - e.born) / 0.35);
      const pop = age < 1 ? 1 - Math.pow(1 - age, 3) : 1;
      if (e.core) {
        e.s.position.set(sh.x, sh.y);
        e.s.scale.set((0.75 + 0.12 * Math.sin(t * 5)) * pop);
        if (Math.random() < 0.5) this.fx.spawn(this.tex.ember, sh.x + (Math.random() - 0.5) * 30, sh.y + (Math.random() - 0.5) * 30, { vy: -40, s0: 1, s1: 0, max: 0.8, drag: 0.5 });
      } else {
        e.s.position.set(sh.x, sh.y + Math.sin(t * 3 + sh.id) * 3);
        e.s.rotation = Math.sin(t * 1.7 + sh.id) * 0.35;
        e.s.scale.set(0.82 * pop);
      }
    }
    for (const [id, e] of this.shardSprites) if (!seen.has(id)) { e.s.destroy({ children: true }); this.shardSprites.delete(id); }
  }

  floatText(x: number, y: number, text: string, color: number, size = 22): void {
    if (this.floaters.length > 24) return;
    const t = new Text({ text, style: { fontFamily: "Chakra Petch, ui-sans-serif", fontSize: size, fontWeight: "700", fill: color, stroke: { color: 0x07060d, width: 4 } } });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.textLayer.addChild(t);
    this.floaters.push({ t, vy: -70, life: 1.1, max: 1.1 });
  }

  onEvents(events: GameEvent[], ownId: string | null): void {
    captureEvents(events, ownId);
    for (const e of events) {
      switch (e.k) {
        case "collect": {
          const core = e.v > 1;
          this.fx.burst(this.tex.spark, e.x, e.y, core ? 40 : 10, core ? 420 : 220, core ? EMBER : SHARD_CYAN, core ? 0.6 : 0.35);
          this.fx.ring(this.tex.ring, e.x, e.y, core ? EMBER : SHARD_CYAN, 0.1, core ? 1.6 : 0.5, 0.4);
          if (core) this.fx.kick(0.35);
          if (e.id === ownId || core) this.floatText(e.x, e.y - 18, `+${e.v}`, core ? 0xffc46b : 0x9ff8ff, core ? 30 : 20);
          break;
        }
        case "hit": {
          const p = Math.min(1, e.power / 900);
          this.fx.burst(this.tex.spark, e.x, e.y, 8 + Math.round(p * 22), 200 + p * 500, 0xffffff, 0.3 + p * 0.3, 0.4);
          this.fx.ring(this.tex.ring, e.x, e.y, 0xffffff, 0.05, 0.25 + p * 0.6, 0.25, 0.7);
          const involved = e.a === ownId || e.b === ownId;
          this.fx.kick((involved ? 0.25 : 0.08) + p * (involved ? 0.4 : 0.15));
          for (let i = 0; i < 6 + Math.round(p * 8); i++) {
            const a = Math.random() * Math.PI * 2, v = 500 + p * 700;
            this.fx.spawn(this.tex.spark, e.x, e.y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: a, s0: 0.5, s1: 0.05, max: 0.22, drag: 6, tint: 0xfff2d8 });
          }
          if (involved || p > 0.55) this.impact(involved ? 0.06 + p * 0.06 : 0.04, involved ? 0.45 + p * 0.5 : 0.2, involved ? 0.08 + p * 0.12 : 0);
          break;
        }
        case "ko": {
          const c = this.colorOf(e.victim);
          this.fx.burst(this.tex.spark, e.x, e.y, 46, 520, c, 0.55, 0.8);
          this.fx.burst(this.tex.ember, e.x, e.y, 30, 300, 0xffffff, 1.2, 1.1);
          this.fx.ring(this.tex.ring, e.x, e.y, EMBER, 0.2, 2.6, 0.6);
          this.fx.kick(e.victim === ownId || e.by === ownId ? 0.8 : 0.4);
          for (let i = 0; i < 18; i++) this.fx.spawn(this.tex.spark, e.x, e.y, { vx: (Math.random() - 0.5) * 520, vy: -180 - Math.random() * 360, grav: 900, s0: 0.45, s1: 0.2, max: 1.1, drag: 0.6, spin: (Math.random() - 0.5) * 12, tint: c });
          for (let i = 0; i < 8; i++) this.fx.spawn(this.tex.glow, e.x + (Math.random() - 0.5) * 40, e.y + (Math.random() - 0.5) * 40, { vy: -30, s0: 0.6, s1: 1.8, max: 1.4, a0: 0.18, drag: 1, tint: 0x6b5a8a });
          this.impact(0.12, 1, e.victim === ownId || e.by === ownId ? 0.32 : 0.16);
          this.floatText(e.x, e.y - 30, e.by ? `${displayName(e.by)} ✕ ${displayName(e.victim)}` : `${displayName(e.victim)} fell`, 0xffb37a, 20);
          break;
        }
        case "dash": {
          const s = this.lastShips.get(e.id);
          if (!s) break;
          const c = this.colorOf(e.id), back = Math.atan2(-s.vy, -s.vx);
          for (let i = 0; i < 12; i++) {
            const a = back + (Math.random() - 0.5) * 0.7, v = 160 + Math.random() * 260;
            this.fx.spawn(this.tex.ember, s.x, s.y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, s0: 0.9, s1: 0, max: 0.45, drag: 3, tint: c });
          }
          if (e.id === ownId) { this.fx.kick(0.06); this.impact(0, 0.15, 0); }
          break;
        }
        case "spawn": {
          const c = this.colorOf(e.id);
          this.fx.ring(this.tex.ring, e.x, e.y, c, 1.2, 0.1, 0.5);
          this.fx.burst(this.tex.spark, e.x, e.y, 14, 180, c, 0.3, 0.5);
          break;
        }
        case "core": {
          this.fx.ring(this.tex.ring, 0, 0, EMBER, 0.2, 4, 0.9);
          this.fx.ring(this.tex.ring, 0, 0, 0xffd27a, 0.1, 6, 1.2, 0.5);
          this.fx.kick(0.2);
          this.impact(0, 0.35, 0.1);
          break;
        }
      }
    }
  }
}
