// Hover-skiffs: body, glow, engine flame, trail, name tag with level badge, skins.
import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { ShipState } from "../../../shared/protocol";
import { SHIP_R } from "../../../shared/sim";
import type { Fx } from "./fx";
import { SLOT_COLORS, type Textures } from "./textures";

export const displayName = (account: string) => account.split(".")[0].replace(/^lastsave-/, "");
const FONT = "Chakra Petch, ui-sans-serif, system-ui";
const GOLD = 0xffd27a;

function drawBody(g: Graphics, color: number, skin: ShipState["skin"]): void {
  g.clear();
  if (skin === "emberwing") {
    for (const side of [1, -1]) {
      g.moveTo(-4, side * 8).lineTo(-26, side * 30).lineTo(-12, side * 12).closePath().fill({ color: 0xff7a1a, alpha: 0.85 });
      g.moveTo(-6, side * 10).lineTo(-20, side * 22).lineTo(-12, side * 12).closePath().fill({ color: 0xffd27a, alpha: 0.9 });
    }
  }
  g.moveTo(24, 0).lineTo(-14, 15).lineTo(-7, 0).lineTo(-14, -15).closePath()
    .fill({ color: 0x0b0912 })
    .stroke({ color: skin === "emberwing" ? GOLD : color, width: 3, join: "round" });
  g.moveTo(14, 0).lineTo(-4, 6).lineTo(-1, 0).lineTo(-4, -6).closePath().fill({ color, alpha: 0.95 });
}

class ShipView {
  readonly root = new Container();
  private glow: Sprite;
  private body = new Graphics();
  private flame: Sprite;
  private shield: Sprite;
  private tag = new Container();
  private name: Text;
  private badge = new Graphics();
  private lvl: Text;
  private trail: { x: number; y: number }[] = [];
  private drawnKey = "";
  private fallT = 0;
  color = 0xffffff;

  constructor(private tex: Textures, readonly id: string, own: boolean) {
    this.glow = new Sprite(tex.glow);
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.glow.alpha = 0.32;
    this.glow.scale.set(1.5);
    this.flame = new Sprite(tex.ember);
    this.flame.anchor.set(0.5);
    this.flame.blendMode = "add";
    this.shield = new Sprite(tex.ring);
    this.shield.anchor.set(0.5);
    this.shield.blendMode = "add";
    this.shield.scale.set(0.3);
    this.body.scale.set(1.3);
    this.root.addChild(this.glow, this.flame, this.body, this.shield);
    this.name = new Text({ text: own ? "YOU" : displayName(id), style: { fontFamily: FONT, fontSize: 15, fontWeight: "700", fill: 0xffffff, letterSpacing: 0.5 } });
    this.name.anchor.set(0, 0.5);
    this.lvl = new Text({ text: "1", style: { fontFamily: FONT, fontSize: 12, fontWeight: "700", fill: 0x0b0912 } });
    this.lvl.anchor.set(0.5);
    this.tag.addChild(this.badge, this.lvl, this.name);
  }

  get tagNode(): Container { return this.tag; }

  update(s: ShipState, dt: number, t: number, fx: Fx, trailG: Graphics, tagScale: number): void {
    this.tag.scale.set(tagScale);
    this.color = SLOT_COLORS[s.slot % SLOT_COLORS.length];
    const key = `${s.slot}|${s.skin}`;
    if (key !== this.drawnKey) { drawBody(this.body, this.color, s.skin); this.glow.tint = s.skin === "emberwing" ? 0xff9a3d : this.color; this.drawnKey = key; }
    const alive = s.st === "alive";
    this.root.visible = s.st !== "respawning";
    this.tag.visible = alive;
    this.root.position.set(s.x, s.y);
    this.body.rotation = s.a;
    if (s.st === "falling") {
      this.fallT = Math.min(1, this.fallT + dt / 0.6);
      this.body.scale.set(1.3 * (1 - this.fallT * 0.85));
      this.body.rotation = s.a + this.fallT * 9;
      this.root.alpha = 1 - this.fallT * 0.8;
    } else { this.fallT = 0; this.body.scale.set(1.3); this.root.alpha = 1; }

    const speed = Math.hypot(s.vx, s.vy);
    const thrust = Math.min(1, speed / 340);
    this.flame.position.set(Math.cos(s.a) * -19, Math.sin(s.a) * -19);
    this.flame.scale.set((0.9 + thrust * 1.6 + (s.dash > 0 ? 1.4 : 0)) * (0.85 + Math.random() * 0.3));
    this.flame.tint = s.skin === "emberwing" ? 0xffb347 : this.color;
    this.glow.alpha = 0.28 + (s.dash > 0 ? 0.35 : 0);
    this.shield.visible = s.inv > 0 && alive;
    this.shield.alpha = 0.35 + 0.35 * Math.sin(t * 22);
    this.shield.tint = this.color;

    // trail
    if (alive) this.trail.unshift({ x: s.x, y: s.y }); else this.trail.length = 0;
    if (this.trail.length > (s.dash > 0 ? 18 : 12)) this.trail.length = s.dash > 0 ? 18 : 12;
    for (let i = 1; i < this.trail.length; i++) {
      const k = 1 - i / this.trail.length;
      trailG.moveTo(this.trail[i - 1].x, this.trail[i - 1].y).lineTo(this.trail[i].x, this.trail[i].y)
        .stroke({ color: s.skin === "emberwing" ? 0xff8a2b : this.color, width: 2 + k * (s.dash > 0 ? 12 : 7), alpha: k * 0.45, cap: "round" });
    }
    if (alive && s.skin === "emberwing" && Math.random() < 0.7) {
      fx.spawn(this.tex.ember, s.x - Math.cos(s.a) * 16, s.y - Math.sin(s.a) * 16, {
        vx: -s.vx * 0.2 + (Math.random() - 0.5) * 40, vy: -s.vy * 0.2 + (Math.random() - 0.5) * 40, s0: 0.9, s1: 0, max: 0.5, drag: 2 });
    }
    if (alive && s.dash > 0) fx.spawn(this.tex.spark, s.x, s.y, { vx: -s.vx * 0.3, vy: -s.vy * 0.3, tint: this.color, s0: 0.8, s1: 0, max: 0.25 });

    // tag: badge + name, positioned above the skiff (not rotated)
    this.lvl.text = String(s.level);
    const bw = 22;
    this.badge.clear().roundRect(-bw / 2, -9, bw, 18, 5).fill({ color: s.skin === "emberwing" ? GOLD : this.color });
    const total = bw + 6 + this.name.width;
    this.badge.x = this.lvl.x = -total / 2 + bw / 2;
    this.name.x = -total / 2 + bw + 6;
    this.tag.position.set(s.x, s.y - SHIP_R - 14 - 14 * tagScale);
  }

  destroy(): void { this.root.destroy({ children: true }); this.tag.destroy({ children: true }); }
}

export class Ships {
  readonly layer = new Container();
  readonly tags = new Container();
  private trails = new Graphics();
  private views = new Map<string, ShipView>();

  constructor(private tex: Textures, private fx: Fx) {
    this.trails.blendMode = "add";
    this.layer.addChild(this.trails);
  }

  colorOf(id: string): number { return this.views.get(id)?.color ?? 0xffffff; }

  update(ships: ShipState[], ownId: string | null, dt: number, t: number, tagScale = 1): void {
    this.trails.clear();
    const seen = new Set<string>();
    for (const s of ships) {
      seen.add(s.id);
      let v = this.views.get(s.id);
      if (!v) {
        v = new ShipView(this.tex, s.id, s.id === ownId);
        this.views.set(s.id, v);
        this.layer.addChild(v.root);
        this.tags.addChild(v.tagNode);
      }
      v.update(s, dt, t, this.fx, this.trails, tagScale);
    }
    for (const [id, v] of this.views) if (!seen.has(id)) { v.destroy(); this.views.delete(id); }
  }
}
