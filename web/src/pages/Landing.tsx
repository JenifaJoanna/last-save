// Public landing: the promise, live proof from the contract, the lifecycle, trust model, FAQ.
import { motion } from "motion/react";
import { ArrowRight, Radio } from "lucide-react";
import { Heartbeat, PartnerLogo } from "../components/brand";
import { SiteFooter, SiteNav } from "../components/SiteNav";
import { LinkButton, Skeleton } from "../components/ui";
import { useHosts, useInfo } from "../lib/licence";
import { near } from "../lib/near";
import { Faq, Lifecycle, StudioCase, Trust } from "./landing-sections";

export const PLAY_URL: string = (import.meta.env.VITE_PLAY_URL as string | undefined) ?? "/play/";

function LiveFrame() {
  const info = useInfo(5000);
  const dead = info.data?.status === "Dead";
  return (
    <div className="relative">
      <div className="absolute -inset-10 -z-10 rounded-[48px] bg-[radial-gradient(closest-side,rgb(255_122_26/0.28),transparent)] blur-2xl" />
      <div className="overflow-hidden rounded-[22px] border border-line-2 bg-ink-2 shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9)]">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="eyebrow flex items-center gap-2 text-[11px]"><Radio className="size-3.5 text-ember" />Ember Rift · live arena</span>
          <span className="flex gap-1.5"><i className="size-2.5 rounded-full bg-white/10" /><i className="size-2.5 rounded-full bg-white/10" /><i className="size-2.5 rounded-full bg-white/10" /></span>
        </div>
        <div className="relative aspect-[16/11] w-full">
          <iframe src={`${PLAY_URL}?attract=1`} title="Ember Rift arena" className="absolute inset-0 size-full" loading="lazy" tabIndex={-1} />
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl border border-line bg-ink/80 px-3 py-2 backdrop-blur">
            <Heartbeat alive={!dead} className={`h-8 w-24 shrink-0 ${dead ? "text-dead" : "text-alive"}`} />
            <div className="min-w-0 text-sm">
              {info.data ? (
                <p className="truncate"><b className={dead ? "text-dead" : "text-alive"}>{dead ? "Studio gone dark." : "Official server alive."}</b>{" "}
                  <span className="text-muted">{dead ? (info.data.releasedKey ? "Server released to the players." : "Release in progress.") : `Probed by anyone, judged in an enclave.`}</span></p>
              ) : <p className="text-muted">Reading the licence contract…</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveNumbers() {
  const info = useInfo(5000);
  const hosts = useHosts(10000);
  const d = info.data;
  const cells = [
    { label: "Licences sold", value: d ? String(d.supply) : null },
    { label: "Locked for players", value: d ? `${near(d.potLocked)} Ⓝ` : null },
    { label: "Keep-alive pool", value: d ? `${near(d.pool)} Ⓝ` : null },
    { label: "Community hosts", value: hosts.data ? String(hosts.data.length) : d ? "0" : null },
  ];
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="card grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
        {cells.map((c) => (
          <div key={c.label} className="p-5 sm:p-6">
            <p className="eyebrow text-[11px]">{c.label}</p>
            {c.value === null ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="num mt-1.5 text-3xl font-semibold">{c.value}</p>}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-faint">Read live from the licence contract on NEAR testnet{info.missing ? " (contract deploying)" : ""}.</p>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="relative overflow-x-clip">
      <div className="grain" />
      <SiteNav />
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_70%_30%,rgb(122_29_107/0.35),transparent),radial-gradient(40%_40%_at_10%_80%,rgb(42_31_122/0.35),transparent)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}>
            <p className="eyebrow">A game licence on NEAR</p>
            <h1 className="mt-4 text-[clamp(40px,5.4vw,70px)] font-semibold leading-[1.03] tracking-[-0.035em] [text-wrap:balance]">
              <span className="block">We killed our server.</span><span className="ember-text block">You still have the game.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Last Save is a licence that outlives its publisher. When the official servers go dark, an enclave releases the server build,
              every licence unlocks a refund or a pledge that pays a fan to host, and your progress comes back with you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/app/store" size="lg">Get Ember Rift <ArrowRight className="size-4" /></LinkButton>
              <LinkButton href="/status" size="lg" variant="ghost">Watch the live status</LinkButton>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <span className="text-xs text-faint">Runs on</span>
              <PartnerLogo name="NEAR" src="/brand/near-logo.svg" className="h-6" />
              <PartnerLogo name="OutLayer" src="/brand/outlayer-logo.png" className="h-6" />
              <span className="mono text-xs text-faint">NEP-171 · NEP-199 · NEP-413</span>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}>
            <LiveFrame />
          </motion.div>
        </div>
      </section>
      <LiveNumbers />
      <Lifecycle />
      <StudioCase />
      <Trust />
      <Faq />
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="card relative overflow-hidden p-8 text-center sm:p-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_100%,rgb(255_122_26/0.22),transparent)]" />
          <h2 className="relative text-[clamp(28px,4vw,44px)] font-semibold tracking-tight">Buy a game that cannot be switched off.</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-muted">Ember Rift is the first title on Last Save. 0.25 Ⓝ on testnet, 40% of it locked for you by contract.</p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3"><LinkButton href="/app/store" size="lg">Get Ember Rift</LinkButton><LinkButton href="/how" size="lg" variant="ghost">How it works</LinkButton></div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
