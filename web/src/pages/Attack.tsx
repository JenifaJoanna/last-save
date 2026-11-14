// Try to kill it: every button sends a REAL hostile transaction to the live licence contract (signed by a public
// attacker account, gas paid by the relayer) and prints the contract's own refusal with the transaction link.
import { useEffect, useRef, useState } from "react";
import { typing, useHints, usePrimary } from "../components/terminal/nav";
import { Bracket, MenuRow, ScreenTitle } from "../components/ui";
import { RELAYER_URL } from "../lib/gasless";
import { CONTRACT, rpc, shortHash, txUrl } from "../lib/near";
import { blip, sfx } from "../lib/sound";

const TARGET: string = (import.meta.env.VITE_ATTACK_TARGET as string | undefined) ?? CONTRACT;
const RELAYER_ACCOUNT: string = (import.meta.env.VITE_RELAYER_ACCOUNT as string | undefined) ?? "";
const CODE = "https://github.com/JenifaJoanna/last-save/blob/main/contracts/licence/src";
const ATTACKS = [
  { id: "early-release", title: "Release the key early", sub: "Grab the server key while the studio still serves players", call: "release()", rule: "release.rs: the key only leaves the enclave after the contract declares the studio gone", code: `${CODE}/release.rs`, allowed: "after a shutdown anyone may trigger the release; that is the design" },
  { id: "fake-report", title: "Fake a death report", sub: "Report the server down with a licence you don't own", call: 'report_down({ token_id: "1" })', rule: "liveness.rs: only the licence holder can report, once per window", code: `${CODE}/liveness.rs` },
  { id: "drain-pool", title: "Drain the hosting pool", sub: "Claim host pay without hosting anyone", call: "claim_epoch({ epoch: 0 })", rule: "hosts.rs: pay only for sessions holders signed and an enclave verified", code: `${CODE}/hosts.rs` },
  { id: "redirect-payout", title: "Redirect a host's payout", sub: "Point Base Sepolia payouts at an attacker wallet", call: 'set_payout_evm({ address: "0x…dEaD" })', rule: "evm.rs: an address can only be set on the caller's own host record", code: `${CODE}/evm.rs` },
  { id: "double-sign", title: "Double-pay a host", sub: "Ask NEAR's MPC network to sign the same payout a second time", call: "sign_evm_payout({ id: 0 })", rule: "evm.rs: each payout is signed once; only a fee bump at the same nonce is allowed, so one transfer can land", code: `${CODE}/evm.rs` },
];
type Line = { t: string; c?: string; href?: string };

async function outcome(hash: string): Promise<string | null | undefined> {
  for (let i = 0; i < 25; i++) {
    try {
      const r = await rpc<{ status: unknown; receipts_outcome: { outcome: { status: unknown } }[] }>("EXPERIMENTAL_tx_status", { tx_hash: hash, sender_account_id: RELAYER_ACCOUNT, wait_until: "FINAL" });
      const bad = [r.status, ...r.receipts_outcome.map((x) => x.outcome.status)].find((s) => typeof s === "object" && s && "Failure" in s);
      if (!bad) return null;
      const text = JSON.stringify(bad);
      return text.match(/Smart contract panicked: ([^"\\]+)/)?.[1] ?? text.match(/"([^"]{8,120})"\}*$/)?.[1] ?? "refused";
    } catch { await new Promise((res) => setTimeout(res, 1500)); }
  }
  return undefined;
}

export default function Attack() {
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ t: `> target ${TARGET}`, c: "text-muted" }, { t: "> pick an attack. Each one is a real transaction.", c: "text-muted" }]);
  const [refused, setRefused] = useState(0);
  const log = useRef<HTMLDivElement>(null);
  const push = (l: Line) => setLines((x) => [...x.slice(-40), l]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [lines]);

  const run = async (i: number) => {
    if (busy || !RELAYER_URL) return;
    const a = ATTACKS[i];
    setSel(i); setBusy(true); blip("go");
    push({ t: `$ attacker → ${TARGET}.${a.call}`, c: "text-gold" });
    try {
      const r = await fetch(`${RELAYER_URL}/attack`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attack: a.id, target: TARGET }) });
      const j = (await r.json()) as { hash?: string; error?: string };
      if (!j.hash) { push({ t: `> relayer said no: ${j.error ?? r.status}`, c: "text-amber" }); return; }
      push({ t: `> sent, gas paid by the relayer · tx ${shortHash(j.hash, 6)}`, c: "text-muted", href: txUrl(j.hash) });
      push({ t: "> waiting for the contract…", c: "text-faint" });
      const res = await outcome(j.hash);
      if (res === undefined) push({ t: "> no final result yet; open the transaction", c: "text-amber", href: txUrl(j.hash) });
      else if (res === null) { push({ t: `> ACCEPTED: ${(a as { allowed?: string }).allowed ?? "this call is allowed in the current state"}`, c: "text-alive" }); sfx("confirm"); }
      else { push({ t: `> REFUSED: ${res}`, c: "text-dead" }); push({ t: `  rule: ${a.rule}`, c: "text-faint", href: a.code }); setRefused((n) => n + 1); sfx("powerDown", 0.35); }
    } catch (e) { push({ t: `> network error: ${String(e).slice(0, 80)}`, c: "text-amber" }); }
    finally { setBusy(false); }
  };

  usePrimary(RELAYER_URL ? { label: `Attack ${sel + 1}`, run: () => void run(sel), busy } : null, [sel, busy]);
  useHints(["1-5 attack", "↑↓ choose", "Enter run", "S summary"]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= ATTACKS.length) void run(n - 1);
      else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % ATTACKS.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s + ATTACKS.length - 1) % ATTACKS.length); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <div className="mx-auto max-w-6xl">
      <ScreenTitle eyebrow="Real attacks · real refusals · NEAR testnet" sub="Each button sends a real hostile transaction to the live licence contract. A public attacker account signs it, the relayer pays the gas, and the refusal comes from the contract itself. Nothing on this screen is simulated.">Try to kill it</ScreenTitle>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.15fr]">
        <nav className="grid gap-1" aria-label="Attacks">
          {ATTACKS.map((a, i) => <MenuRow key={a.id} big n={i + 1} title={a.title} sub={a.sub} selected={sel === i} onSelect={() => setSel(i)} onOpen={() => void run(i)} right={busy && sel === i ? "…" : undefined} />)}
        </nav>
        <div className="grid gap-4">
          <div data-print className="border border-line-2 bg-void">
            <div className="flex items-center justify-between border-b border-line px-4 py-2"><span className="label text-[11px] text-faint">attacker.lastsave-studio.testnet</span><span className="label text-[11px] text-dead">{refused} refused</span></div>
            <div ref={log} className="mono h-[min(46vh,380px)] overflow-y-auto p-4 text-[12px] leading-6" aria-live="polite">
              {lines.map((l, i) => <p key={i} className={`step-in break-words ${l.c ?? ""}`}>{l.href ? <a href={l.href} target="_blank" rel="noopener" className="underline decoration-dotted underline-offset-2 hover:text-text">{l.t}</a> : l.t}</p>)}
              {busy && <p className="caret" />}
            </div>
          </div>
          <Bracket className="text-[12.5px] leading-relaxed text-muted">
            <p className="label text-[12px] text-gold">Why it is safe to let anyone press these</p>
            <p className="mt-2">The attacker account holds no licence and no host record. The relayer only forwards zero-deposit calls to this contract, rate-limits them, and pays gas from its own small balance. The contract checks each rule before it spends anything.</p>
          </Bracket>
        </div>
      </div>
    </div>
  );
}
