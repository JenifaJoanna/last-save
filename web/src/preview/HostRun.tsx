// Fan-host terminal view: the real `pnpm host` output from the judge run, replayed line by line with sound.
import { motion } from "motion/react";
import { Check, Download, KeyRound, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, ScreenTitle } from "../components/ui";
import { goto } from "./store";
import { sfx } from "./sound";

const CMD = "pnpm host --local --claim --account lastsave-fanhost.testnet";
type Line = { t: string; c?: string; wait: number; done?: number; s?: Parameters<typeof sfx>[0] };
const LINES: Line[] = [
  { t: "Last Save host for lastsave-fanhost.testnet on lastsave-licence.testnet", c: "text-text", wait: 500 },
  { t: "  released key matches the on-chain commitment (5bb6b0cf2114...)", wait: 900, done: 0, s: "confirm" },
  { t: "  artifact verified from raw.githubusercontent.com (581053 bytes)", wait: 1300, done: 1, s: "confirm" },
  { t: "  decrypted, build_hash b723c6d4854b... matches", wait: 1000, s: "unlock" },
  { t: "  unpacked 24 files to host/.host/b723c6d4854b1b86…", wait: 500 },
  { t: "Verified build b723c6d4854b1b8688a0a4a1191dda26d0492d6cf28a26cd1c88e7ac222bc967, restoring progress snapshot #7", c: "text-alive", wait: 900, done: 2 },
  { t: "  local server healthy on http://127.0.0.1:52757", wait: 900 },
  { t: "  tunnel up: https://tobago-frame-dawn-underlying.trycloudflare.com, waiting for it to answer", wait: 1400 },
  { t: "Serving at https://tobago-frame-dawn-underlying.trycloudflare.com", c: "text-cyan", wait: 900, s: "reconnect" },
  { t: "register_host: https://testnet.nearblocks.io/txns/EZve8FLQBbSyudVgfVbxZZkPaUXf6YZy1BygbjJc8uJh", c: "text-ember", wait: 1500, done: 3, s: "confirm" },
  { t: "Claiming completed epochs every 30 s while serving (Ctrl+C to stop).", wait: 900 },
  { t: "claim_epoch(8): https://testnet.nearblocks.io/txns/tpW2JXZUsddE346UuhrtYV9PB9HDLS1HRfaDVL7XrP1", c: "text-alive", wait: 2600, s: "confirm" },
];
const STEPS = [
  { icon: KeyRound, t: "Released key matches the commitment" },
  { icon: Download, t: "Encrypted build matches its on-chain hash" },
  { icon: ShieldCheck, t: "Decrypted, build hash checked, progress restored" },
  { icon: Upload, t: "Serving publicly, registered on-chain" },
];

const linkify = (t: string) => t.split(/(https:\/\/testnet\.nearblocks\.io\/txns\/\w+)/).map((part, i) =>
  i % 2 ? <a key={i} href={part} target="_blank" rel="noopener" className="underline decoration-dotted underline-offset-2 hover:text-text">{part}</a> : part);

export default function HostRun() {
  const [typed, setTyped] = useState(0);
  const [shown, setShown] = useState(0);
  const [run, setRun] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { goto("postbuy", "fanhost"); }, []);
  useEffect(() => {
    let alive = true;
    setTyped(0); setShown(0);
    (async () => {
      await new Promise((r) => setTimeout(r, 600));
      sfx("type", 0.22);
      for (let i = 1; i <= CMD.length && alive; i++) { setTyped(i); await new Promise((r) => setTimeout(r, 28)); }
      for (let i = 0; i < LINES.length && alive; i++) {
        await new Promise((r) => setTimeout(r, LINES[i].wait));
        if (!alive) return;
        setShown(i + 1);
        if (LINES[i].s) sfx(LINES[i].s!);
        if (i === 9) goto("hosted", "fanhost");
        if (i === 11) goto("paid", "fanhost");
      }
    })();
    return () => { alive = false; };
  }, [run]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [shown]);
  const doneSteps = LINES.slice(0, shown).reduce((m, l) => (l.done !== undefined ? Math.max(m, l.done + 1) : m), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <ScreenTitle eyebrow="One command · the real run, replayed">Fan host</ScreenTitle>
      <main className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div data-print className="overflow-hidden border border-line-2 bg-void">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="size-2.5 bg-ember" /><span className="size-2.5 bg-gold" /><span className="size-2.5 bg-alive" />
            <span className="mono ml-3 truncate text-faint">fan host · last-save</span>
          </div>
          <div ref={box} className="mono h-[min(62vh,520px)] overflow-y-auto p-4 text-[12.5px] leading-[1.7] text-muted sm:p-5">
            <p className="whitespace-pre-wrap break-all text-cyan">$ {CMD.slice(0, typed)}{shown === 0 && <span className="ml-0.5 inline-block h-[1.05em] w-[0.55em] translate-y-[2px] animate-pulse bg-cyan/80" />}</p>
            {LINES.slice(0, shown).map((l, i) => (
              <motion.p key={`${run}-${i}`} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }} className={`whitespace-pre-wrap break-all ${l.c ?? ""}`}>{linkify(l.t)}</motion.p>
            ))}
          </div>
        </div>
        <div className="grid content-start gap-4">
          <div data-print className="card p-5 sm:p-6">
            <p className="eyebrow">One command</p>
            <h2 className="label mt-1 text-[15px]">A fan brings the game back</h2>
            <ol className="mt-5 grid gap-3">
              {STEPS.map((s, i) => (
                <li key={s.t} className="flex items-start gap-3 text-[15px]">
                  <span className={`grid size-7 shrink-0 place-items-center border ${i < doneSteps ? "border-alive/40 bg-alive/15 text-alive" : "border-line bg-ink-2 text-faint"}`}>{i < doneSteps ? <Check className="size-4" /> : <s.icon className="size-4" />}</span>
                  <span className={i < doneSteps ? "text-text" : "text-muted"}>{s.t}</span>
                </li>
              ))}
            </ol>
          </div>
          <Button variant="ghost" onClick={() => setRun((r) => r + 1)}><RotateCcw className="size-4" />Replay</Button>
          <p className="text-xs text-faint">Output from the real run on the locked judge instance (14 Nov), replayed. Links open the actual transactions.</p>
        </div>
      </main>
    </div>
  );
}
