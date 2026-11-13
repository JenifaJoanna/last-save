// Full-screen sign-in: wallet on one side, the live arena on the other. No site chrome.
import { motion } from "motion/react";
import { ArrowLeft, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { DEV_ALLOWED } from "../lib/devsigner";
import { Link, useLocation, useSearch } from "wouter";
import { Heartbeat, Wordmark } from "../components/brand";
import { Button } from "../components/ui";
import { useInfo } from "../lib/licence";
import { useWallet } from "../lib/wallet";
import { PLAY_URL } from "./Landing";

export default function Signin() {
  const { ready, accountId, signIn, devSignIn } = useWallet();
  const [devAcct, setDevAcct] = useState("");
  const [devKey, setDevKey] = useState("");
  const [, navigate] = useLocation();
  const search = useSearch();
  const next = new URLSearchParams(search).get("next") ?? "";
  const target = next.startsWith("/app") ? next : "/app/library";
  const info = useInfo(8000);
  useEffect(() => { if (ready && accountId) navigate(target, { replace: true }); }, [ready, accountId, target, navigate]);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(420px,1fr)_1.2fr]">
      <div className="relative flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="no-underline"><Wordmark /></Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted no-underline hover:text-text"><ArrowLeft className="size-4" />Back to site</Link>
        </div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mx-auto my-auto w-full max-w-sm py-16">
          <h1 className="text-3xl font-semibold tracking-tight">Sign in with NEAR</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">Use a NEAR testnet wallet. Your licence, your choice after a shutdown and your game progress all follow this account.</p>
          <Button size="lg" className="mt-8 w-full" onClick={signIn} loading={!ready}><Wallet className="size-4" />Connect a wallet</Button>
          <p className="mt-3 text-center text-xs text-faint">Meteor Wallet or MyNearWallet · testnet only, no real money</p>
          {DEV_ALLOWED && (
            <div className="mt-6 grid gap-2 rounded-xl border border-dashed border-line-2 p-4">
              <p className="eyebrow text-[10px]">Local build only · test account key</p>
              <input value={devAcct} onChange={(e) => setDevAcct(e.target.value.trim())} placeholder="lastsave-mira.testnet" spellCheck={false} className="h-10 rounded-lg border border-line bg-white/[0.03] px-3 text-sm outline-none focus:border-ember/60" />
              <input value={devKey} onChange={(e) => setDevKey(e.target.value.trim())} type="password" placeholder="ed25519:…" spellCheck={false} className="h-10 rounded-lg border border-line bg-white/[0.03] px-3 text-sm outline-none focus:border-ember/60" />
              <Button variant="ghost" size="sm" disabled={!/\.testnet$/.test(devAcct) || !devKey.startsWith("ed25519:")} onClick={() => { devSignIn({ accountId: devAcct, privateKey: devKey }); setDevKey(""); }}>Use test key</Button>
            </div>
          )}
          <div className="mt-10 rounded-xl border border-line bg-white/[0.02] p-4 text-sm text-muted">
            <p className="flex items-center gap-2 font-medium text-text"><ShieldCheck className="size-4 text-alive" />What signing in does</p>
            <p className="mt-2 leading-relaxed">It lets this site ask your wallet to sign actions you choose: buying a licence, reporting the server down, taking a refund. Each one opens your wallet for approval.</p>
          </div>
          <p className="mt-8 text-xs text-faint">By continuing you accept that this is a hackathon demo on NEAR testnet.</p>
        </motion.div>
      </div>
      <div className="relative hidden overflow-hidden border-l border-line bg-ink-2 lg:block">
        <iframe src={`${PLAY_URL}?attract=1`} title="Ember Rift arena" className="absolute inset-0 size-full" tabIndex={-1} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent" />
        <div className="absolute inset-x-10 bottom-10">
          <p className="max-w-lg text-[clamp(24px,2.4vw,34px)] font-semibold leading-tight tracking-tight">“We killed our server. <span className="ember-text">You still have the game.</span>”</p>
          <div className="mt-4 flex items-center gap-3 text-sm text-muted">
            <Heartbeat alive={info.data?.status !== "Dead"} className={`h-6 w-20 ${info.data?.status === "Dead" ? "text-dead" : "text-alive"}`} />
            {info.data ? (info.data.status === "Dead" ? "Ember Rift's studio has gone dark. The game lives on." : "Ember Rift's official server is alive.") : "Reading the licence contract…"}
          </div>
        </div>
      </div>
    </div>
  );
}
