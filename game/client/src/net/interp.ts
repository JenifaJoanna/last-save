// Snapshot buffer: renders remote skiffs ~130 ms in the past, interpolated between server ticks.
import type { GameEvent, ShardState, ShipState, Snap } from "../../../shared/protocol";
import { TICK_HZ } from "../../../shared/sim";

const DELAY_TICKS = 4;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export class SnapBuffer {
  private snaps: Snap[] = [];
  private lastRecv = 0;
  private pendingEvents: { tick: number; e: GameEvent }[] = [];
  latest: Snap | null = null;

  push(s: Snap, now: number): void {
    if (this.latest && s.tick <= this.latest.tick) return;
    this.snaps.push(s);
    if (this.snaps.length > 40) this.snaps.shift();
    this.latest = s;
    this.lastRecv = now;
    for (const e of s.ev) this.pendingEvents.push({ tick: s.tick, e });
  }

  reset(): void { this.snaps = []; this.latest = null; this.pendingEvents = []; }

  renderTick(now: number): number {
    if (!this.latest) return 0;
    return this.latest.tick + ((now - this.lastRecv) * TICK_HZ) / 1000 - DELAY_TICKS;
  }

  /** Events whose tick the render clock has reached. */
  drainEvents(now: number): GameEvent[] {
    const rt = this.renderTick(now) + DELAY_TICKS * 0.5;
    const out: GameEvent[] = [];
    this.pendingEvents = this.pendingEvents.filter((p) => (p.tick <= rt ? (out.push(p.e), false) : true));
    return out;
  }

  sample(now: number): { ships: ShipState[]; shards: ShardState[] } {
    if (!this.latest) return { ships: [], shards: [] };
    const rt = this.renderTick(now);
    let a = this.snaps[0], b = this.snaps[this.snaps.length - 1];
    for (let i = 0; i < this.snaps.length - 1; i++) {
      if (this.snaps[i].tick <= rt && this.snaps[i + 1].tick >= rt) { a = this.snaps[i]; b = this.snaps[i + 1]; break; }
    }
    if (rt >= b.tick) a = b;
    const t = b.tick === a.tick ? 1 : Math.max(0, Math.min(1, (rt - a.tick) / (b.tick - a.tick)));
    const prev = new Map(a.ships.map((s) => [s.id, s]));
    const ships = b.ships.map((sb) => {
      const sa = prev.get(sb.id);
      if (!sa || sa.st !== sb.st || Math.hypot(sa.x - sb.x, sa.y - sb.y) > 200) return sb;
      return { ...sb, x: lerp(sa.x, sb.x, t), y: lerp(sa.y, sb.y, t), a: lerpAngle(sa.a, sb.a, t) };
    });
    return { ships, shards: this.latest.shards };
  }
}
