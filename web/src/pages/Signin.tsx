// Sign in: numbered options (1 NEAR wallet via NEAR Connect, gas-free key; 2 Ethereum wallet; 3 localhost test key),
// the live arena beside it.
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Heartbeat } from "../components/brand";
import { typing, usePrimary } from "../components/terminal/nav";
import { Bracket, Button, MenuRow, ScreenTitle } from "../components/ui";
import { DEV_ALLOWED } from "../lib/devsigner";
import { useInfo } from "../lib/licence";
import { useWallet } from "../lib/wallet";
import { PLAY_URL } from "./Landing";

type Option = { title: string; sub: string; run: () => void };

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
  const devRow = DEV_ALLOWED ? 2 : -1;
  const options: Option[] = [
    { title: "NEAR wallet", sub: "Meteor, Intear, HOT, MyNearWallet and more · holder actions gas-free", run: () => signIn("near") },
    { title: "Ethereum wallet", sub: "MetaMask and other EVM wallets · you pay your own gas", run: () => signIn("evm") },
    ...(DEV_ALLOWED ? [{ title: "Test account key", sub: "local build only", run: () => setSel(devRow) }] : []),
  ];
  useEffect(() => { if (ready && accountId) navigate(target, { replace: true }); }, [ready, accountId, target, navigate]);
  usePrimary({ label: connecting ? "Waiting for wallet…" : "Connect", run: () => options[sel]?.run(), disabled: !ready || connecting }, [ready, connecting, sel]);
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
          {options.map((o, i) => <MenuRow key={o.title} big n={i + 1} title={o.title} sub={o.sub} selected={sel === i} onSelect={() => setSel(i)} onOpen={o.run} right={connecting && sel === i ? "…" : undefined} />)}
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
          <p className="mt-2">Wallets connect through NEAR Connect. A NEAR wallet is also asked to add one limited key: it can only call this licence&apos;s free actions (report the server down, choose a refund or pledge, claim host pay), never move your NEAR. Those actions then cost you nothing, because a relayer pays their gas. Buying a licence always opens your wallet for approval.</p>
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
