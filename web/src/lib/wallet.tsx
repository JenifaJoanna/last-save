// Wallet context: wallet-selector (Meteor, MyNearWallet), account state, contract calls with tx links.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CONTRACT, txUrl } from "./near";
import { useToast } from "./toast";

type Selector = Awaited<ReturnType<typeof import("@near-wallet-selector/core").setupWalletSelector>>;
type Modal = ReturnType<typeof import("@near-wallet-selector/modal-ui").setupModal>;

export interface CallOpts { deposit?: string; gasTgas?: number; label: string }
interface WalletState {
  ready: boolean;
  accountId: string | null;
  signIn: () => void;
  signOut: () => Promise<void>;
  call: (method: string, args: Record<string, unknown>, o: CallOpts) => Promise<string | null>;
  pending: string | null;
}

const Ctx = createContext<WalletState | null>(null);

async function load(): Promise<{ selector: Selector; modal: Modal; fc: typeof import("@near-wallet-selector/core").actionCreators }> {
  const [{ Buffer }, core, modalUi, meteor, mnw] = await Promise.all([
    import("buffer"), import("@near-wallet-selector/core"), import("@near-wallet-selector/modal-ui"),
    import("@near-wallet-selector/meteor-wallet"), import("@near-wallet-selector/my-near-wallet"),
  ]);
  await import("@near-wallet-selector/modal-ui/styles.css");
  (globalThis as unknown as { Buffer: unknown }).Buffer ??= Buffer;
  const selector = await core.setupWalletSelector({ network: "testnet", modules: [meteor.setupMeteorWallet(), mnw.setupMyNearWallet()] });
  const modal = modalUi.setupModal(selector, { contractId: CONTRACT, description: "Sign in to buy, play and decide what happens to your licence." });
  return { selector, modal, fc: core.actionCreators };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const ref = useRef<Awaited<ReturnType<typeof load>> | null>(null);
  const [ready, setReady] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    load().then((w) => {
      ref.current = w;
      const sync = () => setAccountId(w.selector.store.getState().accounts.find((a) => a.active)?.accountId ?? null);
      sync();
      unsub = w.selector.store.observable.subscribe(sync).unsubscribe;
      setReady(true);
    }).catch(() => setReady(true));
    const q = new URLSearchParams(location.search);
    const hashes = q.get("transactionHashes");
    if (hashes) {
      toast.push({ kind: "ok", title: "Transaction sent", body: "Your wallet returned a confirmed transaction.", href: txUrl(hashes.split(",").pop() ?? "") });
      history.replaceState(null, "", location.pathname);
    } else if (q.get("errorCode")) {
      toast.push({ kind: "error", title: "Not signed", body: "The wallet did not sign the transaction." });
      history.replaceState(null, "", location.pathname);
    }
    return () => unsub?.();
  }, [toast]);

  const signIn = useCallback(() => ref.current?.modal.show(), []);
  const signOut = useCallback(async () => {
    const w = ref.current;
    if (!w) return;
    try { await (await w.selector.wallet()).signOut(); } catch { /* already signed out */ }
  }, []);

  const call = useCallback(async (method: string, args: Record<string, unknown>, o: CallOpts) => {
    const w = ref.current;
    if (!w || !accountId) { ref.current?.modal.show(); return null; }
    setPending(method);
    try {
      const wallet = await w.selector.wallet();
      const outcome = await wallet.signAndSendTransaction({
        receiverId: CONTRACT,
        actions: [w.fc.functionCall(method, args, BigInt(o.gasTgas ?? 100) * 10n ** 12n, BigInt(o.deposit ?? "0"))],
      });
      const hash = (outcome as { transaction?: { hash?: string } } | undefined)?.transaction?.hash ?? null;
      const failure = JSON.stringify((outcome as { status?: unknown } | undefined)?.status ?? "").includes("Failure");
      if (failure) {
        toast.push({ kind: "error", title: `${o.label} failed`, body: "The contract refused it. Open the transaction for the reason.", href: hash ? txUrl(hash) : undefined });
        return null;
      }
      toast.push({ kind: "ok", title: o.label, body: "Confirmed on NEAR testnet.", href: hash ? txUrl(hash) : undefined });
      return hash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const smash = msg.match(/Smart contract panicked: ([^"\\]+)/)?.[1];
      toast.push({ kind: "error", title: `${o.label} failed`, body: smash ?? (/reject|cancel|closed/i.test(msg) ? "You cancelled in the wallet." : msg.slice(0, 160)) });
      return null;
    } finally { setPending(null); }
  }, [accountId, toast]);

  const value = useMemo(() => ({ ready, accountId, signIn, signOut, call, pending }), [ready, accountId, signIn, signOut, call, pending]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}
