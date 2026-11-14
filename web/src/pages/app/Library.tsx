// Library: the signed-in account's licence, its locked share and the on-chain progress copy.
import { motion } from "motion/react";
import { Flame, Gamepad2, HeartPulse, ShoppingBag } from "lucide-react";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { usePrimary } from "../../components/terminal/nav";
import { Button, Card, LinkButton, ScreenTitle, Skeleton, Stat, StatusBadge } from "../../components/ui";
import { useInfo, useMyLicence, useSnapshot } from "../../lib/licence";
import { ago, near, shortHash } from "../../lib/near";
import { useWallet } from "../../lib/wallet";

const CHOICE_TEXT: Record<string, string> = { Refund: "Refunded to you", Pledge: "Pledged to community hosts" };

export default function LibraryPage() {
  const { accountId } = useWallet();
  const info = useInfo(5000);
  const lic = useMyLicence(accountId);
  const snap = useSnapshot();
  const d = info.data;
  const me = accountId && snap.data ? snap.data.players[accountId] : undefined;
  const [, navigate] = useLocation();
  usePrimary(lic.data ? { label: "Play", run: () => navigate("/app/play") } : lic.loading ? null : { label: "Go to store", run: () => navigate("/app/store") }, [!!lic.data, lic.loading]);

  if (lic.loading) return <div className="mx-auto grid max-w-5xl gap-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;

  if (!lic.data) {
    return (
      <div className="mx-auto grid min-h-[70dvh] max-w-xl place-items-center text-center">
        <div>
          <span className="mx-auto grid size-16 place-items-center border border-line-2 bg-ink-2"><ShoppingBag className="size-7 text-ember" /></span>
          <h1 className="display mt-6 text-3xl">Empty library</h1>
          <p className="mt-3 text-muted">{accountId} has no Ember Rift licence yet. {d?.status === "Dead" ? "Buy one now and 90% of the price goes to the pool that pays fans to keep the game running." : "Buy one and part of the price is locked for you by contract."}</p>
          <LinkButton href="/app/store" size="lg" className="mt-8">Go to the store</LinkButton>
        </div>
      </div>
    );
  }

  const l = lic.data;
  const dead = d?.status === "Dead";
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ScreenTitle eyebrow="Your games">Library</ScreenTitle>
        {d && <StatusBadge status={d.status} released={!!d.releasedKey} />}
      </div>
      <motion.div data-print className="card relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgb(255_107_43/0.14),transparent)]" />
        <div className="relative grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="eyebrow">Licence #{l.tokenId}</p>
            <h2 className="display mt-2 text-[clamp(30px,4vw,46px)]">Ember Rift</h2>
            <p className="mt-2 text-sm text-muted">Held by {accountId}{l.mintedAt ? ` · bought ${ago(l.mintedAt)}` : ""}{l.postDeath ? " · bought after shutdown" : ""}</p>
            <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Stat label={l.choice || l.postDeath ? "Your share" : "Locked for you"} value={`${near(l.potShare)} Ⓝ`} tone="gold" sub={l.choice ? CHOICE_TEXT[l.choice] ?? l.choice : l.postDeath ? "Bought after shutdown" : dead ? "Yours to decide" : "Released only on shutdown"} />
              <Stat label="Level" value={me ? me.level : "—"} sub={me ? `${me.xp.toLocaleString()} XP` : "Play a match to start"} />
              <div className="col-span-2 sm:col-span-1"><Stat label="Skin" value={me?.skin === "emberwing" ? <span className="inline-flex items-center gap-1.5 text-gold"><Flame className="size-5" />Emberwing</span> : "Standard"} sub={me ? `${me.matches} matches · ${me.kos} KOs` : "Unlocks at level 3"} /></div>
            </div>
          </div>
          <div className="flex flex-col justify-end gap-3 md:w-56">
            <Link href="/app/play" className="no-underline"><Button size="lg" className="w-full"><Gamepad2 className="size-4" />Play</Button></Link>
            {dead && !l.choice && !l.postDeath && <Link href="/app/afterlife" className="no-underline"><Button size="lg" variant="ghost" className="w-full"><HeartPulse className="size-4" />Refund or pledge</Button></Link>}
          </div>
        </div>
      </motion.div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card eyebrow="Progress outlives the studio" title="Saved on NEAR, not on our servers">
          <p className="text-[15px] leading-relaxed text-muted">After every match the official server posts a progress snapshot to the licence contract. Any host that takes over restores it, so your level and skin come with you.</p>
          {snap.data ? <p className="mt-4 text-sm text-faint">Latest snapshot #{snap.data.seq} · {ago(snap.data.at)} · <span className="mono">{shortHash(snap.data.hash, 8)}</span></p> : <p className="mt-4 text-sm text-faint">No snapshot posted yet.</p>}
        </Card>
        <Card eyebrow="If the studio goes dark" title={!dead ? "Your share unlocks automatically" : l.choice ? "It has. Your choice is on-chain." : l.postDeath ? "It already had when you bought." : "It has. Your share is unlocked."}>
          <p className="text-[15px] leading-relaxed text-muted">{!dead ? "Nobody has to announce anything. When probes fail or holders report it down, the contract flips and you choose: refund or pledge."
            : l.choice === "Refund" ? "Your locked share was sent back to your account."
            : l.choice ? "Your share went to the keep-alive pool that pays fans to host the game for everyone."
            : l.postDeath ? "You bought after the shutdown, so 90% of your price went to the keep-alive pool and 10% to the gas-free budget."
            : "Take your locked share back as a refund, or pledge it to the pool that pays fans to host the game for everyone."}</p>
          <Link href="/app/afterlife" className="label mt-4 inline-block text-[12px] text-gold no-underline hover:underline">Open the licence status ▸</Link>
        </Card>
      </div>
    </div>
  );
}
