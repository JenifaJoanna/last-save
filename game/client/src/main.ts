// Ember Rift client entry: boot, sign-in, choose a frame source, run the render loop.
import "./ui/styles.css";
import { DT } from "../../shared/sim";
import { sfx, unlockAudio } from "./audio";
import { Controls } from "./net/input";
import { Scene } from "./render/scene";
import { displayName } from "./render/ships";
import { clearSession, fromB64, loadSession, saveSession, type Session } from "./session";
import { Online, Practice, type Source, type SourceEvents } from "./sources";
import { Hud } from "./ui/hud";
import { hideSignin, showSignin, type SigninOpts } from "./ui/signin";
import { resumeRedirectLogin } from "./wallet";

const params = new URLSearchParams(location.search);
const SERVER = (params.get("server") ?? location.origin).replace(/\/$/, "");
const WS_URL = `${SERVER.replace(/^http/, "ws")}/ws`;
const CONTRACT = params.get("contract") ?? (import.meta.env.VITE_LICENCE_CONTRACT as string | undefined) ?? "lastsave-licence.testnet";
const PLATFORM = ((import.meta.env.VITE_PLATFORM_URL as string | undefined) ?? "https://lastsave.pages.dev").replace(/\/$/, "");

const stage = document.getElementById("stage") as HTMLElement;
const scene = new Scene();
const hud = new Hud();
let source: Source = new Practice(false, undefined, 4);
let online: Online | null = null;
let lastPhase = "";

async function health(): Promise<{ host_id: string; build_hash: string } | null> {
  try {
    const r = await fetch(`${SERVER}/health`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.host_id === "string" ? { host_id: j.host_id, build_hash: String(j.build_hash ?? "") } : null;
  } catch { return null; }
}

function events(signin: SigninOpts): SourceEvents {
  return {
    profile: (p) => hud.setProfile(p),
    results: (r) => { hud.showResults(r, source.ownId); sfx.results(); },
    conn: (s, a) => { hud.conn(s, a, PLATFORM); if (s === "lost" && a === 1) sfx.lost(); },
    denied: (code) => {
      clearSession(signin.host);
      online?.stop();
      online = null;
      source = new Practice(false, undefined, 4);
      hud.show(false);
      showSignin(signin, { code, account: undefined });
    },
    notice: (text) => hud.banner(text, true),
  };
}

function startOnline(s: Session, signin: SigninOpts): void {
  saveSession(s);
  hideSignin();
  source.stop();
  online = new Online(WS_URL, s, events(signin));
  source = online;
  hud.show(true);
}

function startPractice(): void {
  source.stop();
  online = null;
  source = new Practice(true, { profile: (p) => hud.setProfile(p), results: (r) => { hud.showResults(r, source.ownId); sfx.results(); } });
  hud.setHost("Practice · offline");
  hud.show(true);
}

async function boot(): Promise<void> {
  await scene.init(stage);
  const controls = new Controls(stage);
  window.addEventListener("pointerdown", unlockAudio, { once: false });
  window.addEventListener("keydown", unlockAudio, { once: false });

  let acc = 0;
  scene.app.ticker.add((tk) => {
    const dt = Math.min(0.1, tk.deltaMS / 1000);
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 5) { acc -= DT; steps++; source.fixedTick(controls.read()); }
    const f = source.frame(performance.now());
    scene.frame({ ships: f.ships, shards: f.shards, ownId: source.ownId }, dt);
    const own = f.ships.find((s) => s.id === source.ownId);
    if (own) controls.shipScreen = scene.toScreen(own.x, own.y);
    hud.update(f.phase, f.tLeft, f.ships, source.ownId, source.cooldown);
    if (online) hud.setPing(online.rtt);
    if (f.phase !== lastPhase) { if (f.phase === "live" && lastPhase === "countdown") sfx.count(true); lastPhase = f.phase; }
    if (source.ownId) {
      for (const e of f.events) {
        if (e.k === "collect" && e.id === source.ownId) sfx.collect(e.v > 1);
        if (e.k === "dash" && e.id === source.ownId) sfx.dash();
        if (e.k === "hit" && (e.a === source.ownId || e.b === source.ownId)) sfx.hit(Math.min(1, e.power / 900));
        if (e.k === "ko" && (e.victim === source.ownId || e.by === source.ownId)) sfx.ko();
      }
    }
    scene.onEvents(f.events, source.ownId);
  });

  if (params.has("practice")) { startPractice(); return; }
  const h = await health();
  const host = h?.host_id ?? "official";
  const hostLabel = host === "official" ? "Official server" : `Community host · ${displayName(host)}`;
  hud.setHost(hostLabel);
  const signin: SigninOpts = { host, hostLabel, buildHash: h?.build_hash ?? "", contract: CONTRACT, platformUrl: PLATFORM,
    onSession: (s) => startOnline(s, signin), onPractice: startPractice };

  const redirect = resumeRedirectLogin();
  if (redirect && "login" in redirect) {
    const secret = Uint8Array.from(redirect.secret.match(/../g) ?? [], (x) => parseInt(x, 16));
    startOnline({ account_id: redirect.login.account_id, host: redirect.host, login: redirect.login, secret }, signin);
    return;
  }
  const saved = loadSession(host);
  if (saved && fromB64(saved.login.signature).length === 64) { startOnline(saved, signin); return; }
  showSignin(signin);
  if (redirect && "error" in redirect) (document.getElementById("err") as HTMLElement).textContent = redirect.error;
  if (!h) hud.conn("lost", 1, PLATFORM);
}

void boot();
