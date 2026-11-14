// Afterlife dashboard cards. Every action is a real contract call; every number is read from chain.
// Story moments: probes print as terminal lines, the released key decodes, the choice is two big numbered rows.
import { Cpu, KeyRound, Lock, Megaphone, ServerCrash } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useDecode } from "../../components/terminal/effects";
import { typing } from "../../components/terminal/nav";
import { Bracket, Button, Card, Copy, MenuRow, Note } from "../../components/ui";
import { useActivity, type Info, type LicenceView } from "../../lib/licence";
import { ago, duration, near, toYocto } from "../../lib/near";
import { useWallet } from "../../lib/wallet";

const OUTLAYER_DEPOSIT = toYocto("0.02");
const CAUSE: Record<string, string> = { probes: "probes found no players being served", players: "licence holders reported the server down", studio: "the studio ended service" };
export const causeText = (c: string | null) => (c ? CAUSE[c] ?? c : "");

/** The last probes as terminal lines: `> PROBE 2/3 ..... FAILED unreachable`. */
function ProbeLines({ threshold }: { threshold: number }) {
  const act = useActivity(4000).data ?? [];
  const probes = act.filter((a) => a.kind === "probe" || a.kind === "death").slice(0, 8).reverse();
  let n = 0;
  const lines = probes.map((a) => {
    const out = String(a.detail.outcome ?? "");
    if (a.kind === "death") return { k: `${a.at}d`, t: "> STUDIO DECLARED GONE", r: "DEAD", c: "text-dead", at: a.at };
    if (out === "alive") { n = 0; return { k: `${a.at}a`, t: "> PROBE ......... ALIVE", r: String(a.detail.detail ?? ""), c: "text-alive", at: a.at }; }
    if (out === "failed") { n++; return { k: `${a.at}f`, t: `> PROBE ${n}/${threshold} ....... FAILED`, r: String(a.detail.detail ?? ""), c: "text-dead", at: a.at }; }
    return { k: `${a.at}i`, t: "> PROBE ......... NOT COUNTED", r: "enclave timeout", c: "text-amber", at: a.at };
  }).slice(-4);
  if (!lines.length) return <p className="mono mt-4 text-faint">&gt; no probe has run yet<span className="caret" /></p>;
  return (
    <div className="mono mt-4 grid gap-1 border-t border-line pt-3 text-[12px] leading-5">
      {lines.map((l) => <p key={l.k} className="step-in flex justify-between gap-3"><span className={l.c}>{l.t}<span className="text-faint"> {l.r}</span></span><span className="shrink-0 text-faint">{ago(l.at)}</span></p>)}
    </div>
  );
}

export function ProofOfLife({ d, refresh }: { d: Info; refresh: () => void }) {
  const { call, pending, accountId, gasless: GASLESS } = useWallet();
  const dead = d.status === "Dead";
  const run = async () => { if (await call("probe_official", {}, { deposit: GASLESS ? "0" : OUTLAYER_DEPOSIT, gasTgas: 300, label: "Probe finished" })) refresh(); };
  return (
    <Card eyebrow="Proof of life" title="Is the studio still serving players?">
      <div className="flex items-center gap-1.5" aria-label={`${d.failures} of ${d.failThreshold} probes failed`}>
        {Array.from({ length: Math.max(1, d.failThreshold) }, (_, i) => (
          <span key={i} className={`h-3 flex-1 ${i < d.failures ? "bg-dead" : "bg-white/10"} ${i === d.failures - 1 && !dead ? "blink-fast" : ""}`} />
        ))}
      </div>
      <p className="mt-3 text-[13px] text-muted"><b className={`num ${d.failures ? "text-dead" : "text-text"}`}>{d.failures}/{d.failThreshold}</b> failed in a row · {d.lastProbe ? `last proof of life ${ago(d.lastAlive)}` : "no probe yet"}</p>
      {d.probeInFlight && <p className="mono mt-2 text-[12px] text-amber">&gt; enclave checking the official server for signed sessions<span className="caret" /></p>}
      <ProbeLines threshold={d.failThreshold} />
      <p className="mt-3 text-[11.5px] text-faint">Probes count only {duration(d.probeIntervalMs || 0)} apart. An enclave timeout never counts.</p>
      <Button className="mt-4 w-full" variant="ghost" onClick={run} disabled={dead || !accountId || d.probeInFlight} loading={pending === "probe_official"}>
        <Cpu className="size-4" />{dead ? "Probing ended" : GASLESS ? "Run a probe · gas-free" : "Run a probe · ~0.002 Ⓝ"}
      </Button>
    </Card>
  );
}

export function HolderVote({ d, mine, refresh }: { d: Info; mine: LicenceView | null; refresh: () => void }) {
  const { call, pending, gasless: GASLESS } = useWallet();
  const needed = d.reportsNeeded ?? Math.max(1, Math.ceil((d.liveSupply * d.quorumBps) / 10000));
  const dead = d.status === "Dead";
  const report = async () => { if (mine && (await call("report_down", { token_id: mine.tokenId }, { gasTgas: 50, label: "Report recorded" }))) refresh(); };
  return (
    <Card eyebrow="Players decide" title="Report the server down">
      <div className="flex gap-1.5">{Array.from({ length: Math.max(1, needed) }, (_, i) => <span key={i} className={`h-3 flex-1 ${i < d.reportsInWindow ? "bg-amber" : "bg-white/10"}`} />)}</div>
      <p className="mt-3 text-[13px] text-muted">{d.liveSupply === 0 ? "No licences sold yet, so nobody can vote." : <><b className="num text-text">{d.reportsInWindow}/{needed}</b> holder reports within {duration(d.reportWindowMs || 0)}</>}</p>
      <p className="mt-1 text-[11.5px] text-faint">{d.quorumBps / 100}% of the {d.liveSupply} licences sold before shutdown. One report per licence per window.</p>
      <Button className="mt-5 w-full" variant="ghost" onClick={report} disabled={dead || !mine || mine.postDeath} loading={pending === "report_down"}>
        <Megaphone className="size-4" />{dead ? "Vote closed" : mine ? (GASLESS ? "Report it down · gas-free" : "Report it down") : "Holders only"}
      </Button>
    </Card>
  );
}

function Step({ done, active, icon, label, sub }: { done: boolean; active?: boolean; icon: ReactNode; label: string; sub?: ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_1fr] gap-3 py-1.5">
      <span className={`grid size-6 place-items-center border text-[11px] ${done ? "border-alive/60 text-alive" : active ? "blink border-amber text-amber" : "border-line-2 text-faint"}`}>{done ? "✓" : icon}</span>
      <span className="min-w-0"><span className={`block text-[13px] ${done || active ? "text-text" : "text-muted"}`}>{label}</span>{sub && <span className="block truncate text-[11.5px] text-faint">{sub}</span>}</span>
    </li>
  );
}

function DecodedKey({ k }: { k: string }) {
  const shown = useDecode(k, 18, "0123456789abcdef");
  return (
    <Bracket className="mt-4">
      <p className="eyebrow text-[10px]">Server key · decoded on-chain</p>
      <p className="mono mt-2 break-all text-[12px] leading-5 text-gold">{shown}</p>
      <Copy text={k} label="copy key" className="mt-2 -ml-1 text-[11px]" />
    </Bracket>
  );
}

export function Release({ d, refresh }: { d: Info; refresh: () => void }) {
  const { call, pending, accountId, gasless: GASLESS } = useWallet();
  const dead = d.status === "Dead";
  const released = !!d.releasedKey;
  const inflight = d.releaseState === "InFlight";
  const release = async () => { if (await call("release", {}, { deposit: GASLESS ? "0" : OUTLAYER_DEPOSIT, gasTgas: 300, label: "Release finished" })) refresh(); };
  return (
    <Card eyebrow="The escrow" title={released ? "Server released" : dead ? "Ready to release" : "Sealed until shutdown"}>
      <ol>
        <Step done={d.escrowed} icon={<Lock className="size-3" />} label="Key escrowed in an OutLayer enclave" sub="owned by the licence contract" />
        <Step done={d.escrowVerified} icon={<Cpu className="size-3" />} label="Enclave verified it opens the build" sub={d.attestedAt ? `attested ${ago(d.attestedAt)}` : undefined} />
        <Step done={dead} icon={<ServerCrash className="size-3" />} label="Studio declared gone" sub={dead ? `${ago(d.diedAt)} · ${causeText(d.cause)}` : "not yet"} />
        <Step done={released} active={inflight} icon={<KeyRound className="size-3" />} label="Key released on-chain" sub={released ? ago(d.releasedAt) : inflight ? "enclave running release.wasm…" : undefined} />
      </ol>
      {released && d.releasedKey && <DecodedKey k={d.releasedKey} />}
      {dead && !released && <Button className="mt-4 w-full" onClick={release} loading={pending === "release"} disabled={!accountId || inflight}><KeyRound className="size-4" />{d.releaseError ? "Retry the release" : "Release the server"}{GASLESS ? " · gas-free" : ""}</Button>}
      {d.releaseError && !released && <p className="mt-2 text-[11.5px] text-faint">Last attempt: {d.releaseError}. Anyone can retry.</p>}
    </Card>
  );
}

export function YourChoice({ d, mine, refresh }: { d: Info; mine: LicenceView | null; refresh: () => void }) {
  const { call, pending, gasless: GASLESS } = useWallet();
  const [sel, setSel] = useState(0);
  const dead = d.status === "Dead";
  const open = dead && !!mine && !mine.choice && !mine.postDeath;
  const choose = async (choice: "Refund" | "Pledge") => {
    if (!mine || pending) return;
    if (await call("choose", { token_id: mine.tokenId, choice }, { gasTgas: 60, label: choice === "Refund" ? "Refund sent" : "Pledge added to the pool" })) refresh();
  };
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (typing(e)) return; if (e.key === "1") void choose("Refund"); if (e.key === "2") void choose("Pledge"); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  if (!mine) return <Card eyebrow="Your licence" title="No licence on this account"><p className="text-[13px] text-muted">Holders choose what happens to their locked share after a shutdown.</p></Card>;
  return (
    <Card eyebrow={`Your licence #${mine.tokenId}`} title={mine.choice ? (mine.choice === "Refund" ? "You took your refund" : "You pledged to the hosts") : open ? "Choose what your share does" : "Your share is locked for you"}>
      <p className="num text-3xl text-gold">{near(mine.potShare)} Ⓝ</p>
      <p className="mt-1 text-[13px] text-muted">{mine.postDeath ? "Bought after shutdown: 90% of your price went to the hosts' pool, 10% to the gas-free budget." : "locked by contract when you bought"}</p>
      {open && (
        <div className="mt-4 grid gap-1">
          <MenuRow big n={1} title="Refund" sub={`take ${near(mine.potShare)} Ⓝ back`} selected={sel === 0} onSelect={() => setSel(0)} onOpen={() => void choose("Refund")} right={pending === "choose" && sel === 0 ? "…" : undefined} />
          <MenuRow big n={2} title="Pledge" sub="fund fans who host the game" selected={sel === 1} onSelect={() => setSel(1)} onOpen={() => void choose("Pledge")} right={pending === "choose" && sel === 1 ? "…" : undefined} />
          {GASLESS && <p className="mt-2 text-[11.5px] text-faint">Keys 1 or 2. You pay no gas: you sign, the relayer pays, and it cannot change what you signed.</p>}
        </div>
      )}
      {!dead && <p className="mt-4 text-[12.5px] text-faint">If the studio goes dark you can take it back or pledge it to fans who host. The choice moves with the licence if you sell it.</p>}
    </Card>
  );
}

export function Money({ d }: { d: Info }) {
  const cap = BigInt(d.epochCap || "0");
  const runway = cap > 0n ? Number(BigInt(d.pool || "0") / cap) : null;
  const rows = [
    { label: "Locked for holders", v: d.potLocked, c: "bg-gold" },
    { label: "Refunded", v: d.refunded, c: "bg-muted" },
    { label: "Pledged", v: d.pledged, c: "bg-ember" },
    { label: "Keep-alive pool", v: d.pool, c: "bg-cyan" },
    { label: "Paid to hosts", v: d.paidOut, c: "bg-alive" },
    ...(d.evmSettled !== null ? [{ label: "EVM-settled (paid on Base)", v: d.evmSettled, c: "bg-violet" }] : []),
  ];
  return (
    <Card eyebrow="Where the money is" title="Every yoctoNEAR accounted for">
      <ul className="grid gap-2">
        {rows.map((r) => <li key={r.label} className="flex items-center gap-3 text-[13px]"><span className={`size-2.5 ${r.c}`} /><span className="flex-1 text-muted">{r.label}</span><span className="num">{near(r.v)} Ⓝ</span></li>)}
      </ul>
      {d.evmSettled !== null && <p className="mt-3 text-[11.5px] leading-relaxed text-faint">EVM-settled NEAR stays on the contract for good: it backs host payouts already sent on Base Sepolia, and no method can withdraw it.</p>}
      <div className="mt-4"><Note>{runway === null ? `Pool pays ${near(d.payPerSession)} Ⓝ per verified holder session.` : `Runway: ${runway} epochs at the ${near(d.epochCap)} Ⓝ epoch cap (${duration(d.epochMs)} each).`}</Note></div>
    </Card>
  );
}
