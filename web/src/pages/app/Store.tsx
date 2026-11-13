// Store: Ember Rift product page with the Forever Guarantee checks read live from chain.
import { motion } from "motion/react";
import { BadgeCheck, CircleDashed, Gamepad2, Repeat, Timer, Trophy, Users } from "lucide-react";
import { Link } from "wouter";
import { Button, Card, Ext, Note, Skeleton } from "../../components/ui";
import { useInfo, useLockedKeys, useMyLicence } from "../../lib/licence";
import { accountUrl, CONTRACT, near, shortHash } from "../../lib/near";
import { useWallet } from "../../lib/wallet";
import { PLAY_URL } from "../Landing";

function Check({ ok, loading, label, detail }: { ok: boolean; loading?: boolean; label: string; detail: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      {loading ? <CircleDashed className="mt-0.5 size-5 shrink-0 animate-spin text-faint" /> : ok ? <BadgeCheck className="mt-0.5 size-5 shrink-0 text-alive" /> : <CircleDashed className="mt-0.5 size-5 shrink-0 text-faint" />}
      <span className="min-w-0"><span className={`block text-[15px] ${ok ? "text-text" : "text-muted"}`}>{label}</span><span className="block truncate text-sm text-faint">{detail}</span></span>
    </li>
  );
}

export default function Store() {
  const { accountId, call, pending } = useWallet();
  const info = useInfo(5000);
  const keys = useLockedKeys();
  const mine = useMyLicence(accountId);
  const d = info.data;
  const dead = d?.status === "Dead";
  const locked = keys.data === 0;
  const guaranteed = !!d && d.escrowed && d.escrowVerified && locked;
  const lockedPct = d ? d.fundBps / 100 : 40;

  const buy = async () => {
    if (!d) return;
    const hash = await call("buy_licence", {}, { deposit: d.price, gasTgas: 60, label: "Licence bought" });
    if (hash) { info.refresh(); mine.refresh(); }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Store</p>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="card overflow-hidden">
          <div className="relative aspect-video">
            <iframe src={`${PLAY_URL}?attract=1`} title="Ember Rift gameplay" className="absolute inset-0 size-full" tabIndex={-1} loading="lazy" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-6">
              <h1 className="font-display text-[clamp(32px,4.4vw,52px)] font-bold leading-none tracking-[0.04em]">EMBER RIFT</h1>
              <p className="mt-2 text-sm text-muted">Kiln Interactive · arena · 2–8 players</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
            {[{ i: Users, t: "Up to 8 skiffs" }, { i: Timer, t: "90-second matches" }, { i: Trophy, t: "Levels + Emberwing skin" }, { i: Repeat, t: "Progress saved on-chain" }].map(({ i: I, t }) => (
              <div key={t} className="flex items-center gap-2.5 text-sm text-muted"><I className="size-4 text-ember" />{t}</div>
            ))}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            {!d ? <div className="grid gap-3"><Skeleton className="h-10 w-32" /><Skeleton className="h-4 w-full" /><Skeleton className="h-11 w-full" /></div> : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div><p className="eyebrow">Licence price</p><p className="num mt-1 text-4xl font-semibold">{near(d.price)} <span className="text-2xl text-muted">Ⓝ</span></p></div>
                  {guaranteed && <span className="inline-flex items-center gap-1.5 rounded-full border border-alive/30 bg-alive/10 px-3 py-1 text-xs font-semibold text-alive"><BadgeCheck className="size-3.5" />Forever Guarantee</span>}
                </div>
                {dead ? (
                  <p className="mt-4 text-sm text-muted">The studio has gone dark. <b className="text-text">100% of this price goes to the keep-alive pool</b> that pays community hosts for every licence holder they serve.</p>
                ) : (
                  <div className="mt-5">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
                      <motion.div className="bg-white/25" initial={{ width: 0 }} animate={{ width: `${100 - lockedPct}%` }} transition={{ duration: 0.7 }} />
                      <motion.div className="bg-gradient-to-r from-ember to-gold" initial={{ width: 0 }} animate={{ width: `${lockedPct}%` }} transition={{ duration: 0.7, delay: 0.15 }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-muted"><span>{100 - lockedPct}% to the studio</span><span className="text-gold">{lockedPct}% locked for you</span></div>
                  </div>
                )}
                {mine.data ? (
                  <div className="mt-6 grid gap-2">
                    <Note tone="gold">You own licence #{mine.data.tokenId}.</Note>
                    <Link href="/app/library" className="no-underline"><Button variant="ghost" className="w-full"><Gamepad2 className="size-4" />Go to your library</Button></Link>
                  </div>
                ) : (
                  <Button size="lg" className="mt-6 w-full" onClick={buy} loading={pending === "buy_licence"} disabled={!accountId}>
                    {dead ? "Buy and fund the hosts" : `Buy for ${near(d.price)} Ⓝ`}
                  </Button>
                )}
                <p className="mt-3 text-xs text-faint">Resale royalty {d.royaltyBps / 100}% to the studio (NEP-199). Testnet NEAR only.</p>
              </>
            )}
          </Card>

          <Card eyebrow="Forever Guarantee" title="Checked live, not promised">
            <ul className="grid gap-4">
              <Check ok={!!d?.escrowed} loading={!d} label="Server key escrowed in an OutLayer enclave" detail={d?.escrowed ? "Owned by the licence contract" : "Waiting for the studio's escrow"} />
              <Check ok={!!d?.escrowVerified} loading={!d} label="Enclave confirmed the key opens the committed build" detail={d?.buildHash ? `build ${shortHash(d.buildHash, 8)}` : "attest pending"} />
              <Check ok={locked} loading={keys.loading} label="Licence contract locked" detail={keys.data === null ? "reading access keys…" : `${keys.data} access keys on ${CONTRACT}`} />
              <Check ok={!!d?.releaseSha} loading={!d} label="Release program pinned by hash" detail={d?.releaseSha ? `sha256 ${shortHash(d.releaseSha, 8)}` : "—"} />
            </ul>
            <p className="mt-5 text-sm"><Ext href={accountUrl(CONTRACT)}>Inspect the contract</Ext></p>
          </Card>
        </div>
      </div>
      {info.missing && <div className="mt-6"><Note>The licence contract is being deployed to testnet. This page fills in as soon as it is live.</Note></div>}
    </div>
  );
}
