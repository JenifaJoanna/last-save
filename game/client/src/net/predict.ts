// Client-side prediction for the player's own skiff, reconciled against server acks.
import type { ShipState } from "../../../shared/protocol";
import { DT, moveShip, type Input } from "../../../shared/sim";

type Local = { x: number; y: number; vx: number; vy: number; a: number; dash: number; cd: number; inv: number; input: Input; dashHeld: boolean };

export class Predictor {
  private local: Local | null = null;
  private pending: { seq: number; input: Input }[] = [];
  private seq = 0;
  private errX = 0;
  private errY = 0;
  private dashHeld = false;

  /** Advance one fixed tick with the current input; returns the seq to send. */
  tick(input: Input): number {
    this.seq++;
    this.pending.push({ seq: this.seq, input: { ...input } });
    if (this.pending.length > 120) this.pending.shift();
    if (this.local) {
      this.local.input = { ...input };
      moveShip(this.local, DT);
      this.dashHeld = this.local.dashHeld;
    }
    return this.seq;
  }

  reconcile(server: ShipState | undefined, ack: number): void {
    if (!server || server.st !== "alive") { this.local = null; this.pending = this.pending.filter((p) => p.seq > ack); return; }
    const before = this.local ? { x: this.local.x + this.errX, y: this.local.y + this.errY } : null;
    const l: Local = { x: server.x, y: server.y, vx: server.vx, vy: server.vy, a: server.a, dash: server.dash, cd: server.cd, inv: server.inv,
      input: { ax: 0, ay: 0, dash: false }, dashHeld: this.dashHeld };
    this.pending = this.pending.filter((p) => p.seq > ack);
    for (const p of this.pending) { l.input = p.input; moveShip(l, DT); }
    this.local = l;
    if (before) {
      const ex = before.x - l.x, ey = before.y - l.y;
      if (Math.hypot(ex, ey) < 160) { this.errX = ex; this.errY = ey; } else { this.errX = 0; this.errY = 0; }
    }
  }

  decay(dt: number): void { const k = Math.exp(-dt * 12); this.errX *= k; this.errY *= k; }

  /** Overlay predicted pose onto the server's view of our ship. */
  apply(server: ShipState): ShipState {
    if (!this.local) return server;
    const l = this.local;
    return { ...server, x: l.x + this.errX, y: l.y + this.errY, vx: l.vx, vy: l.vy, a: l.a, dash: l.dash, cd: l.cd };
  }

  get cooldown(): number { return this.local?.cd ?? 0; }
}
