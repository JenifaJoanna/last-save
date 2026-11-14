// Store: Ember Rift product page with the Forever Guarantee checks read live from chain.
import { motion } from "motion/react";
import { BadgeCheck, CircleDashed, Gamepad2, Repeat, Timer, Trophy, Users } from "lucide-react";
import { Link } from "wouter";
import { usePrimary } from "../../components/terminal/nav";
import { Button, Card, Ext, Note, ScreenTitle, Skeleton } from "../../components/ui";
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
  // Another studio's instance (for example Tidebreak) shows its own title, studio and art from the contract.
  const other = !!d && d.title !== "Ember Rift";
  const title = other && d ? d.title : "Ember Rift";

  const buy = async () => {
    if (!d) return;
    const hash = await call("buy_licence", {}, { deposit: d.price, gasTgas: 60, label: "Licence bought" });
    if (hash) { info.refresh(); mine.refresh(); }
  };
  usePrimary(d && d.escrowed && !mine.data && accountId ? { label: dead ? "Buy · fund hosts" : `Buy ${near(d.price)} Ⓝ`, run: () => void buy(), busy: pending === "buy_licence" } : null, [d?.price, dead, !!mine.data, accountId, pending]);

  return (
    <div className="mx-auto max-w-6xl">
      <ScreenTitle eyebrow={other && d ? `${d.title} · ${d.studio}` : "Ember Rift · Kiln Interactive"}>Store</ScreenTitle>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div data-print className="card overflow-hidden">
          <div className="relative aspect-video">
            <img src={other && d?.media ? d.media : "/art/ember-rift-key.jpg"} alt={other ? `${title} key art` : "Ember Rift key art: hover-skiffs racing across a burning obsidian arena"} className="absolute inset-0 size-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-transparent" />
            {!other && <a href={`${PLAY_URL}?practice=1`} target="_blank" rel="noopener" className="label absolute right-4 top-4 border border-gold/60 bg-ink/80 px-3 py-1.5 text-[11px] text-gold no-underline hover:bg-ink">Try it offline ▸</a>}
            <div className="absolute bottom-5 left-6">
              <h2 className="display text-[clamp(30px,4.4vw,54px)]">{title}</h2>
              <p className="mt-2 text-sm text-muted">{other && d ? <>by <span className="mono">{d.studio}</span> · licence contract <span className="mono">{CONTRACT}</span></> : "Kiln Interactive · arena · 2–8 players"}</p>
            </div>
          </div>
          {!other && <><div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
            {[{ i: Users, t: "Up to 8 skiffs" }, { i: Timer, t: "90-second matches" }, { i: Trophy, t: "Levels + Emberwing skin" }, { i: Repeat, t: "Progress saved on-chain" }].map(({ i: I, t }) => (
              <div key={t} className="flex items-center gap-2.5 text-sm text-muted"><I className="size-4 text-ember" />{t}</div>
            ))}
          </div>
          <p className="border-t border-line px-6 py-5 text-[15px] leading-relaxed text-muted">
            Pilot a hover-skiff across a burning obsidian arena. Grab shards, take the ember core, and ram rivals over the edge into the rift.
            Your level and the Emberwing skin are saved to the licence contract after every match, so they follow you to any server that hosts the game.
          </p></>}
          {other && <p className="border-t border-line px-6 py-5 text-[15px] leading-relaxed text-muted">A second studio launched {title} from the same Last Save factory: the same locked licence contract, the same Forever Guarantee checks below, read live from {CONTRACT}.</p>}
        </div>

        <div className="grid content-start gap-4">
          <Card>
            {!d ? <div className="grid gap-3"><Skeleton className="h-10 w-32" /><Skeleton className="h-4 w-full" /><Skeleton className="h-11 w-full" /></div> : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div><p className="eyebrow">Licence price</p><p className="num mt-1 text-4xl text-text">{near(d.price)} <span className="text-2xl text-muted">Ⓝ</span></p></div>
                  {guaranteed && <span className="label inline-flex items-center gap-1.5 border border-alive/60 px-2 py-1 text-[10px] text-alive"><BadgeCheck className="size-3.5" />Forever guarantee</span>}
                </div>
                {dead ? (
                  <div className="mt-5">
                    <div className="flex gap-1" aria-label="90% to the keep-alive pool, 10% to the gas-free budget">
                      {Array.from({ length: 10 }, (_, i) => <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05, duration: 0 }} className={`h-3 flex-1 ${i < 9 ? "bg-gold" : "bg-cyan"}`} />)}
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-muted"><span className="text-gold">90% to the keep-alive pool</span><span className="text-cyan">10% gas-free budget</span></div>
                    <p className="mt-3 text-sm text-muted">The studio has gone dark. After the mint&rsquo;s storage fee, <b className="text-text">90% of this price goes to the keep-alive pool</b> that pays community hosts for every licence holder they serve, and 10% to the budget that pays the gas for probes, the release and host claims.</p>
                  </div>
                ) : (
                  <div className="mt-5">
                    <div className="flex gap-1" aria-label={`${100 - lockedPct}% to the studio, ${lockedPct}% locked for you`}>
                      {Array.from({ length: 10 }, (_, i) => <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05, duration: 0 }} className={`h-3 flex-1 ${i < 10 - lockedPct / 10 ? "bg-white/15" : "bg-gold"}`} />)}
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
                  <>
                    <Button size="lg" className="mt-6 w-full" onClick={buy} loading={pending === "buy_licence"} disabled={!accountId || !d.escrowed}>
                      {!d.escrowed ? "Not on sale yet" : dead ? "Buy and fund the hosts" : `Buy for ${near(d.price)} Ⓝ`}
                    </Button>
                    {!d.escrowed && <p className="mt-2 text-xs text-muted">The contract sells licences only after the studio escrows the server key in the enclave (check 1 below).</p>}
                  </>
                )}
                <p className="mt-3 text-xs text-faint">Resale royalty {d.royaltyBps / 100}% to the studio (NEP-199). Testnet NEAR only.</p>
              </>
            )}
          </Card>

          <Card eyebrow="Forever Guarantee" title="Checked live, not promised">
            <ul className="grid grid-cols-1 gap-4">
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
