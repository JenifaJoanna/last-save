// Afterlife: the live licence status screen (also public at /status). Dead = the screen flickers to a red flatline.
import { useEffect, useRef } from "react";
import { Heartbeat } from "../../components/brand";
import { LogTimeline, type LogEntry, type LogTone } from "../../components/terminal/LogTimeline";
import { usePrimary } from "../../components/terminal/nav";
import { Card, Ext, Note, ScreenTitle, Skeleton, StatusBadge } from "../../components/ui";
import { useActivity, useHosts, useInfo, useMyLicence, useSnapshot, type Activity, type Info } from "../../lib/licence";
import { accountUrl, ago, CONTRACT, near, shortAcct, shortHash } from "../../lib/near";
import { sfx } from "../../lib/sound";
import { useWallet } from "../../lib/wallet";
import { PREVIEW } from "../../preview/store";
import { causeText, HolderVote, Money, ProofOfLife, Release, YourChoice } from "./afterlife-cards";

function Hero({ d }: { d: Info }) {
  const dead = d.status === "Dead";
  const released = !!d.releasedKey;
  const word = released ? "Released" : dead ? "Gone dark" : "Alive";
  const sub = dead
    ? `Declared ${ago(d.diedAt)} because ${causeText(d.cause)}. ${released ? `The server was released ${ago(d.releasedAt)}.` : "Anyone can trigger the release now."}`
    : `${d.lastProbe ? `Last proof of life ${ago(d.lastAlive)}.` : "No probe has run yet."} ${d.supply} licences sold, ${near(d.potLocked)} Ⓝ locked for holders by contract.`;
  return (
    <section data-print className={`card relative overflow-hidden p-5 sm:p-8 ${dead ? "border-dead/50" : ""}`}>
      <div className="grid items-center gap-6 md:grid-cols-[1fr_minmax(220px,42%)]">
        <div className="min-w-0">
          <StatusBadge status={d.status} released={released} big />
          <h1 key={word} className={`display mt-4 text-[clamp(38px,6vw,76px)] ${released ? "display-sunset" : dead ? "text-dead" : "text-text"}`}>{word}</h1>
          <p className="label mt-3 text-[13px] text-gold">{dead ? "The studio went dark. The game did not." : "Ember Rift is serving players."}</p>
          <p className="mt-2 max-w-xl text-[13px] text-muted">{sub}</p>
        </div>
        <Heartbeat alive={!dead} className={`h-24 w-full ${released ? "text-gold" : dead ? "text-dead" : "text-alive"}`} />
      </div>
    </section>
  );
}

const TITLES: Record<string, string> = { buy: "Licence minted", report: "Holder report", death: "Studio declared gone", release: "Server key released", choose: "Holder choice", host: "Host registered", claim: "Epoch claimed", evm_payout: "Base payout" };
function toLog(items: Activity[]): LogEntry[] {
  return items.slice(0, 10).map((a, i) => {
    const out = String(a.detail.outcome ?? ""), det = String(a.detail.detail ?? "");
    const tone: LogTone = a.kind === "death" || out === "failed" ? "fail" : out === "inconclusive" || a.kind === "report" ? "warn"
      : a.kind === "release" || a.kind === "evm_payout" || out === "booked" || out === "pledge" ? "gold" : out === "alive" || out === "paid" || out === "registered" ? "ok" : "info";
    const title = a.kind === "probe" ? "Probe" : TITLES[a.kind] ?? a.kind.replace(/_/g, " ");
    return { id: `${a.at}-${i}`, title, outcome: out === "inconclusive" ? "not counted" : out || undefined, detail: det.replace(/(\d{20,})/g, (m) => `${near(m)} Ⓝ`), when: ago(a.at), tone };
  });
}

function Feed() {
  const act = useActivity(4000);
  const items = act.data ?? [];
  return (
    <Card eyebrow="On-chain log" title="What just happened" action={<Ext href={accountUrl(CONTRACT)}>Explorer</Ext>}>
      {act.loading ? <div className="grid gap-2"><Skeleton className="h-6" /><Skeleton className="h-6" /></div>
        : items.length === 0 ? <p className="mono text-faint">&gt; no probes, reports or claims yet<span className="caret" /></p> : <LogTimeline entries={toLog(items)} />}
    </Card>
  );
}

export function AfterlifeView() {
  const { accountId, call, gasless } = useWallet();
  const info = useInfo(3000);
  const mine = useMyLicence(accountId, 5000);
  const hosts = useHosts(8000);
  const snap = useSnapshot(10000);
  const d = info.data;
  const refresh = () => { info.refresh(); mine.refresh(); };
  const was = useRef<string | null>(null);
  useEffect(() => {
    if (!d) return;
    const now = d.status;
    if (was.current === "Alive" && now === "Dead") {
      const screen = document.querySelector(".crt-flicker");
      screen?.classList.add("dead-flicker");
      window.setTimeout(() => screen?.classList.remove("dead-flicker"), 650);
      if (!PREVIEW) sfx("flatline");
    }
    was.current = now;
  }, [d?.status]);
  const dead = d?.status === "Dead";
  usePrimary(!d || !accountId ? null : !dead ? { label: "Probe", run: () => void call("probe_official", {}, { deposit: gasless ? "0" : "20000000000000000000000", gasTgas: 300, label: "Probe finished" }).then(refresh), disabled: d.probeInFlight }
    : !d.releasedKey ? { label: "Release", run: () => void call("release", {}, { deposit: gasless ? "0" : "20000000000000000000000", gasTgas: 300, label: "Release finished" }).then(refresh), disabled: d.releaseState === "InFlight" } : null,
  [d?.status, d?.releasedKey, d?.probeInFlight, d?.releaseState, accountId, gasless]);

  if (!d) {
    return (
      <div className="grid gap-4">
        {info.missing ? <Note>The licence contract is being deployed to NEAR testnet. This screen fills in as soon as it is live.</Note> : info.error ? <Note tone="dead">{info.error}</Note> : null}
        <Skeleton className="h-48 w-full" /><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <Hero d={d} />
      {info.error && <Note tone="dead">{info.error}</Note>}
      <div className="grid gap-4 lg:grid-cols-3">
        <ProofOfLife d={d} refresh={refresh} />
        <HolderVote d={d} mine={mine.data} refresh={refresh} />
        <Release d={d} refresh={refresh} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
        <YourChoice d={d} mine={mine.data} refresh={refresh} />
        <Money d={d} />
        <Card eyebrow="Community hosts" title={`${hosts.data?.length ?? 0} registered`}>
          {(hosts.data ?? []).length === 0 ? <p className="text-[13px] text-muted">{d.releasedKey ? "No host yet. Anyone can run one command and register." : "Hosts can register once the server is released."}</p> : (
            <ul className="grid gap-2">
              {(hosts.data ?? []).slice(0, 4).map((h) => (
                <li key={h.hostId} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0"><span className="label block text-[12px]">{shortAcct(h.hostId)}</span><span className="mono block truncate text-faint">{h.endpoint}</span></span>
                  <span className="num shrink-0 text-alive">{near(h.earned)} Ⓝ</span>
                </li>
              ))}
            </ul>
          )}
          {snap.data && <p className="mt-4 border-t border-line pt-3 text-[11.5px] text-faint">Progress snapshot #{snap.data.seq} · {Object.keys(snap.data.players).length} players · <span className="mono">{shortHash(snap.data.hash, 6)}</span></p>}
        </Card>
      </div>
      <Feed />
    </div>
  );
}

export default function Afterlife() {
  return (
    <div className="mx-auto max-w-7xl">
      <ScreenTitle eyebrow="Ember Rift · licence contract">Licence status</ScreenTitle>
      <AfterlifeView />
    </div>
  );
}
