// Preview index: every screen in every state, one tap each. Sets the lifecycle step + persona, then opens the screen.
import { ArrowUpRight, Gamepad2, HeartPulse, Landmark, Scale, Server, Store, Terminal } from "lucide-react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ScreenTitle } from "../components/ui";
import { arrive } from "./PreviewDock";
import { goto } from "./store";
import { STEPS, type Persona } from "./world";

interface Tile { title: string; sub: string; step: string; as?: Persona; path: string; tab?: boolean }
const SECTIONS: { name: string; icon: typeof Store; tiles: Tile[] }[] = [
  { name: "Buy and play", icon: Store, tiles: [
    { title: "Store · buy a licence", sub: "Fresh launch: the guarantee checks, then Buy", step: "launch", as: "mira", path: "/app/store" },
    { title: "Library", sub: "mira owns licence #2: level 6, Emberwing skin", step: "sold", as: "mira", path: "/app/library" },
    { title: "Live match vs bots", sub: "Ember Rift, playable with sound (opens a tab)", step: "sold", path: "/play/?practice=1", tab: true },
    { title: "Choose a server", sub: "Official server alive, 4 playing", step: "sold", as: "mira", path: "/app/play" },
  ] },
  { name: "When the studio goes dark", icon: HeartPulse, tiles: [
    { title: "Alive", sub: "Proof of life: 4 holder-signed sessions", step: "sold", path: "/app/afterlife" },
    { title: "Probe running", sub: "An enclave is checking the official server", step: "probing", path: "/app/afterlife" },
    { title: "Probe 1 of 3 failed", sub: "Tap Run a probe to fail the next one", step: "fail1", path: "/app/afterlife" },
    { title: "Probe 2 of 3 + a holder report", sub: "One more failed probe ends it", step: "fail2", path: "/app/afterlife" },
    { title: "Dead", sub: "Tap Release the server", step: "dead", path: "/app/afterlife" },
    { title: "Release running", sub: "release.wasm in the enclave", step: "releasing", path: "/app/afterlife" },
    { title: "Released · refund or pledge", sub: "yuna chooses: tap Refund it or Pledge", step: "released", as: "yuna", path: "/app/afterlife" },
    { title: "After the choices", sub: "Refunds and pledges, where every yocto went", step: "chosen", as: "mira", path: "/app/afterlife" },
    { title: "Buy after the shutdown", sub: "ines buys: 100% to the hosts' pool", step: "chosen", as: "ines", path: "/app/store" },
  ] },
  { name: "Fans keep it alive", icon: Server, tiles: [
    { title: "Fan-host terminal", sub: "One command: verify, decrypt, restore, serve", step: "postbuy", as: "fanhost", path: "/host-run" },
    { title: "Community hosts · hosting opens", sub: "Before anyone registers", step: "postbuy", as: "fanhost", path: "/app/hosts" },
    { title: "Host registered", sub: "Tap Claim epoch to get paid", step: "hosted", as: "fanhost", path: "/app/hosts" },
    { title: "Paid in NEAR", sub: "3 verified sessions, 0.03 Ⓝ", step: "paid", as: "fanhost", path: "/app/hosts" },
    { title: "Paid on Base Sepolia", sub: "Chain Signatures: NEAR's MPC signs for the contract", step: "evm", as: "fanhost", path: "/app/hosts" },
    { title: "Play on a community host", sub: "Official dead, fan server online", step: "paid", as: "mira", path: "/app/play" },
  ] },
  { name: "Front door and judges", icon: Scale, tiles: [
    { title: "Landing · alive", sub: "The pitch with a live heartbeat", step: "sold", path: "/" },
    { title: "Landing · gone dark", sub: "Same page after the shutdown", step: "evm", path: "/" },
    { title: "Sign in", sub: "Wallet sign-in screen", step: "sold", as: "guest", path: "/signin" },
    { title: "How it works", sub: "The lifecycle explained", step: "sold", path: "/how" },
    { title: "Public status page", sub: "Shareable licence status", step: "paid", path: "/status" },
    { title: "Judge guide", sub: "Live facts, studio factory: studio #2 in one tx", step: "studio2", path: "/judges" },
    { title: "Try to kill it", sub: "REAL attacks on the live v2 dev contract, real refusals", step: "sold", path: "/attack" },
  ] },
];
const ICON: Record<string, ReactNode> = { "/host-run": <Terminal className="size-4" />, "/play/?practice=1": <Gamepad2 className="size-4" />, "/judges": <Landmark className="size-4" /> };

export default function PreviewIndex() {
  const [, navigate] = useLocation();
  const open = (t: Tile) => {
    goto(t.step, t.as);
    if (t.tab) { window.open(t.path, "_blank", "noopener"); return; }
    arrive(t.step);
    navigate(t.path);
  };
  return (
    <div className="mx-auto max-w-6xl pb-8">
      <section>
        <ScreenTitle eyebrow="Preview · no wallet · nothing is sent to chain" sub="Real numbers from the locked judge instance. Buttons work and move the story on. The PREVIEW strip at the top steps through the lifecycle (, and .) and switches who is signed in. Sound is on after your first tap.">Every screen</ScreenTitle>
        <div data-print className="flex flex-wrap gap-1.5">
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={() => open({ title: s.label, sub: "", step: s.id, path: s.id === "studio2" ? "/judges" : ["hosted", "paid", "evm"].includes(s.id) ? "/app/hosts" : "/app/afterlife" })}
              className="group label flex items-center gap-2 border border-line-2 py-1 pl-1 pr-3 text-[11px] text-muted hover:border-gold hover:text-text">
              <span className="num grid size-6 place-items-center bg-white/[0.06] text-[11px] text-gold group-hover:bg-gold group-hover:text-key-ink">{String(i + 1).padStart(2, "0")}</span>{s.short}
            </button>
          ))}
        </div>
      </section>
      <div className="mt-10 grid gap-10">
        {SECTIONS.map((sec, si) => (
          <section key={sec.name}>
            <h2 className="eyebrow flex items-center gap-2"><sec.icon className="size-4 text-ember" />{sec.name}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sec.tiles.map((t, ti) => (
                <button key={t.title} onClick={() => open(t)}
                  data-print className="card group flex items-start gap-3 p-4 text-left hover:bg-[var(--color-text)] hover:text-key-ink">
                  <span className="min-w-0 flex-1">
                    <span className="label flex items-center gap-2 text-[13px]">{ICON[t.path]}{t.title}</span>
                    <span className="mt-1 block text-[12.5px] text-muted group-hover:text-key-ink/75">{t.sub}</span>
                  </span>
                  <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-faint group-hover:text-key-ink" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
