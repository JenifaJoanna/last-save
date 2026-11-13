// The Rift: a floating obsidian disc with an ember rim over a drifting void.
import { Container, Graphics, Sprite } from "pixi.js";
import { ARENA_R } from "../../../shared/sim";
import type { Fx } from "./fx";
import type { Textures } from "./textures";

function seeded(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export class Backdrop {
  readonly layer = new Container();
  private clouds: { s: Sprite; vx: number; vy: number; vr: number }[] = [];
  private stars = new Graphics();
  private starData: { x: number; y: number; r: number; p: number }[] = [];
  private w = 0;
  private h = 0;

  constructor(private tex: Textures) {
    const tints = [0x7a1d6b, 0x2a1f7a, 0x5a1a08, 0x3b1260, 0x14306b];
    for (let i = 0; i < 6; i++) {
      const s = new Sprite(tex.nebula);
      s.anchor.set(0.5);
      s.tint = tints[i % tints.length];
      s.alpha = 0.55;
      s.blendMode = "add";
      this.layer.addChild(s);
      this.clouds.push({ s, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 4, vr: (Math.random() - 0.5) * 0.02 });
    }
    this.layer.addChild(this.stars);
  }

  resize(w: number, h: number): void {
    this.w = w; this.h = h;
    const rnd = seeded(7);
    this.clouds.forEach((c, i) => {
      c.s.position.set(rnd() * w, rnd() * h);
      c.s.scale.set((Math.max(w, h) / 512) * (0.9 + rnd() * 0.9) * (i < 2 ? 1.3 : 1));
    });
    this.starData = Array.from({ length: Math.round((w * h) / 9000) }, () => ({ x: rnd() * w, y: rnd() * h, r: 0.4 + rnd() * 1.3, p: rnd() * 6.28 }));
  }

  update(t: number, dt: number, camX: number, camY: number): void {
    for (const c of this.clouds) {
      c.s.x += c.vx * dt; c.s.y += c.vy * dt; c.s.rotation += c.vr * dt;
      if (c.s.x < -400) c.s.x = this.w + 400; if (c.s.x > this.w + 400) c.s.x = -400;
      if (c.s.y < -400) c.s.y = this.h + 400; if (c.s.y > this.h + 400) c.s.y = -400;
    }
    const g = this.stars;
    g.clear();
    for (const s of this.starData) {
      const x = (((s.x - camX * 0.06 * s.r) % this.w) + this.w) % this.w;
      const y = (((s.y - camY * 0.06 * s.r) % this.h) + this.h) % this.h;
      g.circle(x, y, s.r).fill({ color: 0xd9d3ff, alpha: 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.p)) });
    }
  }
}

export class Arena {
  readonly layer = new Container();
  private rim = new Graphics();
  private rimGlow: Sprite;
  private coreGlow: Sprite;
  private emberClock = 0;

  constructor(private tex: Textures, private fx: Fx) {
    const R = ARENA_R;
    this.rimGlow = new Sprite(tex.softGlow);
    this.rimGlow.anchor.set(0.5);
    this.rimGlow.tint = 0xff5a1f;
    this.rimGlow.blendMode = "add";
    this.rimGlow.scale.set((R * 2.6) / 256);
    this.rimGlow.alpha = 0.55;
    this.layer.addChild(this.rimGlow);

    const disc = new Graphics();
    disc.circle(0, 0, R).fill({ color: 0x0e0b17 });
    for (let i = 1; i <= 3; i++) disc.circle(0, 0, (R * i) / 4).stroke({ color: 0x2a2342, width: 1.5, alpha: 0.7 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      disc.moveTo(Math.cos(a) * R * 0.18, Math.sin(a) * R * 0.18).lineTo(Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97)
        .stroke({ color: 0x221c36, width: 1, alpha: 0.6 });
    }
    const hex = 6;
    for (let i = 0; i <= hex; i++) {
      const a = (i / hex) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(a) * 64, y = Math.sin(a) * 64;
      if (i === 0) disc.moveTo(x, y); else disc.lineTo(x, y);
    }
    disc.stroke({ color: 0xff7a1a, width: 2, alpha: 0.35 });
    this.layer.addChild(disc);

    const shade = new Sprite(tex.softGlow);
    shade.anchor.set(0.5);
    shade.tint = 0x3a2a66;
    shade.alpha = 0.6;
    shade.blendMode = "add";
    shade.scale.set((R * 1.9) / 256);
    this.layer.addChild(shade);

    const cracks = new Graphics();
    const rnd = seeded(1337);
    for (let i = 0; i < 16; i++) {
      let a = rnd() * Math.PI * 2, r = R * (0.98 - rnd() * 0.05);
      const pts: [number, number][] = [[Math.cos(a) * r, Math.sin(a) * r]];
      const len = 3 + Math.floor(rnd() * 5);
      for (let j = 0; j < len; j++) { r -= 22 + rnd() * 40; a += (rnd() - 0.5) * 0.22; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      for (const [w, alpha] of [[6, 0.07], [1.6, 0.42]] as const) {
        cracks.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts.slice(1)) cracks.lineTo(p[0], p[1]);
        cracks.stroke({ color: 0xff6a2b, width: w, alpha, cap: "round", join: "round" });
      }
    }
    cracks.blendMode = "add";
    this.layer.addChild(cracks);

    this.coreGlow = new Sprite(tex.glow);
    this.coreGlow.anchor.set(0.5);
    this.coreGlow.tint = 0xff7a1a;
    this.coreGlow.blendMode = "add";
    this.coreGlow.alpha = 0.18;
    this.coreGlow.scale.set(1.6);
    this.layer.addChild(this.coreGlow);
    this.layer.addChild(this.rim);
  }

  update(t: number, dt: number): void {
    const R = ARENA_R;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.1);
    this.rim.clear();
    this.rim.circle(0, 0, R + 10).stroke({ color: 0xff5a1f, width: 18, alpha: 0.12 + pulse * 0.06 });
    this.rim.circle(0, 0, R + 2).stroke({ color: 0xff8a3d, width: 5, alpha: 0.55 + pulse * 0.25 });
    this.rim.circle(0, 0, R).stroke({ color: 0xffd9a8, width: 1.5, alpha: 0.85 });
    this.rimGlow.alpha = 0.45 + pulse * 0.15;
    this.coreGlow.alpha = 0.14 + 0.06 * Math.sin(t * 3.3);
    this.emberClock += dt;
    while (this.emberClock > 0.03) {
      this.emberClock -= 0.03;
      const a = Math.random() * Math.PI * 2;
      const r = R + 4 + Math.random() * 10;
      this.fx.spawn(this.tex.ember, Math.cos(a) * r, Math.sin(a) * r, {
        vx: Math.cos(a) * (20 + Math.random() * 40), vy: Math.sin(a) * (20 + Math.random() * 40) - 10,
        s0: 0.5 + Math.random() * 0.7, s1: 0, max: 1 + Math.random() * 1.4, drag: 0.6, a0: 0.9,
      });
    }
  }
}
