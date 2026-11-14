// Wallet context: NEAR Connect (NEAR and Ethereum wallets), the localhost test signer, account state, contract calls
// with tx links. At sign-in the app generates a key and asks the wallet to add it as a function-call key for this
// licence instance's zero-deposit methods; holder actions then go out as NEP-366 delegates and the relayer pays gas.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { connectWallet, connector, restoredAccount, walletCall, type SignInKind } from "./connector";
import { devCall, loadDev, saveDev, type DevSession } from "./devsigner";
import { gaslessCall, GASLESS_METHODS, keyUsable, loadKey, newSecret, publicKeyFromSecret, RELAYER_URL, saveKey, waitForKey } from "./gasless";
import { txUrl } from "./near";
import { useToast } from "./toast";

export interface CallOpts { deposit?: string; gasTgas?: number; label: string }
export interface WalletState {
  ready: boolean;
  accountId: string | null;
  /** Opens NEAR Connect: "near" (default) also adds the gas-free key; "evm" opens Ethereum wallets. */
  signIn: (kind?: SignInKind) => void;
  signOut: () => Promise<void>;
  call: (method: string, args: Record<string, unknown>, o: CallOpts) => Promise<string | null>;
  pending: string | null;
  connecting: boolean;
  devSignIn: (s: DevSession) => void;
  isDev: boolean;
  /** True when this session's holder actions go through the relayer (the player pays no gas). */
  gasless: boolean;
}

export const Ctx = createContext<WalletState | null>(null);
const panicOf = (msg: string) => msg.match(/Smart contract panicked: ([^"\\]+)/)?.[1];

export function WalletProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [walletAccount, setWalletAccount] = useState<string | null>(null);
  const [dev, setDev] = useState<DevSession | null>(() => loadDev());
  const [key, setKey] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const accountId = dev?.accountId ?? walletAccount;
  const pendingKey = useRef<string | null>(null);

  // Restore a session, then follow NEAR Connect's sign-in/out events.
  useEffect(() => {
    let live = true;
    const onIn = (p: { accounts: { accountId: string }[] }) => { if (live) setWalletAccount(p.accounts[0]?.accountId ?? null); };
    const onOut = () => { if (live) { setWalletAccount(null); setKey(null); } };
    restoredAccount().then((r) => { if (live && r) setWalletAccount(r.accountId); }).finally(() => live && setReady(true));
    connector().then((c) => { c.on("wallet:signIn", onIn); c.on("wallet:signOut", onOut); }).catch(() => setReady(true));
    return () => { live = false; connector().then((c) => { c.off("wallet:signIn", onIn); c.off("wallet:signOut", onOut); }).catch(() => {}); };
  }, []);

  // The gas-free key for this account: one this browser holds and the chain still accepts.
  useEffect(() => {
    if (!walletAccount) { setKey(null); return; }
    const k = loadKey(walletAccount);
    if (!k) { setKey(null); return; }
    let live = true;
    keyUsable(walletAccount, publicKeyFromSecret(k)).then((ok) => { if (!live) return; if (!ok) saveKey(walletAccount, null); setKey(ok ? k : null); });
    return () => { live = false; };
  }, [walletAccount]);

  const signIn = useCallback((kind: SignInKind = "near") => {
    if (connecting) return;
    const secret = kind === "near" && RELAYER_URL ? newSecret() : null;
    pendingKey.current = secret;
    setConnecting(true);
    connectWallet(kind, secret ? publicKeyFromSecret(secret) : null)
      .then(async (w) => {
        const id = (await w.getAccounts())[0]?.accountId ?? null;
        setWalletAccount(id);
        if (!id || !secret) return;
        if (await waitForKey(id, publicKeyFromSecret(secret))) {
          saveKey(id, secret); setKey(secret);
          toast.push({ kind: "ok", title: "Signed in, gas-free", body: "Your wallet added a key that can only call this licence's free actions. The relayer pays their gas." });
        } else {
          toast.push({ kind: "info", title: "Signed in", body: "This wallet did not add the gas-free key, so each action opens your wallet and you pay the gas." });
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/reject|cancel|closed|abort/i.test(msg)) toast.push({ kind: "error", title: "Sign-in failed", body: msg.slice(0, 160) });
      })
      .finally(() => { pendingKey.current = null; setConnecting(false); });
  }, [connecting, toast]);

  const devSignIn = useCallback((sess: DevSession) => { saveDev(sess); setDev(sess); }, []);
  const signOut = useCallback(async () => {
    if (dev) { saveDev(null); setDev(null); return; }
    if (walletAccount) saveKey(walletAccount, null);
    setKey(null);
    try { const c = await connector(); await c.disconnect(); } catch { /* already signed out */ }
    setWalletAccount(null);
  }, [dev, walletAccount]);

  const gaslessKey = RELAYER_URL && accountId ? (dev?.privateKey ?? key) : null;
  const call = useCallback(async (method: string, args: Record<string, unknown>, o: CallOpts) => {
    const fail = (body: string, hash?: string | null) => { toast.push({ kind: "error", title: `${o.label} failed`, body, href: hash ? txUrl(hash) : undefined }); return null; };
    if (gaslessKey && accountId && GASLESS_METHODS.has(method) && (o.deposit ?? "0") === "0") {
      setPending(method);
      try {
        const r = await gaslessCall(accountId, gaslessKey, method, args, o.gasTgas ?? 100);
        if (r.failure) return fail(r.failure, r.hash);
        toast.push({ kind: r.pending ? "info" : "ok", title: r.pending ? `${o.label}: submitted` : o.label, body: "Gas paid by the relayer: you paid 0 Ⓝ.", href: txUrl(r.hash) });
        return r.hash;
      } catch (e) { return fail((e instanceof Error ? e.message : String(e)).slice(0, 160)); } finally { setPending(null); }
    }
    if (dev) {
      setPending(method);
      try {
        const r = await devCall(dev, method, args, o.gasTgas ?? 100, o.deposit ?? "0");
        if (r.failure) return fail(r.failure, r.hash);
        toast.push({ kind: "ok", title: o.label, body: "Confirmed on NEAR testnet.", href: txUrl(r.hash) });
        return r.hash;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/Exceeded|timeout|TIMEOUT|PENDING/.test(msg)) { toast.push({ kind: "info", title: `${o.label}: submitted`, body: "Still running in an OutLayer enclave. The dashboard updates when it lands." }); return "pending"; }
        return fail(panicOf(msg) ?? msg.slice(0, 160));
      } finally { setPending(null); }
    }
    if (!accountId) { signIn(); return null; }
    setPending(method);
    try {
      const { hash, failed } = await walletCall(method, args, o.gasTgas ?? 100, o.deposit ?? "0");
      if (failed) return fail("The contract refused it. Open the transaction for the reason.", hash);
      toast.push({ kind: "ok", title: o.label, body: "Confirmed on NEAR testnet.", href: hash ? txUrl(hash) : undefined });
      return hash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return fail(panicOf(msg) ?? (/reject|cancel|closed/i.test(msg) ? "You cancelled in the wallet." : msg.slice(0, 160)));
    } finally { setPending(null); }
  }, [accountId, toast, dev, gaslessKey, signIn]);

  const value = useMemo(() => ({ ready, accountId, signIn, signOut, call, pending, connecting, devSignIn, isDev: !!dev, gasless: !!gaslessKey }),
    [ready, accountId, signIn, signOut, call, pending, connecting, devSignIn, dev, gaslessKey]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}
