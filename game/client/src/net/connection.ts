// WebSocket connection with hello/auth, typed messages and reconnect backoff.
import type { ClientMsg, ServerMsg } from "../../../shared/protocol";

export type ConnState = "connecting" | "authing" | "live" | "lost" | "denied";

export interface ConnHandlers {
  hello: () => Promise<ClientMsg>;
  message: (m: ServerMsg) => void;
  state: (s: ConnState, attempt: number) => void;
}

export class Connection {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private closedByUs = false;
  private timer: number | undefined;
  state: ConnState = "connecting";
  rtt = 0;

  constructor(private url: string, private h: ConnHandlers) {}

  start(): void { this.closedByUs = false; this.open(); }

  stop(): void { this.closedByUs = true; window.clearTimeout(this.timer); this.ws?.close(); }

  send(m: ClientMsg): void { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }

  private set(s: ConnState): void { this.state = s; this.h.state(s, this.attempt); }

  private open(): void {
    this.set(this.attempt === 0 ? "connecting" : "lost");
    let ws: WebSocket;
    try { ws = new WebSocket(this.url); } catch { this.retry(); return; }
    this.ws = ws;
    ws.onopen = async () => {
      this.set("authing");
      try { this.send(await this.h.hello()); } catch { ws.close(); }
    };
    ws.onmessage = (ev) => {
      let m: ServerMsg;
      try { m = JSON.parse(String(ev.data)) as ServerMsg; } catch { return; }
      if (m.t === "welcome") { this.attempt = 0; this.set("live"); }
      if (m.t === "denied") { this.closedByUs = true; this.set("denied"); }
      if (m.t === "pong") this.rtt = performance.now() - m.c;
      this.h.message(m);
    };
    ws.onclose = () => { if (!this.closedByUs) this.retry(); };
    ws.onerror = () => { /* onclose follows */ };
  }

  private retry(): void {
    this.attempt++;
    this.set("lost");
    const delay = Math.min(8000, 500 * 2 ** Math.min(this.attempt - 1, 4));
    this.timer = window.setTimeout(() => this.open(), delay);
  }

  ping(): void { this.send({ t: "ping", c: performance.now() }); }
}
