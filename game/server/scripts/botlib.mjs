// Headless Ember Rift player: real WebSocket, real NEP-413 login signed locally, answers receipt requests, simple steering.
import { buildLoginMessage, generateSessionKey, signHello, signLogin, signReceipt } from "../../shared/auth.ts";

const ARENA_R = 620;

export class Bot {
  constructor({ url, accountId, secretKey, recipient, hostId = "official", ttlMs = 3_600_000, play = true, name = accountId }) {
    this.url = url; this.accountId = accountId; this.hostId = hostId; this.play = play; this.name = name;
    this.session = generateSessionKey();
    const message = buildLoginMessage({ host: hostId, sessionPubkey: this.session.public, expMs: Date.now() + ttlMs });
    this.login = signLogin({ accountId, secretKey, message, recipient });
    this.msgs = []; this.waiters = []; this.seq = Date.now(); // above any stale server ack from an earlier process this.snap = null; this.profile = null; this.denied = null;
    this.receipts = 0; this.results = []; this.timer = null; this.closed = false;
  }

  connect() {
    this.closed = false; this.denied = null;
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener("message", (e) => this.#onMessage(JSON.parse(String(e.data))));
    this.ws.addEventListener("close", (e) => { this.closed = true; this.closeInfo = { code: e.code, reason: e.reason }; clearInterval(this.timer); this.#notify(); });
    return new Promise((resolve, reject) => {
      this.ws.addEventListener("open", () => { this.sendHello(); resolve(this); }, { once: true });
      this.ws.addEventListener("error", () => reject(new Error(`websocket error for ${this.accountId}`)), { once: true });
    });
  }

  sendHello(tsMs) {
    const proof = signHello({ host: this.hostId, accountId: this.accountId, sessionSecret: this.session.secret, tsMs });
    this.send({ t: "hello", v: 1, login: this.login, proof });
  }

  send(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }

  #onMessage(m) {
    this.msgs.push(m);
    if (m.t === "welcome") { this.profile = m.you; this.welcome = m; this.#startInput(); }
    else if (m.t === "profile") this.profile = m.you;
    else if (m.t === "denied") this.denied = m;
    else if (m.t === "snap") this.snap = m;
    else if (m.t === "results") this.results.push(m);
    else if (m.t === "receipt_req") {
      this.receipts++;
      this.send({ t: "receipt", receipt: signReceipt({ host: m.host, epoch: m.epoch, nonce: m.nonce, tsMs: m.ts_ms, accountId: this.accountId, sessionSecret: this.session.secret }) });
    }
    this.#notify();
  }

  #notify() { this.waiters = this.waiters.filter((w) => !w()); }

  waitFor(pred, ms = 10_000, label = "condition") {
    return new Promise((resolve, reject) => {
      const done = () => pred(this) ? (clearTimeout(t), resolve(this), true) : false;
      const t = setTimeout(() => reject(new Error(`${this.accountId}: timeout waiting for ${label}`)), ms);
      if (!done()) this.waiters.push(done);
    });
  }

  #startInput() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      const i = this.#steer();
      this.send({ t: "input", seq: ++this.seq, ax: i.ax, ay: i.ay, dash: i.dash });
    }, 50);
  }

  #steer() {
    const s = this.snap, me = s?.ships.find((x) => x.id === this.accountId);
    if (!this.play || !me || me.st !== "alive") return { ax: 0, ay: 0, dash: false };
    const fromCentre = Math.hypot(me.x, me.y);
    if (fromCentre > ARENA_R * 0.82) return { ax: -me.x / fromCentre, ay: -me.y / fromCentre, dash: false };
    let rival = null, rd = 1e9;
    for (const o of s.ships) if (o.id !== this.accountId && o.st === "alive") { const d = Math.hypot(o.x - me.x, o.y - me.y); if (d < rd) { rd = d; rival = o; } }
    let shard = null, sd = 1e9;
    for (const sh of s.shards) { const d = Math.hypot(sh.x - me.x, sh.y - me.y) / sh.v; if (d < sd) { sd = d; shard = sh; } }
    if (rival && rd < 170 && me.cd <= 0 && Math.hypot(rival.x, rival.y) > ARENA_R * 0.45) {
      const l = Math.hypot(rival.x - me.x, rival.y - me.y) || 1;
      return { ax: (rival.x - me.x) / l, ay: (rival.y - me.y) / l, dash: true };
    }
    const t = shard ?? rival ?? { x: 0, y: 0 };
    const dx = t.x - me.x, dy = t.y - me.y, len = Math.hypot(dx, dy) || 1;
    return { ax: dx / len, ay: dy / len, dash: false };
  }

  close() { clearInterval(this.timer); try { this.ws.close(); } catch { /* already closed */ } }
}
