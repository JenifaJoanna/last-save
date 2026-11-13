// Afterlife: the live licence status dashboard (also rendered publicly at /status).
import { AnimatePresence, motion } from "motion/react";
import { Activity as ActivityIcon, ExternalLink } from "lucide-react";
import { Heartbeat } from "../../components/brand";
import { Card, Note, Skeleton, StatusBadge } from "../../components/ui";
import { useActivity, useHosts, useInfo, useMyLicence, useSnapshot } from "../../lib/licence";
import { accountUrl, ago, CONTRACT, near, shortAcct, shortHash } from "../../lib/near";
import { useWallet } from "../../lib/wallet";
import { causeText, HolderVote, Money, ProofOfLife, Release, YourChoice } from "./afterlife-cards";

function Hero({ status, sub }: { status: "Alive" | "Dead"; sub: string }) {
  const dead = status === "Dead";
  return (
    <motion.div layout className={`card relative overflow-hidden p-6 sm:p-8 ${dead ? "border-dead/30" : ""}`}>
      <div className={`pointer-events-none absolute inset-0 ${dead ? "bg-[radial-gradient(70%_120%_at_100%_0%,rgb(255_77_109/0.22),transparent)]" : "bg-[radial-gradient(70%_120%_at_100%_0%,rgb(66_255_201/0.12),transparent)]"}`} />
      <div className="relative grid items-center gap-6 md:grid-cols-[1fr_minmax(240px,40%)]">
        <div>
          <StatusBadge status={status} big />
          <AnimatePresence mode="wait">
            <motion.h1 key={status} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-4 text-[clamp(28px,3.6vw,44px)] font-semibold leading-tight tracking-tight">
              {dead ? "The studio went dark. The game did not." : "Ember Rift is alive and serving players."}
            </motion.h1>
          </AnimatePresence>
          <p className="mt-2 text-muted">{sub}</p>
        </div>
        <Heartbeat alive={!dead} className={`h-24 w-full ${dead ? "text-dead" : "text-alive"}`} />
      </div>
    </motion.div>
  );
}

function Feed() {
  const act = useActivity(4000);
  const items = act.data ?? [];
  return (
    <Card eyebrow="On-chain activity" title="What just happened" action={<a href={accountUrl(CONTRACT)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-ember no-underline hover:underline">Explorer<ExternalLink className="size-3.5" /></a>}>
      {act.loading ? <div className="grid gap-2"><Skeleton className="h-6" /><Skeleton className="h-6" /><Skeleton className="h-6" /></div>
        : items.length === 0 ? <p className="text-sm text-muted">No probes, reports or claims yet.</p> : (
          <ul className="grid gap-1">
            <AnimatePresence initial={false}>
              {items.slice(0, 12).map((a, i) => (
                <motion.li key={`${a.at}-${a.kind}-${i}`} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm hover:bg-white/[0.03]">
                  <ActivityIcon className={`mt-0.5 size-4 shrink-0 ${/fail|dead|died/i.test(a.kind + a.text) ? "text-dead" : /alive|pass|released|claim/i.test(a.kind + a.text) ? "text-alive" : "text-muted"}`} />
                  <span className="min-w-0 flex-1"><span className="font-medium capitalize">{a.kind.replace(/_/g, " ")}</span>{a.text && <span className="text-muted"> · {a.text}</span>}</span>
                  <span className="shrink-0 text-xs text-faint">{ago(a.at)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
    </Card>
  );
}

export function AfterlifeView() {
  const { accountId } = useWallet();
  const info = useInfo(3000);
  const mine = useMyLicence(accountId, 5000);
  const hosts = useHosts(8000);
  const snap = useSnapshot(10000);
  const d = info.data;
  const refresh = () => { info.refresh(); mine.refresh(); };

  if (!d) {
    return (
      <div className="grid gap-4">
        {info.missing ? <Note>The licence contract is being deployed to NEAR testnet. This dashboard fills in as soon as it is live.</Note> : info.error ? <Note tone="dead">{info.error}</Note> : null}
        <Skeleton className="h-48 w-full" /><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      </div>
    );
  }
  const sub = d.status === "Dead"
    ? `Declared ${ago(d.diedAt)} because ${causeText(d.cause)}. ${d.releasedKey ? `The server was released ${ago(d.releasedAt)}.` : "Anyone can trigger the release now."}`
    : `Last proof of life ${ago(d.lastAlive)}. ${d.supply} licences, ${near(d.potLocked)} Ⓝ locked for holders by contract.`;
  return (
    <div className="grid gap-4">
      <Hero status={d.status} sub={sub} />
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
          {(hosts.data ?? []).length === 0 ? <p className="text-sm text-muted">{d.releasedKey ? "No host yet. Anyone can run one command and register." : "Hosts can register once the server is released."}</p> : (
            <ul className="grid gap-2">
              {(hosts.data ?? []).slice(0, 4).map((h) => (
                <li key={h.hostId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0"><span className="block font-medium">{shortAcct(h.hostId)}</span><span className="mono block truncate text-faint">{h.endpoint}</span></span>
                  <span className="num shrink-0 text-alive">{near(h.earned)} Ⓝ</span>
                </li>
              ))}
            </ul>
          )}
          {snap.data && <p className="mt-4 border-t border-line pt-3 text-xs text-faint">Progress snapshot #{snap.data.seq} · {Object.keys(snap.data.players).length} players · <span className="mono">{shortHash(snap.data.hash, 6)}</span></p>}
        </Card>
      </div>
      <Feed />
      <p className="text-center text-xs text-faint">Contract <a className="mono hover:text-text" href={accountUrl(CONTRACT)} target="_blank" rel="noopener">{CONTRACT}</a> · data refreshes every few seconds · <a className="hover:text-text" href="https://testnet.nearblocks.io" target="_blank" rel="noopener">testnet explorer</a></p>
    </div>
  );
}

export default function Afterlife() {
  return (
    <div className="mx-auto max-w-7xl">
      <p className="eyebrow mb-4">Licence status</p>
      <AfterlifeView />
    </div>
  );
}
