// Your own copy: a judge takes an untouched sbx-* instance (seconds-scale timers) and runs the whole afterlife on it as
// its only holder: buy, play, report, release, refund or pledge, host. The live store and other licences are untouched.
import { Copy as CopyIcon, FlaskConical } from "lucide-react";
import { Card, Copy, LinkButton, Note, ScreenTitle, Skeleton } from "../components/ui";
import { FACTORY, usePoll } from "../lib/licence";
import { view } from "../lib/near";

interface Copy_ { account: string; name: string; status: string; supply: number; released: boolean }
type State = "free" | "yours?" | "dead" | "released";

const useCopies = () => usePoll(async () => {
  const raw = await view<unknown[]>("instances", {}, FACTORY);
  const names = (Array.isArray(raw) ? raw : []).map((x) => String((x as { account_id?: string }).account_id ?? "")).filter((a) => /^sbx-/.test(a));
  return Promise.all(names.sort().map(async (account): Promise<Copy_> => {
    const i = await view<Record<string, unknown>>("get_info", {}, account).catch(() => null);
    const t = (i?.totals ?? {}) as { supply?: number };
    return { account, name: account.split(".")[0], status: String(i?.status ?? "?"), supply: Number(t.supply ?? 0), released: !!i?.released_key };
  }));
}, 10000);

const stateOf = (c: Copy_): State => (c.released ? "released" : c.status === "Dead" ? "dead" : c.supply === 0 ? "free" : "yours?");
const CHIP: Record<State, string> = { free: "border-alive/60 text-alive", "yours?": "border-gold/60 text-gold", dead: "border-dead/60 text-dead", released: "border-gold/60 text-gold" };
const WORD: Record<State, string> = { free: "Free", "yours?": "Taken", dead: "Dead", released: "Released" };

const STEPS: [string, string][] = [
  ["Take a copy, buy its first licence", "0.25 Ⓝ from your own wallet; 0.1 Ⓝ of it is locked for you by the contract. You are the only holder."],
  ["Play it", "On the copy's own official server, from Play. Your level is saved on chain after each match."],
  ["Report the server down", "With one holder, one report is the quorum: the contract declares the studio gone."],
  ["Release the key", "Anyone can trigger it now. An OutLayer enclave checks the death and publishes the server key on chain, in about a minute."],
  ["Refund or pledge", "Take your 0.1 Ⓝ back, or pledge it to the pool that pays fans who host the game."],
  ["Host it and get paid", "Run the released server with one command (it registers your host), play a match on it, then press Claim epoch on the Hosts page: the pool pays for each holder session your host served."],
];

export default function Own() {
  const copies = useCopies();
  const list = copies.data ?? [];
  const free = list.find((c) => stateOf(c) === "free");
  return (
    <div className="mx-auto grid max-w-6xl gap-4">
      <ScreenTitle eyebrow="Your own copy" sub="A fresh Ember Rift licence contract with seconds-scale timers, where you are the only holder. Nothing you do here touches the live store or anyone else's licence.">Run the whole afterlife yourself</ScreenTitle>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card eyebrow="Six steps, about ten minutes" title="From purchase to afterlife">
          <ol className="grid gap-3">
            {STEPS.map(([t, s], i) => (
              <li key={t} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                <span className="num grid size-7 place-items-center border border-line-2 text-[12px] text-gold">{i + 1}</span>
                <span className="min-w-0"><b className="block text-[14px] text-text">{t}</b><span className="block text-[13px] text-muted">{s}</span></span>
              </li>
            ))}
          </ol>
          <div className="mt-4 grid gap-1.5 text-[12.5px] text-muted">
            <span>Step 6, from a terminal (any machine with Node 22):</span>
            <Copy text={`git clone https://github.com/JenifaJoanna/last-save && cd last-save && pnpm install && pnpm host --local --contract ${free?.account ?? "<your copy>"} --account <you>.testnet`} />
          </div>
        </Card>
        <Card eyebrow="Copies on chain" title={copies.loading && !copies.data ? "Reading the factory…" : `${list.filter((c) => stateOf(c) === "free").length} free of ${list.length}`}>
          {copies.loading && !copies.data ? <div className="grid gap-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            : copies.error && !copies.data ? <Note tone="dead">{copies.error}</Note>
            : list.length === 0 ? <Note>No copies are launched right now. Come back in a few minutes, or run the lifecycle locally with <span className="mono">pnpm demo:fresh</span>.</Note>
            : (
              <ul className="divide-y divide-line">
                {list.map((c) => {
                  const st = stateOf(c);
                  return (
                    <li key={c.account} className="flex flex-wrap items-center gap-3 py-2.5">
                      <span className="mono min-w-0 flex-1 break-all text-[13px] text-text">{c.account}</span>
                      <span className={`label border px-1.5 py-0.5 text-[10px] ${CHIP[st]}`}>{WORD[st]}{st === "yours?" ? ` · ${c.supply} holder${c.supply === 1 ? "" : "s"}` : ""}</span>
                      {st === "free"
                        ? <LinkButton href={`/app/store?instance=${c.name}`} size="sm"><FlaskConical className="size-4" />Take it</LinkButton>
                        : <LinkButton href={`/status?instance=${c.name}`} size="sm" variant="ghost"><CopyIcon className="size-4" />Open</LinkButton>}
                    </li>
                  );
                })}
              </ul>
            )}
          {list.length > 0 && !free && <p className="mt-3 text-[12.5px] text-muted">Every copy is taken right now. Open one to watch its afterlife, or check back soon: new copies are launched as they are used.</p>}
        </Card>
      </div>
    </div>
  );
}
