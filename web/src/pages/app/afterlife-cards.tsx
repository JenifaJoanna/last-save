// Afterlife dashboard cards. Every action is a real contract call; every number is read from chain.
import { motion } from "motion/react";
import { Check, Cpu, HandCoins, KeyRound, Loader2, Lock, Megaphone, RotateCcw, ServerCrash, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Card, Copy, Note } from "../../components/ui";
import type { Info, LicenceView } from "../../lib/licence";
import { ago, duration, near, shortHash, toYocto } from "../../lib/near";
import { useWallet } from "../../lib/wallet";

const OUTLAYER_DEPOSIT = toYocto("0.02");
const CAUSE: Record<string, string> = { probes: "probes found no players being served", players: "licence holders reported the server down", studio: "the studio ended service" };
export const causeText = (c: string | null) => (c ? CAUSE[c] ?? c : "");

export function ProofOfLife({ d, refresh }: { d: Info; refresh: () => void }) {
  const { call, pending, accountId } = useWallet();
  const dead = d.status === "Dead";
  const run = async () => { if (await call("probe_official", {}, { deposit: OUTLAYER_DEPOSIT, gasTgas: 300, label: "Probe finished" })) refresh(); };
  return (
    <Card eyebrow="Proof of life" title="Is the studio still serving players?">
      <div className="flex items-center gap-2">
        {Array.from({ length: Math.max(1, d.failThreshold) }, (_, i) => (
          <motion.span key={i} animate={{ scale: i < d.failures ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.4 }}
            className={`h-2.5 flex-1 rounded-full ${i < d.failures ? "bg-dead shadow-[0_0_12px] shadow-dead" : "bg-white/10"}`} />
        ))}
      </div>
      <p className="mt-3 text-sm text-muted"><b className={d.failures ? "text-dead" : "text-text"}>{d.failures} of {d.failThreshold}</b> failed probes in a row · {d.lastProbe ? `last proof of life ${ago(d.lastAlive)}` : "no probe has run yet"}</p>
      <p className="mt-1 text-xs text-faint">Probes count only when at least {duration(d.probeIntervalMs || 0)} apart. An OutLayer hiccup never counts.</p>
      {d.probeInFlight && <Note><span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" />An enclave is checking the official server for signed player sessions…</span></Note>}
      {d.probeError && !d.probeInFlight && <p className="mt-2 text-xs text-faint">Last probe note: {d.probeError}</p>}
      <Button className="mt-5 w-full" variant="ghost" onClick={run} disabled={dead || !accountId || d.probeInFlight} loading={pending === "probe_official"}>
        <Cpu className="size-4" />{dead ? "Probing ended" : "Run a probe (anyone, ~0.002 Ⓝ)"}
      </Button>
    </Card>
  );
}

export function HolderVote({ d, mine, refresh }: { d: Info; mine: LicenceView | null; refresh: () => void }) {
  const { call, pending } = useWallet();
  const needed = d.reportsNeeded ?? Math.max(1, Math.ceil((d.liveSupply * d.quorumBps) / 10000));
  const pct = needed > 0 ? Math.min(100, (d.reportsInWindow / needed) * 100) : 0;
  const dead = d.status === "Dead";
  const report = async () => { if (mine && (await call("report_down", { token_id: mine.tokenId }, { gasTgas: 50, label: "Report recorded" }))) refresh(); };
  return (
    <Card eyebrow="Players decide" title="Report the server down">
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-gradient-to-r from-ember to-dead" animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} /></div>
      <p className="mt-3 text-sm text-muted">{d.liveSupply === 0 ? "No licences sold yet, so nobody can vote." : <><b className="text-text">{d.reportsInWindow} of {needed}</b> holder reports needed within {duration(d.reportWindowMs || 0)}</>}</p>
      <p className="mt-1 text-xs text-faint">{d.quorumBps / 100}% of the {d.liveSupply} licences sold before shutdown. One report per licence per window.</p>
      <Button className="mt-5 w-full" variant="ghost" onClick={report} disabled={dead || !mine || mine.postDeath} loading={pending === "report_down"}>
        <Megaphone className="size-4" />{dead ? "Vote closed" : mine ? "Report it down" : "Holders only"}
      </Button>
    </Card>
  );
}

function StepRow({ done, active, icon, label, sub }: { done: boolean; active?: boolean; icon: ReactNode; label: string; sub?: ReactNode }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full border ${done ? "border-alive/40 bg-alive/15 text-alive" : active ? "border-ember/50 bg-ember/15 text-ember" : "border-line bg-ink-2 text-faint"}`}>
        {done ? <Check className="size-4" /> : active ? <Loader2 className="size-4 animate-spin" /> : icon}
      </span>
      <span className="min-w-0 pt-1"><span className={`block text-[15px] ${done || active ? "text-text" : "text-muted"}`}>{label}</span>{sub && <span className="block truncate text-xs text-faint">{sub}</span>}</span>
    </li>
  );
}

export function Release({ d, refresh }: { d: Info; refresh: () => void }) {
  const { call, pending, accountId } = useWallet();
  const dead = d.status === "Dead";
  const released = !!d.releasedKey;
  const inflight = d.releaseState === "InFlight";
  const release = async () => { if (await call("release", {}, { deposit: OUTLAYER_DEPOSIT, gasTgas: 300, label: "Release finished" })) refresh(); };
  return (
    <Card eyebrow="The escrow" title={released ? "The server is released" : dead ? "Ready to release" : "Sealed until shutdown"}>
      <ol className="relative before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-line">
        <StepRow done={d.escrowed} icon={<Lock className="size-4" />} label="Key escrowed in an OutLayer enclave" sub="owned by the licence contract" />
        <StepRow done={d.escrowVerified} icon={<Cpu className="size-4" />} label="Enclave verified it opens the build" sub={d.attestedAt ? `attested ${ago(d.attestedAt)}` : undefined} />
        <StepRow done={dead} icon={<ServerCrash className="size-4" />} label="Studio declared gone" sub={dead ? `${ago(d.diedAt)}: ${causeText(d.cause)}` : "not yet"} />
        <StepRow done={released} active={inflight} icon={<KeyRound className="size-4" />} label="Key released on-chain" sub={released ? `${ago(d.releasedAt)}` : inflight ? "enclave running release.wasm…" : undefined} />
      </ol>
      {released && d.releasedKey && <div className="mt-4 rounded-xl border border-alive/25 bg-alive/5 p-3"><p className="eyebrow text-[10px]">Released server key</p><Copy text={d.releasedKey} label={shortHash(d.releasedKey, 14)} className="mt-1" /></div>}
      {dead && !released && (
        <Button className="mt-5 w-full" onClick={release} loading={pending === "release"} disabled={!accountId || inflight}><KeyRound className="size-4" />{d.releaseError ? "Retry the release" : "Release the server"}</Button>
      )}
      {d.releaseError && !released && <p className="mt-2 text-xs text-faint">Last attempt: {d.releaseError}. Anyone can retry.</p>}
    </Card>
  );
}

export function YourChoice({ d, mine, refresh }: { d: Info; mine: LicenceView | null; refresh: () => void }) {
  const { call, pending } = useWallet();
  const dead = d.status === "Dead";
  const choose = async (choice: "Refund" | "Pledge") => {
    if (!mine) return;
    if (await call("choose", { token_id: mine.tokenId, choice }, { gasTgas: 60, label: choice === "Refund" ? "Refund sent" : "Pledge added to the pool" })) refresh();
  };
  if (!mine) return <Card eyebrow="Your licence" title="No licence on this account"><p className="text-sm text-muted">Holders choose what happens to their locked share after a shutdown.</p></Card>;
  return (
    <Card eyebrow={`Your licence #${mine.tokenId}`} title={mine.choice ? (mine.choice === "Refund" ? "You took your refund" : "You pledged to the hosts") : dead ? "Choose what your share does" : "Your share is locked for you"}>
      <p className="num text-3xl font-semibold text-gold">{near(mine.potShare)} Ⓝ</p>
      <p className="mt-1 text-sm text-muted">{mine.postDeath ? "Bought after shutdown: your whole price went to the hosts' pool." : "locked by contract when you bought"}</p>
      {dead && !mine.choice && !mine.postDeath && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="ghost" onClick={() => choose("Refund")} loading={pending === "choose"}><Undo2 className="size-4" />Refund it</Button>
          <Button onClick={() => choose("Pledge")} loading={pending === "choose"}><HandCoins className="size-4" />Pledge to hosts</Button>
        </div>
      )}
      {!dead && <p className="mt-4 text-sm text-faint">If the studio goes dark you can take it back or pledge it to fans who host. The choice moves with the licence if you sell it.</p>}
    </Card>
  );
}

export function Money({ d }: { d: Info }) {
  const cap = BigInt(d.epochCap || "0");
  const runway = cap > 0n ? Number(BigInt(d.pool || "0") / cap) : null;
  const rows = [
    { label: "Locked for holders", v: d.potLocked, c: "bg-gold" },
    { label: "Refunded", v: d.refunded, c: "bg-white/40" },
    { label: "Pledged", v: d.pledged, c: "bg-ember" },
    { label: "Keep-alive pool", v: d.pool, c: "bg-cyan" },
    { label: "Paid to hosts", v: d.paidOut, c: "bg-alive" },
  ];
  return (
    <Card eyebrow="Where the money is" title="Every yoctoNEAR accounted for">
      <ul className="grid gap-3">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 text-[15px]"><span className={`size-2.5 rounded-sm ${r.c}`} /><span className="flex-1 text-muted">{r.label}</span><span className="num font-semibold">{near(r.v)} Ⓝ</span></li>
        ))}
      </ul>
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-sm">
        <RotateCcw className="size-4 text-cyan" />
        {runway === null ? <span className="text-muted">Pool pays {near(d.payPerSession)} Ⓝ per verified holder session.</span>
          : <span className="text-muted">Runway: <b className="text-text">{runway} epochs</b> at the {near(d.epochCap)} Ⓝ epoch cap ({duration(d.epochMs)} each).</span>}
      </div>
    </Card>
  );
}
