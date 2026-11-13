// Pooled particle system + screen-space juice (shake, flash). All additive sprites.
import { Container, Sprite, Texture } from "pixi.js";

interface P {
  s: Sprite;
  vx: number; vy: number;
  life: number; max: number;
  s0: number; s1: number;
  a0: number;
  drag: number;
  spin: number;
  grav: number;
}

export class Fx {
  readonly layer = new Container();
  private pool: Sprite[] = [];
  private live: P[] = [];
  shake = 0;

  spawn(tex: Texture, x: number, y: number, o: Partial<Omit<P, "s">> & { tint?: number; rot?: number } = {}): void {
    if (this.live.length > 900) return;
    const s = this.pool.pop() ?? new Sprite();
    s.texture = tex;
    s.anchor.set(0.5);
    s.blendMode = "add";
    s.position.set(x, y);
    s.tint = o.tint ?? 0xffffff;
    s.rotation = o.rot ?? 0;
    s.visible = true;
    this.layer.addChild(s);
    const max = o.max ?? 0.6;
    this.live.push({ s, vx: o.vx ?? 0, vy: o.vy ?? 0, life: max, max, s0: o.s0 ?? 0.5, s1: o.s1 ?? 0, a0: o.a0 ?? 1,
      drag: o.drag ?? 3, spin: o.spin ?? 0, grav: o.grav ?? 0 });
  }

  burst(tex: Texture, x: number, y: number, n: number, speed: number, tint: number, size = 0.35, life = 0.55): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.65);
      this.spawn(tex, x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, tint, s0: size * (0.6 + Math.random() * 0.8), s1: 0,
        max: life * (0.6 + Math.random() * 0.6), drag: 2.4 });
    }
  }

  ring(tex: Texture, x: number, y: number, tint: number, from: number, to: number, life = 0.45, alpha = 0.9): void {
    this.spawn(tex, x, y, { tint, s0: from, s1: to, max: life, a0: alpha, drag: 0 });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.s.visible = false;
        this.layer.removeChild(p.s);
        this.pool.push(p.s);
        this.live.splice(i, 1);
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.grav * dt;
      p.s.x += p.vx * dt; p.s.y += p.vy * dt;
      const t = 1 - p.life / p.max;
      p.s.scale.set(p.s0 + (p.s1 - p.s0) * t);
      p.s.alpha = p.a0 * (1 - t * t);
      p.s.rotation += p.spin * dt;
    }
    this.shake = Math.max(0, this.shake - dt * 2.8);
  }

  kick(amount: number): void { this.shake = Math.min(1, this.shake + amount); }
}

/** Floating combat text in world space (Pixi Text is costly; we cap concurrency). */
export interface FloatText { el: HTMLDivElement; x: number; y: number; life: number }
