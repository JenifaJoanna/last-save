// Sign in: one numbered list. With a wallet (NEAR Connect): 1 NEAR wallet, gas-free key; 2 Ethereum wallet; the
// localhost test key. Without a wallet: practice offline vs bots, or the tap-through preview. The live arena sits beside it.
import { Fragment, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Heartbeat } from "../components/brand";
import { typing, usePrimary } from "../components/terminal/nav";
import { Bracket, Button, MenuRow, ScreenTitle } from "../components/ui";
import { DEV_ALLOWED } from "../lib/devsigner";
import { useInfo } from "../lib/licence";
import { useWallet } from "../lib/wallet";
import { PREVIEW } from "../preview/store";
import { PLAY_URL } from "./Landing";

const PREVIEW_URL: string = (import.meta.env.VITE_PREVIEW_URL as string | undefined) ?? "https://last-save-preview.pages.dev";
type Group = "wallet" | "none";
type Option = { id: string; group: Group; title: string; sub: string; tag?: string; run: () => void };
const GROUP_LABEL: Record<Group, string> = {
  wallet: "With a wallet · NEAR Connect",
  none: "Without a wallet · nothing is saved, no licence needed",
};
const openTab = (url: string) => { window.open(url, "_blank", "noopener"); };

export default function Signin() {
  const { ready, accountId, signIn, devSignIn, connecting } = useWallet();
  const [devAcct, setDevAcct] = useState("");
  const [devKey, setDevKey] = useState("");
  const [sel, setSel] = useState(0);
  const [, navigate] = useLocation();
  const search = useSearch();
  const next = new URLSearchParams(search).get("next") ?? "";
  const target = next.startsWith("/app") ? next : "/app/library";
  const info = useInfo(8000);
  const dead = info.data?.status === "Dead";
  const options: Option[] = [
    { id: "near", group: "wallet", title: "NEAR wallet", sub: "Meteor, Intear, Nightly, Ledger, NEAR CLI · holder actions cost you no gas", tag: "gas-free", run: () => signIn("near") },
    { id: "evm", group: "wallet", title: "Ethereum wallet", sub: "MetaMask and other EVM wallets sign NEAR transactions · you pay your own gas", run: () => signIn("evm") },
    ...(DEV_ALLOWED ? [{ id: "dev", group: "wallet" as const, title: "Test account key", sub: "local build only · a testnet key you paste", run: () => setSel(devRow) }] : []),
    { id: "practice", group: "none", title: "Practice offline", sub: "Ember Rift against bots in your browser · no account, no server", tag: "↗", run: () => openTab(`${PLAY_URL}?practice=1`) },
    ...(PREVIEW ? [] : [{ id: "preview", group: "none" as const, title: "Tap-through preview", sub: "Every screen with scripted personas · nothing is sent to chain", tag: "↗", run: () => openTab(PREVIEW_URL) }]),
  ];
  const devRow = options.findIndex((o) => o.id === "dev");
  const busy = connecting && options[sel]?.group === "wallet";
  useEffect(() => { if (ready && accountId) navigate(target, { replace: true }); }, [ready, accountId, target, navigate]);
  usePrimary({ label: busy ? "Waiting for wallet…" : options[sel]?.group === "none" ? "Open" : "Connect", run: () => options[sel]?.run(), disabled: !ready || connecting }, [ready, connecting, sel]);
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
        <ScreenTitle eyebrow="NEAR testnet · no real money" sub="Your licence, your choice after a shutdown and your game progress all follow this account.">Sign in</ScreenTitle>
        <div className="grid gap-1">
          {options.map((o, i) => (
            <Fragment key={o.id}>
              {(i === 0 || options[i - 1].group !== o.group) && (
                <p className={`label flex items-center gap-3 px-3 text-[11px] ${o.group === "none" ? "mt-4 text-muted" : "text-alive"}`}>
                  {GROUP_LABEL[o.group]}<span aria-hidden className="h-px flex-1 border-t border-dashed border-line-2" />
                </p>
              )}
              <MenuRow big={o.group === "wallet"} n={i + 1} title={o.title} sub={o.sub} selected={sel === i} onSelect={() => setSel(i)} onOpen={o.run}
                right={connecting && sel === i && o.group === "wallet" ? "…" : o.tag} />
            </Fragment>
          ))}
        </div>
        {DEV_ALLOWED && sel === devRow && (
          <div data-print className="mt-3 grid gap-2 border border-dashed border-line-2 p-4">
            <input value={devAcct} onChange={(e) => setDevAcct(e.target.value.trim())} placeholder="lastsave-mira.testnet" spellCheck={false} className="mono h-10 border border-line-2 bg-void px-3 outline-none focus:border-gold" />
            <input value={devKey} onChange={(e) => setDevKey(e.target.value.trim())} type="password" placeholder="ed25519:…" spellCheck={false} className="mono h-10 border border-line-2 bg-void px-3 outline-none focus:border-gold" />
            <Button variant="ghost" size="sm" disabled={!/\.testnet$/.test(devAcct) || !devKey.startsWith("ed25519:")} onClick={() => { devSignIn({ accountId: devAcct, privateKey: devKey }); setDevKey(""); }}>Use test key</Button>
          </div>
        )}
        <Bracket className="mt-6 text-[13px] leading-relaxed text-muted">
          <p className="label text-[12px] text-alive">What signing in does</p>
          <p className="mt-2">Wallets connect through NEAR Connect. A NEAR wallet is also asked to add one limited key: it can only call this licence&apos;s free actions (report the server down, choose a refund or pledge, claim host pay), never move your NEAR. Those actions then cost you nothing, because a relayer pays their gas.</p>
          <p className="mt-2">Buying a licence or registering a host always opens your wallet for approval. An Ethereum wallet signs every action itself and pays its own gas.</p>
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
