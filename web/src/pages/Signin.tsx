// Sign in: your own wallet first. 1 NEAR wallet (NEAR Connect: Meteor extension or web, Intear, Nightly, Ledger), asked
// to approve one gas-free key; 2 Ethereum wallet (MetaMask, Rabby, Coinbase through NEAR Connect's Ethereum executor,
// controlling a 0x NEAR account). Secondary and labelled: "Judge demo · no wallet" (practice offline, tap-through preview).
import { Fragment, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Heartbeat } from "../components/brand";
import { typing, usePrimary } from "../components/terminal/nav";
import { Bracket, MenuRow, ScreenTitle } from "../components/ui";
import { useEvmWallets } from "../lib/eip6963";
import { relayerCovers } from "../lib/gasless";
import { useInfo } from "../lib/licence";
import { useWallet } from "../lib/wallet";
import { PREVIEW } from "../preview/store";
import { PLAY_URL } from "./Landing";

const PREVIEW_URL: string = (import.meta.env.VITE_PREVIEW_URL as string | undefined) ?? "https://last-save-preview.pages.dev";
type Group = "wallet" | "demo";
type Option = { id: string; group: Group; title: string; sub: React.ReactNode; tag?: React.ReactNode; run: () => void };
const GROUP_LABEL: Record<Group, string> = {
  wallet: "Your wallet · NEAR Connect",
  demo: "Judge demo · no wallet · nothing is saved, nothing is signed",
};
const openTab = (url: string) => { window.open(url, "_blank", "noopener"); };

export default function Signin() {
  const { ready, accountId, signIn, connecting } = useWallet();
  const evm = useEvmWallets();
  const [free, setFree] = useState(false);
  useEffect(() => { let live = true; void relayerCovers().then((ok) => { if (live) setFree(ok); }); return () => { live = false; }; }, []);
  const [sel, setSel] = useState(0);
  const [, navigate] = useLocation();
  const search = useSearch();
  const next = new URLSearchParams(search).get("next") ?? "";
  const target = next.startsWith("/app") ? next : "/app/library";
  const info = useInfo(8000);
  const dead = info.data?.status === "Dead";
  const detected = evm.slice(0, 3);
  const options: Option[] = [
    { id: "near", group: "wallet", title: "NEAR wallet", sub: free ? "Meteor (extension or web), Intear, Nightly, Ledger · you approve one gas-free key in your wallet" : "Meteor (extension or web), Intear, Nightly, Ledger · you approve each action in your wallet", tag: free ? "gas-free" : "NEAR", run: () => signIn("near") },
    { id: "evm", group: "wallet", title: "Ethereum wallet", run: () => signIn("evm"),
      sub: detected.length ? (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">MetaMask, Rabby, Coinbase control a NEAR account · found here:
          {detected.map((w) => <span key={w.uuid} className="inline-flex items-center gap-1"><img src={w.icon} alt="" className="size-3.5" />{w.name}</span>)}
        </span>
      ) : "MetaMask, Rabby, Coinbase control a NEAR account (0x…) · you approve each action",
      tag: "EVM" },
    { id: "practice", group: "demo", title: "Practice offline", sub: "Ember Rift against bots in your browser · no account, no server", tag: "↗", run: () => openTab(`${PLAY_URL}?practice=1`) },
    ...(PREVIEW ? [] : [{ id: "preview", group: "demo" as const, title: "Tap-through preview", sub: "Every screen with scripted personas · nothing is sent to chain", tag: "↗", run: () => openTab(PREVIEW_URL) }]),
  ];
  const busy = connecting && options[sel]?.group === "wallet";
  useEffect(() => { if (ready && accountId) navigate(target, { replace: true }); }, [ready, accountId, target, navigate]);
  usePrimary({ label: busy ? "Waiting for wallet…" : options[sel]?.group === "demo" ? "Open" : "Connect", run: () => options[sel]?.run(), disabled: !ready || connecting }, [ready, connecting, sel]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) { setSel(n - 1); options[n - 1].run(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <ScreenTitle eyebrow="NEAR testnet · no real money" sub="Connect the wallet you already use. Your licence, your choice after a shutdown and your game progress all follow that account.">Sign in</ScreenTitle>
        <div className="grid gap-1">
          {options.map((o, i) => (
            <Fragment key={o.id}>
              {(i === 0 || options[i - 1].group !== o.group) && (
                <p className={`label flex items-center gap-3 px-3 ${o.group === "demo" ? "mt-6 text-[10px] text-faint" : "text-[11px] text-alive"}`}>
                  {GROUP_LABEL[o.group]}<span aria-hidden className="h-px flex-1 border-t border-dashed border-line-2" />
                </p>
              )}
              <MenuRow big={o.group === "wallet"} n={i + 1} title={o.title} sub={o.sub} selected={sel === i} onSelect={() => setSel(i)} onOpen={o.run}
                right={connecting && sel === i && o.group === "wallet" ? "…" : o.tag} />
            </Fragment>
          ))}
        </div>
        <Bracket className="mt-6 text-[13px] leading-relaxed text-muted">
          <p className="label text-[12px] text-alive">What signing in does</p>
          {free
            ? <p className="mt-2">Your wallet opens through NEAR Connect and you approve there. A NEAR wallet is also asked to add one limited key: it can only call this licence&apos;s free actions (report the server down, choose a refund or pledge, set or claim host pay), never move your NEAR. Those actions then cost you nothing, because a relayer pays their gas.</p>
            : <p className="mt-2">Your wallet opens through NEAR Connect and you approve there. The gas-free relayer does not cover this licence instance, so no extra key is asked for and your wallet approves every action.</p>}
          <p className="mt-2">Buying a licence or registering a host always opens your wallet. An Ethereum wallet controls a NEAR account whose name is its 0x address; it approves every action itself.</p>
        </Bracket>
      </div>
      <div data-print className="relative hidden aspect-[4/5] overflow-hidden border border-line-2 bg-ink-2 lg:block">
        <iframe src={`${PLAY_URL}?attract=1`} title="Ember Rift arena" className="absolute inset-0 size-full" tabIndex={-1} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent" />
        <div className="absolute inset-x-6 bottom-6">
          <p className="display text-[clamp(20px,2vw,28px)] leading-tight">We killed our server. <span className="ember-text">You still have the game.</span></p>
          <div className="mt-3 flex items-center gap-3 text-[12px] text-muted">
            <Heartbeat alive={!dead} className={`h-6 w-20 ${dead ? "text-dead" : "text-alive"}`} />
            {info.data ? (dead ? "Ember Rift's studio has gone dark. The game lives on." : "Ember Rift's official server is alive.") : "Reading the licence contract…"}
          </div>
        </div>
      </div>
    </div>
  );
}
