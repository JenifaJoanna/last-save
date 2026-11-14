// Judge guide: what to check, live facts from chain, how to reproduce, track fit.
import { BadgeCheck, CircleDashed, Factory, FileCode2, GitBranch, PlayCircle, Terminal } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Card, Copy, Ext, ScreenTitle, Skeleton } from "../components/ui";
import { FACTORY, useInfo, useInstances, useLockedKeys } from "../lib/licence";
import { accountUrl, ago, codeHash, CONTRACT } from "../lib/near";

const REPO = "https://github.com/JenifaJoanna/last-save";

function Fact({ label, value, ok }: { label: string; value: ReactNode; ok?: boolean }) {
  return (
    <li className="grid gap-1 border-b border-line py-3 last:border-0 sm:grid-cols-[220px_1fr] sm:items-center">
      <span className="flex items-center gap-2 text-sm text-muted">{ok === undefined ? null : ok ? <BadgeCheck className="size-4 text-alive" /> : <CircleDashed className="size-4 text-faint" />}{label}</span>
      <span className="min-w-0 text-sm">{value}</span>
    </li>
  );
}

function Studios() {
  const inst = useInstances();
  if (!inst.data || inst.data.length === 0) return null;
  return (
    <Card eyebrow="Global contract · studio factory" title="Any studio launches its own Last Save in one transaction">
      <p className="text-[15px] text-muted">The licence code is published once on NEAR as a global contract. <Ext href={accountUrl(FACTORY)}>{FACTORY}</Ext> creates an instance that uses that exact code hash and is born with 0 access keys, so nobody can ever change it.</p>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {inst.data.map((x, i) => (
          <motion.li key={x.accountId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-1 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4">
            <span className="num text-sm text-faint">#{i + 1}</span>
            <span className="min-w-0"><b>{x.title}</b> <span className="text-muted">by {x.studio}</span><span className="mono block truncate text-faint">{x.accountId}</span></span>
            <span className="text-sm"><span className={x.keys === 0 ? "text-alive" : "text-muted"}>{x.keys ?? "…"} access keys</span>{x.createdAt ? <span className="text-faint"> · created {ago(x.createdAt)}</span> : null}</span>
          </motion.li>
        ))}
      </ul>
    </Card>
  );
}

function Body() {
  const info = useInfo(8000);
  const keys = useLockedKeys();
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => { codeHash(CONTRACT).then(setHash).catch(() => setHash(null)); }, []);
  const d = info.data;
  const sk = <Skeleton className="h-4 w-48" />;
  return (
    <div className="grid grid-cols-1 gap-4">
      <Card eyebrow="Live facts" title="Read from NEAR testnet right now">
        <ul>
          <Fact label="Licence contract" value={<Ext href={accountUrl(CONTRACT)}>{CONTRACT}</Ext>} />
          <Fact label="Contract code hash" value={hash ? <Copy text={hash} /> : sk} />
          <Fact label="Access keys on contract" ok={keys.data === 0} value={keys.data === null ? sk : keys.data === 0 ? "0 — locked, nobody can upgrade or drain it" : `${keys.data} (not locked yet)`} />
          <Fact label="Server key escrowed" ok={!!d?.escrowed} value={d ? (d.escrowed ? "yes, OutLayer secret owned by the contract" : "not yet") : sk} />
          <Fact label="Escrow verified in enclave" ok={!!d?.escrowVerified} value={d ? (d.escrowVerified ? "yes, the key decrypts the committed build" : "not yet") : sk} />
          <Fact label="release.wasm sha256" value={d?.releaseSha ? <Copy text={d.releaseSha} /> : sk} />
          <Fact label="probe.wasm sha256" value={d?.probeSha ? <Copy text={d.probeSha} /> : sk} />
          <Fact label="Encrypted artifact sha256" value={d?.artifactSha ? <Copy text={d.artifactSha} /> : sk} />
          <Fact label="Status" value={d ? `${d.status}${d.cause ? ` (${d.cause})` : ""}` : sk} />
        </ul>
      </Card>
      <Studios />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card eyebrow="Reproduce it" title="Run the whole lifecycle yourself">
          <ol className="grid gap-3 text-[15px] text-muted">
            <li className="flex gap-3"><Terminal className="mt-0.5 size-4 shrink-0 text-ember" /><span><code className="mono text-text">pnpm demo:fresh</code> deploys a fresh licence instance with seconds-scale timers, runs buy → probes → death → release → refund/pledge → host → claim against a local server, and prints every transaction.</span></li>
            <li className="flex gap-3"><FileCode2 className="mt-0.5 size-4 shrink-0 text-ember" /><span>Rebuild <code className="mono text-text">release.wasm</code> and compare its sha256 with the one above; the escrow rule only admits that exact build.</span></li>
            <li className="flex gap-3"><PlayCircle className="mt-0.5 size-4 shrink-0 text-ember" /><span>Every proof run is in <Ext href={`${REPO}/tree/main/proof`}>proof/</Ext>, starting with the escrow spike.</span></li>
          </ol>
        </Card>
        <Card eyebrow="Tracks" title="NFTs That Do Something · Games With Real Economies">
          <ul className="grid gap-3 text-[15px] text-muted">
            <li><b className="text-text">The NFT does something:</b> it is the key to the game, the claim on a locked refund, a vote on whether the studio is gone, and the identity that hosts are paid for serving.</li>
            <li><b className="text-text">A real economy:</b> sale splits, a refund pot, a keep-alive pool funded by pledges and post-shutdown sales, per-session host payouts, NEP-199 resale royalties.</li>
            <li><b className="text-text">NEAR features used:</b> NEP-171/177/178/181/199 tokens, NEP-297 events, NEP-413 signed logins, yield/resume through OutLayer, contract-owned TEE secrets, Chain Signatures (host payouts on Base Sepolia), global contracts (one-tx studio factory), NEP-366 meta-transactions (gas-free holder actions).</li>
          </ul>
          <p className="mt-4"><Ext href={REPO}><GitBranch className="size-4" />Source code (MIT)</Ext></p>
        </Card>
      </div>
    </div>
  );
}

export default function Judges() {
  return (
    <div className="mx-auto max-w-6xl">
      <ScreenTitle eyebrow="Judge guide" sub="Nothing here asks you to trust our words: each line links to chain state, a hash you can rebuild, or a proof file.">Verify every claim</ScreenTitle>
      <Body />
    </div>
  );
}
