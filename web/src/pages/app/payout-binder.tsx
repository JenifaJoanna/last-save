// Base payout address by signature: the host connects its own Ethereum wallet (EIP-6963 picker: MetaMask, Rabby,
// Coinbase), signs one message binding that address to its NEAR host account (personal_sign), the page checks the
// signature recovers to that address, then set_payout_evm records it on the licence contract. No pasted addresses.
// The contract is locked and stores only the address; the signature check happens here, before the call.
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, ExternalLink, PenLine, Wallet } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui";
import { personalSign, payoutMessage, recoverSigner, requestAddress, useEvmWallets, type EvmWallet } from "../../lib/eip6963";
import { CONTRACT, shortHash, txUrl } from "../../lib/near";
import { useToast } from "../../lib/toast";
import { useWallet } from "../../lib/wallet";

export const SCAN = "https://sepolia.basescan.org";
type Proof = { address: string; signature: string; issuedAt: string; tx: string | null };
const slot = (host: string) => `lastsave:payoutproof:${CONTRACT}:${host}`;
const loadProof = (host: string): Proof | null => { try { return JSON.parse(localStorage.getItem(slot(host)) ?? "null"); } catch { return null; } };
const saveProof = (host: string, p: Proof) => { try { localStorage.setItem(slot(host), JSON.stringify(p)); } catch { /* storage blocked: proof shows this session only */ } };

type Step = "idle" | "pick" | "connect" | "sign" | "confirm" | "record";
const STEP_TEXT: Record<Step, string> = { idle: "", pick: "", connect: "Approve the connection in your wallet…", sign: "Sign the message in your wallet…", confirm: "", record: "Recording the address on NEAR…" };

export function PayoutBinder({ hostId, current, onDone }: { hostId: string; current: string | null; onDone: () => void }) {
  const wallets = useEvmWallets();
  const { call, gasless } = useWallet();
  const toast = useToast();
  const [step, setStep] = useState<Step>("idle");
  const [proof, setProof] = useState<Proof | null>(() => loadProof(hostId));
  const shownProof = proof && current && proof.address.toLowerCase() === current.toLowerCase() ? proof : null;

  const [pending, setPending] = useState<{ address: string; signature: string; issuedAt: string } | null>(null);
  /** set_payout_evm for a verified signature; called straight from a click when the NEAR wallet has to open. */
  const record = async (signed: { address: string; signature: string; issuedAt: string }) => {
    setStep("record");
    const tx = await call("set_payout_evm", { address: signed.address }, { gasTgas: 30, label: "Base payout address set" });
    if (!tx) { setStep("idle"); return; }
    const p = { ...signed, tx: /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(tx) ? tx : null };
    saveProof(hostId, p); setProof(p); setPending(null);
    toast.push({ kind: "ok", title: "Signed by your Ethereum wallet", body: `Payouts for ${hostId} now go to ${shortHash(p.address, 6)} on Base Sepolia.`, href: `${SCAN}/address/${p.address}`, linkText: "Open the address on Basescan" });
    setStep("idle");
    onDone();
  };

  const bind = async (w: EvmWallet) => {
    try {
      setStep("connect");
      const address = await requestAddress(w);
      setStep("sign");
      const issuedAt = new Date().toISOString();
      const message = payoutMessage(hostId, CONTRACT, address, issuedAt);
      const signature = await personalSign(w, address, message);
      if (recoverSigner(message, signature) !== address.toLowerCase()) throw new Error("The signature does not match that address.");
      const signed = { address: address.toLowerCase(), signature, issuedAt };
      // Gas-free sessions record it now (no wallet window). Otherwise the NEAR wallet must open on a FRESH tap: browsers
      // block a wallet tab opened long after the click that started this (the Ethereum signature took that time).
      if (!gasless) { setPending(signed); setStep("confirm"); return; }
      await record(signed);
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/reject|denied|cancel/i.test(msg)) toast.push({ kind: "error", title: "Payout address not set", body: msg.slice(0, 160) });
    }
    setStep("idle");
  };

  const busy = step !== "idle" && step !== "pick" && step !== "confirm";
  return (
    <div className="grid min-w-0 content-start gap-2">
      <p className="break-words text-[13px] text-muted">{current
        ? <>Your epochs pay out to <a href={`${SCAN}/address/${current}`} target="_blank" rel="noopener" className="mono text-text">{shortHash(current, 6)}<ExternalLink className="ml-1 inline size-3" /></a> on Base Sepolia.</>
        : "Your epochs pay out in NEAR. Connect the Ethereum wallet that should receive them on Base Sepolia and sign once:"}</p>
      {shownProof && (
        <p className="mono flex flex-wrap items-center gap-x-2 border-l-2 border-alive/70 bg-void/60 px-3 py-2 text-[11px] text-muted" data-payout-proof>
          <BadgeCheck className="size-3.5 text-alive" />signed by {shortHash(shownProof.address, 4)} · sig {shortHash(shownProof.signature, 5)} · verified here
          {shownProof.tx && <a href={txUrl(shownProof.tx)} target="_blank" rel="noopener" className="text-gold">NEAR tx {shortHash(shownProof.tx, 4)}</a>}
        </p>
      )}
      {step === "confirm" && pending && (
        <div className="grid gap-2 border border-line-2 bg-void/60 p-3">
          <p className="text-[13px] text-muted">Signed by {shortHash(pending.address, 6)} · verified here. Now record it on NEAR: your NEAR wallet asks you to approve <span className="mono">set_payout_evm</span>.</p>
          <Button onClick={() => void record(pending)}><Wallet className="size-4" />Record on NEAR</Button>
          <button className="text-left text-[12px] text-faint hover:text-text" onClick={() => { setPending(null); setStep("idle"); }}>Cancel</button>
        </div>
      )}
      {step === "idle" && (
        <Button variant={current ? "quiet" : "ghost"} onClick={() => setStep("pick")}><Wallet className="size-4" />{current ? "Change payout wallet" : "Connect Ethereum wallet"}</Button>
      )}
      <AnimatePresence initial={false}>
        {step === "pick" && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="grid gap-1 border border-line-2 bg-void/60 p-2" role="listbox" aria-label="Ethereum wallets in this browser">
            <p className="label px-1 text-[10px] text-faint">Ethereum wallets in this browser · EIP-6963</p>
            {wallets.length === 0 && <p className="px-1 py-2 text-[13px] text-muted">No Ethereum wallet found here. Install MetaMask, Rabby or Coinbase Wallet, then reload.</p>}
            {wallets.map((w) => (
              <button key={w.uuid} onClick={() => void bind(w)} className="flex items-center gap-3 px-2 py-2 text-left text-[14px] text-text hover:bg-white/5" role="option" aria-selected="false">
                <img src={w.icon} alt="" className="size-6" /><span className="flex-1">{w.name}</span><PenLine className="size-4 text-faint" />
              </button>
            ))}
            <button onClick={() => setStep("idle")} className="label px-2 py-1 text-left text-[10px] text-faint hover:text-text">Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>
      {busy && <p className="mono caret text-[12px] text-gold" aria-live="polite">&gt; {STEP_TEXT[step]}</p>}
      <p className="text-[11.5px] leading-relaxed text-faint">Your Ethereum wallet only signs a message: no gas, no network switch. {gasless ? "Recording it on NEAR is gas-free." : "Your NEAR wallet approves recording it."}</p>
    </div>
  );
}
