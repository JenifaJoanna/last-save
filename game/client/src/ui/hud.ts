// DOM HUD in the Last Save terminal look: status strip + timer tab, scoreboard list, pilot card, dash keycap,
// countdown/notice cues, results window, and the connection-lost / link-restored banners.
import type { MatchResult, Phase, Profile, ShipState } from "../../../shared/protocol";
import { DASH_CD_MS, scoreOf } from "../../../shared/sim";
import { displayName } from "../render/ships";
import { SLOT_CSS } from "../render/textures";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const two = (n: number) => String(n).padStart(2, "0");
const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${two(Math.floor(s / 60))}:${two(s % 60)}`; };
const PHASE_LABEL: Record<Phase, string> = { lobby: "Waiting", countdown: "Countdown", live: "Live", results: "Results" };
const RING = 289; // 2πr for r = 46
const DASH_KEYS = ["Space", "ShiftLeft", "ShiftRight", "KeyJ"];
const RESULTS_SHOW_MS = 6500;
type ConnState = "connecting" | "authing" | "live" | "lost" | "denied";

export class Hud {
  private lastPhase: Phase | null = null;
  private lastCount = -1;
  private boardKey = "";
  private profile: Profile | null = null;
  private wasLost = false;
  private bannerTimer: number | undefined;
  private restoredTimer: number | undefined;
  private resultsTimer: number | undefined;
  private nextTimer: number | undefined;

  constructor() {
    if (new URLSearchParams(location.search).has("attract")) document.body.classList.add("attract");
    const cap = document.querySelector<HTMLElement>("#dash .cap");
    const press = (on: boolean) => { if (cap) cap.dataset.pressed = String(on); };
    window.addEventListener("keydown", (e) => {
      if (DASH_KEYS.includes(e.code)) press(true);
      if (!$("results").hidden && (e.code === "Enter" || e.code === "Escape" || e.code === "NumpadEnter")) {
        const b = $("rclose");
        b.dataset.pressed = "true";
        window.setTimeout(() => this.hideResults(), 90);
      }
    });
    window.addEventListener("keyup", (e) => { if (DASH_KEYS.includes(e.code)) press(false); });
    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch" && e.clientX >= window.innerWidth * 0.55 && $("results").hidden) { press(true); window.setTimeout(() => press(false), 120); }
    });
    $("rclose").onclick = () => this.hideResults();
  }

  /** Showing the HUD starts a fresh source, so any boot-time "lost" banner is cleared; the new source reports its own state. */
  show(on: boolean): void {
    $("hud").hidden = !on;
    if (on) { $("lost").hidden = true; this.wasLost = false; $("net").classList.remove("bad"); $("netstate").textContent = "link ok"; $("dot").className = "led blink"; }
  }

  setHost(label: string): void { $("hostlabel").textContent = label; }
  setPing(ms: number): void { $("ping").textContent = ms > 0 ? `${Math.round(ms)} ms` : ""; }

  setProfile(p: Profile): void {
    this.profile = p;
    const gold = p.skin === "emberwing";
    $("myname").textContent = displayName(p.account_id);
    $("mylvl").textContent = String(p.level);
    $("mylvl").parentElement?.classList.toggle("gold", gold);
    const skin = $("myskin");
    skin.textContent = `Skin · ${gold ? "Emberwing" : "Standard"}`;
    skin.classList.toggle("gold", gold);
    const prev = (p.level - 1) ** 2 * 100;
    const pct = Math.max(0, Math.min(100, ((p.xp - prev) / Math.max(1, p.next_level_xp - prev)) * 100));
    $("xpfill").style.width = `${pct}%`;
    $("myxp").textContent = `${p.xp.toLocaleString()} / ${p.next_level_xp.toLocaleString()} XP`;
  }

  update(phase: Phase, tLeftMs: number, ships: ShipState[], ownId: string | null, cooldownMs: number): void {
    $("phase").textContent = PHASE_LABEL[phase];
    $("time").textContent = phase === "live" || phase === "countdown" ? fmt(tLeftMs) : "--:--";
    $("clock").classList.toggle("hurry", phase === "live" && tLeftMs < 10_000);
    if (phase !== this.lastPhase) {
      if (phase === "live" && this.lastPhase === "countdown") this.banner("GO!");
      this.lastPhase = phase;
    }
    if (phase === "countdown") {
      const n = Math.ceil(tLeftMs / 1000);
      if (n !== this.lastCount && n > 0) { this.lastCount = n; this.banner(String(n)); }
    } else this.lastCount = -1;

    const ranked = [...ships].sort((a, b) => scoreOf(b) - scoreOf(a) || b.kos - a.kos);
    const key = ranked.map((s) => `${s.id}:${s.shards}:${s.kos}:${s.level}:${s.skin}`).join("|");
    if (key !== this.boardKey) {
      this.boardKey = key;
      $("rows").innerHTML = ranked.map((s, i) => {
        const c = SLOT_CSS[s.slot % 8];
        const fl = s.skin === "emberwing" ? '<span class="fl">▲</span>' : "";
        return `<li class="${s.id === ownId ? "row-sel" : ""}"><span class="n">${two(i + 1)}</span><i class="chip" style="background:${c}"></i>
          <span class="lv">L${s.level}</span><span class="nm">${esc(s.id === ownId ? "You" : displayName(s.id))}${fl}</span>
          <span class="sc">◆${s.shards}</span><span class="ko">✕${s.kos}</span></li>`;
      }).join("");
    }
    $("dash").classList.toggle("ready", cooldownMs <= 0);
    $("dashring").style.strokeDashoffset = String(RING * Math.max(0, Math.min(1, cooldownMs / DASH_CD_MS)));
  }

  banner(text: string, sub = false): void {
    const b = $("banner");
    b.textContent = text;
    b.className = sub ? "sub label" : "display display-sunset";
    b.style.animationDuration = sub ? "2600ms" : "";
    void b.offsetWidth;
    b.classList.add("show");
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => b.classList.remove("show"), sub ? 2600 : 900);
  }

  showResults(results: MatchResult[], ownId: string | null): void {
    $("rlist").innerHTML = results.map((r, i) => `<li class="step-in${r.account_id === ownId ? " row-sel" : ""}" style="animation-delay:${i * 55}ms">
      <span class="n">${two(r.place)}</span><i class="chip" style="background:var(--color-ember)"></i>
      <span class="nm">${esc(r.account_id === ownId ? "You" : displayName(r.account_id))}</span><span class="st">◆${r.shards} · ✕${r.kos}</span>
      <span class="xp">+${r.xp_gained} XP</span></li>`).join("");
    const me = results.find((r) => r.account_id === ownId);
    $("rme").innerHTML = me && me.level_after > me.level_before
      ? `<div class="up label step-in" style="animation-delay:${results.length * 55 + 120}ms">▲ Level ${me.level_after}${me.unlocked === "emberwing" ? " · Emberwing unlocked" : ""}</div>` : "";
    $("rclose").dataset.pressed = "false";
    $("results").hidden = false;
    const until = Date.now() + RESULTS_SHOW_MS;
    const tick = () => { $("rnext").textContent = `Next match · ${two(Math.max(0, Math.ceil((until - Date.now()) / 1000)))}`; };
    tick();
    window.clearInterval(this.nextTimer);
    this.nextTimer = window.setInterval(tick, 250);
    window.clearTimeout(this.resultsTimer);
    this.resultsTimer = window.setTimeout(() => this.hideResults(), RESULTS_SHOW_MS);
  }

  private hideResults(): void {
    window.clearInterval(this.nextTimer);
    window.clearTimeout(this.resultsTimer);
    $("results").hidden = true;
  }

  conn(state: ConnState, attempt: number, platformUrl: string): void {
    const live = state === "live";
    $("net").classList.toggle("bad", !live);
    $("netstate").textContent = live ? "link ok" : state === "lost" ? "link lost" : "linking";
    $("dot").className = `led blink${live ? "" : state === "lost" ? " bad" : " warn"}`;
    const lost = state === "lost";
    $("lost").hidden = !lost;
    if (lost) {
      $("lostmsg").textContent = attempt > 1 ? `the server is not responding · retry ${attempt}` : "the server is not responding · retrying";
      ($("afterlife") as HTMLAnchorElement).href = `${platformUrl}/status`;
    }
    if (lost) { this.wasLost = true; window.clearTimeout(this.restoredTimer); $("restored").hidden = true; }
    if (live && this.wasLost) { this.wasLost = false; this.restored(); }
    if (state === "denied") this.wasLost = false;
  }

  private restored(): void {
    $("restored").hidden = false;
    window.clearTimeout(this.restoredTimer);
    this.restoredTimer = window.setTimeout(() => { $("restored").hidden = true; }, 2400);
  }

  get currentProfile(): Profile | null { return this.profile; }
}
