// Landing sections: lifecycle timeline, why studios opt in, trust model, FAQ.
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Coins, Cpu, HandCoins, KeyRound, Lock, Minus, Plus, ServerCrash, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useState, type ReactNode } from "react";

function Section({ eyebrow, title, lead, children }: { eyebrow: string; title: ReactNode; lead?: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 max-w-3xl text-[clamp(30px,4.2vw,48px)] font-semibold leading-[1.08] tracking-[-0.025em]">{title}</h2>
      {lead && <p className="mt-4 max-w-2xl text-lg text-muted">{lead}</p>}
      <div className="mt-12">{children}</div>
    </section>
  );
}

const STEPS = [
  { icon: Coins, tag: "Buy", title: "A licence is an NFT", body: "Buying mints a NEP-171 token. Part of every price is locked in the contract for you, not paid to the studio.", tone: "text-gold" },
  { icon: Lock, tag: "Escrow", title: "The server key is sealed", body: "The studio's server build is encrypted. Its key sits in an OutLayer enclave, owned by the licence contract, readable only by one exact release program.", tone: "text-cyan" },
  { icon: ServerCrash, tag: "Go dark", title: "Silence is detected, not announced", body: "Anyone can ask an enclave to probe the official server. It must show players it actually served. Failed probes, a holder vote, or the studio itself ends it.", tone: "text-dead" },
  { icon: KeyRound, tag: "Release", title: "The game comes back", body: "The enclave confirms the death and releases the key on-chain. Holders take a refund or pledge it to fans who host. Same progress, back in the match.", tone: "text-alive" },
];

export function Lifecycle() {
  return (
    <Section eyebrow="The promise is code" title={<>From purchase to afterlife,<br className="hidden sm:block" /> every step is on-chain.</>}>
      <ol className="relative grid gap-4 md:grid-cols-4">
        {STEPS.map((s, i) => (
          <motion.li key={s.tag} initial={{ y: 14 }} whileInView={{ y: 0 }} viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }} className="card relative p-6">
            <span className={`grid size-12 place-items-center rounded-[3px] border border-line bg-ink-2 ${s.tone}`}><s.icon className="size-5" /></span>
            <p className="eyebrow mt-5 text-[11px]">{String(i + 1).padStart(2, "0")} · {s.tag}</p>
            <h3 className="mt-2 label text-[15px]">{s.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
          </motion.li>
        ))}
      </ol>
    </Section>
  );
}

export function StudioCase() {
  const cards = [
    { icon: Users, title: "Players are asking for it", body: "Player campaigns now push publishers to keep bought games playable after support ends. Last Save lets a studio prove it in code instead of a press release." },
    { icon: BadgeCheck, title: "A guarantee you can sell", body: "The store shows a Forever Guarantee badge only when the contract has the key escrowed, enclave-verified, and no keys left that could undo it." },
    { icon: HandCoins, title: "Revenue on every resale", body: "Licences are transferable NFTs with NEP-199 royalties, so the studio earns on the secondary market instead of fighting it." },
  ];
  return (
    <Section eyebrow="Why a studio opts in" title="Shutting down stops costing your players their game.">
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="card p-6">
            <c.icon className="size-6 text-ember" />
            <h3 className="mt-4 label text-[15px]">{c.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{c.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Trust() {
  const cannot = [
    "Take the key back: the contract has no delete path and no keys of its own.",
    "Release early: the contract and the enclave program both check that the studio is gone.",
    "Fake liveness with a stub server: probes need fresh sessions signed by licence holders.",
    "Point the release at another contract: the enclave reads the caller's own state.",
  ];
  const trust = [
    { icon: Sparkles, name: "NEAR", body: "Runs the licence contract and its rules." },
    { icon: Cpu, name: "OutLayer TEE workers", body: "Run the release and probe programs on Intel TDX hardware." },
    { icon: ShieldCheck, name: "OutLayer keystore", body: "Holds the sealed key; its master is derived by NEAR MPC and keystores are DAO-approved." },
  ];
  return (
    <Section eyebrow="Trust model" title={<>No single party can stop the release.<br className="hidden sm:block" /> Not the studio. Not us.</>}
      lead="We do not claim nobody is trusted. Here is exactly who is, and what nobody can do.">
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="card p-6 sm:p-8">
          <h3 className="text-lg font-semibold">What nobody can do</h3>
          <ul className="mt-5 grid gap-4">
            {cannot.map((c) => (
              <li key={c} className="flex gap-3 text-[15px] leading-relaxed text-muted"><Lock className="mt-1 size-4 shrink-0 text-alive" /><span>{c}</span></li>
            ))}
          </ul>
        </div>
        <div className="card p-6 sm:p-8">
          <h3 className="text-lg font-semibold">What you rely on</h3>
          <ul className="mt-5 grid gap-5">
            {trust.map((t) => (
              <li key={t.name} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-[3px] border border-line bg-ink-2"><t.icon className="size-5 text-gold" /></span>
                <span><b className="block text-[15px]">{t.name}</b><span className="text-[15px] text-muted">{t.body}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

export const FAQ = [
  { q: "The server code is public after release. Can pirates skip the licence?", a: "Yes, anyone can run the released build. They earn nothing from the keep-alive pool: hosts are paid only for sessions signed by real licence holders, and your progress and the paid hosts follow the licence." },
  { q: "What if the keep-alive pool runs out?", a: "The dashboard shows its runway in epochs. Licences sold after the shutdown put 90% of their price into the pool (10% pays the gas for probes and host claims), pledges top it up, and hosts can keep hosting for free." },
  { q: "Why would a studio opt in?", a: "Player pressure to keep bought games playable, a guarantee badge it can put next to the price, and royalties on every resale." },
  { q: "Who decides that the studio is gone?", a: "Code. Anyone can trigger a probe; an enclave checks that the official server is serving licence holders. Enough failed probes spaced in time, a quorum of holders reporting it down, or the studio's own end-of-service call flips the contract to Dead. A single missed probe or an OutLayer hiccup does not count." },
  { q: "What exactly do I trust?", a: "NEAR, OutLayer's TEE workers on Intel TDX, and OutLayer's keystore (master derived by NEAR MPC, keystores approved by a DAO). Not the studio, and not Last Save." },
  { q: "Is real money involved?", a: "No. This is a NEAR testnet deployment; prices are in testnet NEAR." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section eyebrow="Questions" title="The hard questions, answered plainly.">
      <div className="card divide-y divide-line">
        {FAQ.map((f, i) => (
          <div key={f.q}>
            <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[17px] font-medium">
              {f.q}{open === i ? <Minus className="size-4 shrink-0 text-muted" /> : <Plus className="size-4 shrink-0 text-muted" />}
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden">
                  <p className="max-w-3xl px-6 pb-6 text-[15px] leading-relaxed text-muted">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </Section>
  );
}
