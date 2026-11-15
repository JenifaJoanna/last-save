// Chain Signatures payouts: the licence contract's own Base Sepolia address, signed by NEAR's MPC network.
import { motion } from "motion/react";
import { ArrowRightLeft, ExternalLink, Fingerprint, Radio, Send, Zap } from "lucide-react";
import { useState } from "react";
import { Button, Card, Copy } from "../../components/ui";
import type { EvmPayout, HostView } from "../../lib/licence";
import { useEvm } from "../../lib/licence";
import { near, shortHash } from "../../lib/near";
import { useWallet } from "../../lib/wallet";
import { PREVIEW } from "../../preview/store";
import { PayoutBinder, SCAN } from "./payout-binder";
import { sfx } from "../../preview/sound";
import { useToast } from "../../lib/toast";

const RPCS = ["https://sepolia.base.org", "https://base-sepolia-rpc.publicnode.com"];
export const eth = (wei: string, dp = 6) => { const v = Number(BigInt(wei || "0")) / 1e18; return v.toFixed(dp).replace(/\.?0+$/, "") || "0"; };
const STATUS: Record<string, { label: string; c: string }> = {
  Owed: { label: "Booked", c: "border-gold/40 bg-gold/10 text-gold" },
  Signing: { label: "MPC signing…", c: "border-ember/40 bg-ember/10 text-ember" },
  Signed: { label: "Signed by MPC", c: "border-cyan/40 bg-cyan/10 text-cyan" },
};

async function relayRaw(raw: string): Promise<string> {
  let last = "";
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [raw] }) });
      const j = await r.json();
      if (j.result) return j.result as string;
      last = j.error?.message ?? "rejected";
      if (/already known|nonce too low/i.test(last)) return "landed";
    } catch (e) { last = e instanceof Error ? e.message : String(e); }
  }
  throw new Error(last);
}

/** The signed transfer as a transmission readout: each field prints in like a received line. */
function Transmission({ p }: { p: EvmPayout }) {
  const lines: [string, string][] = [
    ["type", "0x02 · EIP-1559 · chainId 84532 (Base Sepolia)"],
    ["nonce", String(p.nonce ?? "—")],
    ["to", p.to],
    ["value", `${eth(p.valueWei)} ETH`],
    ["signed by", "NEAR MPC network for the licence contract"],
    ["tx", p.txHash ?? "—"],
  ];
  return (
    <div className="mono mt-3 border-l-2 border-gold/70 bg-void/60 px-3 py-2 text-[11.5px] leading-5">
      <p className="label text-[10px] text-gold">// Signed transmission received</p>
      {lines.map(([k, v], i) => <p key={k} className="step-in flex gap-2" style={{ animationDelay: `${i * 70}ms` }}><span className="w-[11ch] shrink-0 text-faint">&gt; {k}</span><span className="min-w-0 break-all text-text">{v}</span></p>)}
      {p.txHash && !PREVIEW && <a href={`${SCAN}/tx/${p.txHash}`} target="_blank" rel="noopener" className="label mt-1 inline-flex items-center gap-1 text-[10px] text-gold hover:underline">Open on Basescan<ExternalLink className="size-3" /></a>}
    </div>
  );
}

function Row({ p, onAct }: { p: EvmPayout; onAct: () => void }) {
  const { call, pending } = useWallet();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const st = STATUS[p.status] ?? STATUS.Owed;
  const relay = async () => {
    if (!p.signedTx) return;
    setSending(true);
    try {
      if (PREVIEW) { sfx("scan"); await new Promise((r) => setTimeout(r, 1600)); sfx("confirm"); toast.push({ kind: "ok", title: "Relayed to Base Sepolia", body: "Anyone can broadcast the stored signed transaction. (Preview: nothing was sent.)" }); }
      else { const h = await relayRaw(p.signedTx); toast.push({ kind: "ok", title: "Relayed to Base Sepolia", body: h === "landed" ? "Already on Base Sepolia." : `Broadcast to ${shortHash(p.to, 4)}. It lands in a few seconds.`, hash: p.txHash ?? undefined, href: p.txHash ? `${SCAN}/tx/${p.txHash}` : undefined, linkText: "Open on Basescan" }); }
      onAct();
    } catch (e) { toast.push({ kind: "error", title: "Relay failed", body: (e instanceof Error ? e.message : String(e)).slice(0, 140) }); }
    finally { setSending(false); }
  };
  return (
    <li className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-[15px]"><b className="label text-[13px]">Epoch {p.epoch}</b><span className="text-muted">{p.verified} verified sessions</span>
          <span className={`label border px-1.5 py-0.5 text-[10px] ${st.c}`}>{p.relayed ? "On Base Sepolia" : st.label}</span></p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted"><span className="num text-text">{eth(p.valueWei)} ETH</span><ArrowRightLeft className="size-3.5" />{PREVIEW ? <span className="mono">{shortHash(p.to, 6)}</span> : <a href={`${SCAN}/address/${p.to}`} target="_blank" rel="noopener" className="mono text-muted hover:text-text">{shortHash(p.to, 6)}</a>}
          {p.nonce !== null && <span className="text-faint">· nonce {p.nonce}</span>}<span className="text-faint">· {near(p.nearDebited)} Ⓝ moved to EVM-settled</span></p>
        {p.status === "Signed" && <Transmission p={p} />}
      </div>
      <div className="flex gap-2">
        {p.status === "Owed" && <Button size="sm" onClick={async () => { if (await call("sign_evm_payout", { id: p.id }, { gasTgas: 300, label: "Signed by NEAR's MPC network" })) onAct(); }} loading={pending === "sign_evm_payout"}><Fingerprint className="size-4" />Sign</Button>}
        {p.status === "Signed" && !p.relayed && <Button size="sm" onClick={relay} loading={sending}><Send className="size-4" />Relay</Button>}
        {p.status === "Signed" && <Button size="sm" variant="quiet" onClick={async () => { if (await call("bump_evm_payout", { id: p.id }, { gasTgas: 300, label: "Re-signed with a higher fee" })) onAct(); }} loading={pending === "bump_evm_payout"} title="Same nonce, same amount, higher fee"><Zap className="size-4" />Bump fee</Button>}
      </div>
    </li>
  );
}

export function EvmPayouts({ mine }: { mine: HostView | undefined }) {
  const evm = useEvm(5000);
  if (!evm.data) return null;
  const { info, payouts } = evm.data;
  const minePayouts = mine?.payoutEvm ? payouts.filter((p) => p.to.toLowerCase() === mine.payoutEvm?.toLowerCase()) : [];
  return (
    <Card className="mt-4 !p-0" title={<span className="flex items-center gap-2 px-5 pt-5"><Radio className="size-5 text-cyan" />Get paid on Base Sepolia</span>}>
      <div className="grid grid-cols-1 gap-4 px-5 pb-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0 text-[15px] leading-relaxed text-muted">
          <p>The licence contract controls one Base Sepolia address through NEAR Chain Signatures. NEAR's MPC network signs for the contract; no person or server holds the key. Each payout lands in the address the host bound with its own Ethereum wallet.</p>
          <div className="bracket mt-3 p-3">
            <p className="eyebrow text-[10px]">Contract's Base address</p>
            <Copy text={info.address} className="mt-1 !px-0" />
            <p className="mt-1 text-xs text-faint">derived from <span className="mono">{info.contract}</span> + path <span className="mono">{info.path}</span> on <span className="mono">{info.mpc}</span> · chain {info.chainId}
              {!PREVIEW && <> · <a href={`${SCAN}/address/${info.address}`} target="_blank" rel="noopener" className="text-gold">Basescan<ExternalLink className="ml-0.5 inline size-3" /></a></>}</p>
          </div>
        </div>
        {mine && (
          <motion.div layout className="min-w-0">
            <PayoutBinder hostId={mine.hostId} current={mine.payoutEvm ?? null} onDone={evm.refresh} />
            {mine.payoutEvm && <p className="mt-2 text-[12px] text-faint">{minePayouts.length ? `${minePayouts.length} payout${minePayouts.length === 1 ? "" : "s"} to this address below.` : "No epoch has paid this address yet: payouts appear below once an epoch with verified sessions is claimed and signed."}</p>}
          </motion.div>
        )}
      </div>
      {payouts.length > 0 && <ul className="divide-y divide-line border-t border-line">{payouts.map((p) => <Row key={p.id} p={p} onAct={evm.refresh} />)}</ul>}
      <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-faint">Demo rate: {eth(info.weiPerSession, 8)} ETH per verified session. The NEAR it replaces moves into the contract's EVM-settled bucket, which no method can withdraw. On mainnet this would settle through NEAR Intents. Anyone can sign, relay or re-sign a stuck payout; a re-sign keeps the same nonce, so only one transfer can land.</p>
    </Card>
  );
}
