// Terminal home: stripe-cut title, the promise, live key facts, the emblem and the numbered summary menu (1–6).
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { PartnerLogo, SunEmblem } from "../components/brand";
import { MENU, useHints, usePrimary, typing } from "../components/terminal/nav";
import { Bracket, Ext, MenuRow } from "../components/ui";
import { useHosts, useInfo, useLockedKeys } from "../lib/licence";
import { CONTRACT, near } from "../lib/near";
import { blip } from "../lib/sound";

export const PLAY_URL: string = (import.meta.env.VITE_PLAY_URL as string | undefined) ?? "/play/";

function Facts() {
  const d = useInfo(5000).data;
  const keys = useLockedKeys().data;
  const hosts = useHosts(10000).data;
  const dead = d?.status === "Dead";
  const state = !d ? "Reading the contract…" : d.releasedKey ? "Studio gone · server released" : dead ? "Studio gone dark" : "Official server online";
  const tone = !d ? "text-faint" : d.releasedKey ? "text-gold" : dead ? "text-dead" : "text-alive";
  return (
    <Bracket className="mt-6 text-[13px] leading-7">
      <p className={`flex items-center gap-2 font-semibold ${tone}`}><span className={`size-2 ${dead ? "bg-current" : "blink bg-current"}`} />{state}</p>
      <p className="text-muted">Ember Rift · <span className="mono">{CONTRACT}</span></p>
      <ul className="mt-2 grid gap-0.5">
        <li><span className="num text-gold">{keys ?? "…"}</span> access keys{keys === 0 ? ": nobody can change the contract" : " on the contract"}</li>
        <li><span className="num text-gold">{d ? near(d.potLocked) : "…"} Ⓝ</span> locked for holders · <span className="num text-gold">{d ? near(d.pool) : "…"} Ⓝ</span> in the keep-alive pool</li>
        <li><span className="num text-gold">{hosts?.length ?? "…"}</span> community {hosts?.length === 1 ? "host" : "hosts"} registered</li>
      </ul>
      <Ext href="/judges" className="mt-2">Verify it on-chain</Ext>
    </Bracket>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const dead = useInfo(5000).data?.status === "Dead";
  const [sel, setSel] = useState(0);
  const open = (i: number) => navigate(MENU[i].path);
  usePrimary({ label: `Open ${MENU[sel].n}`, run: () => open(sel) }, [sel]);
  useHints(["1-6 choose", "↑↓ navigate", "Enter open", "M sound"]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= MENU.length) { blip("go"); open(n - 1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); blip("select"); setSel((s) => (s + 1) % MENU.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); blip("select"); setSel((s) => (s + MENU.length - 1) % MENU.length); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-[1400px] flex-col">
      <div data-print className="label flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-line pb-3 text-[11px] text-muted">
        <span>Last Save · build 2.0</span>
        <span className="hidden sm:inline">NFT licence · enclave escrow · fan hosting</span>
        <span className="border border-line-2 px-2 py-0.5 text-text">NEAR testnet</span>
      </div>
      <h1 data-print className="display display-sunset mt-6 text-[clamp(46px,10.5vw,150px)]">Last Save</h1>
      <div className="mt-6 grid flex-1 items-center gap-8 lg:grid-cols-[1fr_minmax(200px,0.8fr)_1.1fr]">
        <div data-print>
          <p className="label text-[13px] text-gold">A game licence that outlives its publisher</p>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-text">When a studio switches its servers off, an enclave releases the server build. Every licence turns into a refund or a pledge that pays fans to keep the game running.</p>
          <Facts />
        </div>
        <div data-print><SunEmblem dead={dead} className="mx-auto w-full max-w-[300px]" /></div>
        <div>
          <p data-print className="eyebrow mb-2">Summary</p>
          <nav className="grid" aria-label="Summary">
            {MENU.map((m, i) => <MenuRow key={m.path} n={m.n!} title={m.title} sub={m.sub} selected={sel === i} onSelect={() => setSel(i)} onOpen={() => open(i)} />)}
          </nav>
        </div>
      </div>
      <div data-print className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-4">
        <span className="label text-[11px] text-faint">Built on</span>
        <PartnerLogo name="NEAR" src="/brand/near-logo.svg" className="h-5" />
        <PartnerLogo name="OutLayer" src="/brand/outlayer-logo.png" className="h-5" />
        <span className="label text-[11px] text-muted">Chain Signatures · Global contracts · Meta-transactions</span>
      </div>
    </div>
  );
}
