// DOM HUD: scoreboard, clock, profile card, dash meter, banners, results, connection overlay.
import type { MatchResult, Phase, Profile, ShipState } from "../../../shared/protocol";
import { DASH_CD_MS, scoreOf } from "../../../shared/sim";
import { displayName } from "../render/ships";
import { SLOT_CSS } from "../render/textures";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (ms: number) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const PHASE_LABEL: Record<Phase, string> = { lobby: "Waiting", countdown: "Get ready", live: "Live", results: "Results" };

export class Hud {
  private lastPhase: Phase | null = null;
  private lastCount = -1;
  private boardKey = "";
  private profile: Profile | null = null;

  show(on: boolean): void { $("hud").hidden = !on; }

  setHost(label: string): void { $("hostlabel").textContent = label; }
  setPing(ms: number): void { $("ping").textContent = ms > 0 ? `${Math.round(ms)} ms` : ""; }

  setProfile(p: Profile): void {
    this.profile = p;
    $("myname").textContent = displayName(p.account_id);
    const lvl = $("mylvl");
    lvl.textContent = String(p.level);
    lvl.className = `lvl${p.skin === "emberwing" ? " gold" : ""}`;
    $("myskin").textContent = p.skin === "emberwing" ? "Emberwing" : "";
    const prev = (p.level - 1) ** 2 * 100;
    const pct = Math.max(0, Math.min(100, ((p.xp - prev) / Math.max(1, p.next_level_xp - prev)) * 100));
    $("xpfill").style.width = `${pct}%`;
    $("myxp").textContent = `${p.xp.toLocaleString()} / ${p.next_level_xp.toLocaleString()} XP`;
  }

  update(phase: Phase, tLeftMs: number, ships: ShipState[], ownId: string | null, cooldownMs: number): void {
    $("phase").textContent = PHASE_LABEL[phase];
    $("time").textContent = phase === "live" || phase === "countdown" ? fmt(tLeftMs) : "—";
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
      $("board").innerHTML = ranked.map((s) => `<div class="row${s.id === ownId ? " me" : ""}">
        <span class="chip" style="background:${SLOT_CSS[s.slot % 8]};box-shadow:0 0 8px ${SLOT_CSS[s.slot % 8]}"></span>
        <span class="lvl${s.skin === "emberwing" ? " gold" : ""}">${s.level}</span>
        <span class="nm">${esc(s.id === ownId ? "You" : displayName(s.id))}${s.skin === "emberwing" ? '<span class="fl">▲</span>' : ""}</span>
        <span class="sc">◆ ${s.shards}</span><span class="ko">✕ ${s.kos}</span></div>`).join("");
    }
    const ready = cooldownMs <= 0;
    $("dash").classList.toggle("ready", ready);
    $("dashring").style.strokeDashoffset = String(163.4 * (cooldownMs / DASH_CD_MS));
  }

  banner(text: string, sub = false): void {
    const b = $("banner");
    b.textContent = text;
    b.className = sub ? "sub" : "";
    void b.offsetWidth;
    b.classList.add("show");
  }

  showResults(results: MatchResult[], ownId: string | null): void {
    $("rlist").innerHTML = results.map((r) => `<li class="${r.account_id === ownId ? "me" : ""}" style="animation-delay:${r.place * 70}ms">
      <span class="place">#${r.place}</span><span class="chip" style="width:10px;height:10px;border-radius:3px;background:#ff7a1a"></span>
      <span>${esc(r.account_id === ownId ? "You" : displayName(r.account_id))}</span><span>◆ ${r.shards} · ✕ ${r.kos}</span>
      <span class="xp">+${r.xp_gained} XP</span></li>`).join("");
    const me = results.find((r) => r.account_id === ownId);
    $("rme").innerHTML = me && me.level_after > me.level_before
      ? `<div class="up">Level ${me.level_after}${me.unlocked === "emberwing" ? " · Emberwing unlocked" : ""}</div>` : "";
    $("results").hidden = false;
    window.setTimeout(() => { $("results").hidden = true; }, 6500);
  }

  conn(state: "connecting" | "authing" | "live" | "lost" | "denied", attempt: number, platformUrl: string): void {
    $("net").classList.toggle("bad", state !== "live");
    const lost = state === "lost";
    $("lost").hidden = !lost;
    if (lost) {
      $("lostmsg").textContent = attempt > 1 ? `The server is not responding. Retry ${attempt}…` : "The server is not responding. Retrying…";
      ($("afterlife") as HTMLAnchorElement).href = `${platformUrl}/afterlife`;
    }
  }

  get currentProfile(): Profile | null { return this.profile; }
}
