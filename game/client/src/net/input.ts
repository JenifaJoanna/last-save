// Keyboard (WASD/arrows + Space/Shift), mouse (hold to thrust toward cursor, right-click dash),
// touch (left-side virtual stick, right-side tap to dash).
import type { Input } from "../../../shared/sim";

export class Controls {
  private keys = new Set<string>();
  private pointer: { x: number; y: number; down: boolean } = { x: 0, y: 0, down: false };
  private dashPulse = false;
  private stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private stickEl: HTMLDivElement;
  private knobEl: HTMLDivElement;
  /** screen position of the player's skiff, for mouse steering */
  shipScreen = { x: 0, y: 0 };

  constructor(private el: HTMLElement) {
    window.addEventListener("keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => { this.keys.clear(); this.pointer.down = false; });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("pointerdown", (e) => this.down(e));
    window.addEventListener("pointermove", (e) => this.move(e));
    window.addEventListener("pointerup", (e) => this.up(e));
    window.addEventListener("pointercancel", (e) => this.up(e));
    this.stickEl = document.createElement("div");
    this.stickEl.className = "stick";
    this.knobEl = document.createElement("div");
    this.knobEl.className = "stick-knob";
    this.stickEl.appendChild(this.knobEl);
    document.body.appendChild(this.stickEl);
  }

  private down(e: PointerEvent): void {
    if (e.pointerType === "touch") {
      if (e.clientX < window.innerWidth * 0.55 && !this.stick) {
        this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        this.stickEl.style.display = "block";
        this.stickEl.style.transform = `translate(${e.clientX - 60}px, ${e.clientY - 60}px)`;
      } else this.dashPulse = true;
      return;
    }
    if (e.button === 2) { this.dashPulse = true; return; }
    this.pointer = { x: e.clientX, y: e.clientY, down: true };
  }

  private move(e: PointerEvent): void {
    if (this.stick && e.pointerId === this.stick.id) {
      this.stick.x = e.clientX; this.stick.y = e.clientY;
      const dx = Math.max(-50, Math.min(50, e.clientX - this.stick.ox)), dy = Math.max(-50, Math.min(50, e.clientY - this.stick.oy));
      this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      return;
    }
    this.pointer.x = e.clientX; this.pointer.y = e.clientY;
  }

  private up(e: PointerEvent): void {
    if (this.stick && e.pointerId === this.stick.id) { this.stick = null; this.stickEl.style.display = "none"; this.knobEl.style.transform = ""; return; }
    if (e.pointerType !== "touch" && e.button === 0) this.pointer.down = false;
  }

  read(): Input {
    let ax = 0, ay = 0;
    const k = this.keys;
    if (k.has("KeyA") || k.has("ArrowLeft")) ax -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) ax += 1;
    if (k.has("KeyW") || k.has("ArrowUp")) ay -= 1;
    if (k.has("KeyS") || k.has("ArrowDown")) ay += 1;
    if (this.stick) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy, d = Math.hypot(dx, dy);
      if (d > 8) { ax = dx / Math.max(d, 50); ay = dy / Math.max(d, 50); }
    } else if (this.pointer.down && ax === 0 && ay === 0) {
      const dx = this.pointer.x - this.shipScreen.x, dy = this.pointer.y - this.shipScreen.y, d = Math.hypot(dx, dy);
      if (d > 12) { ax = dx / d; ay = dy / d; }
    }
    const len = Math.hypot(ax, ay);
    if (len > 1) { ax /= len; ay /= len; }
    const dash = k.has("Space") || k.has("ShiftLeft") || k.has("ShiftRight") || k.has("KeyJ") || this.dashPulse;
    this.dashPulse = false;
    return { ax, ay, dash };
  }
}
