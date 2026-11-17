// Wallet context: the user's own wallet through NEAR Connect (NEAR wallets, or Ethereum wallets via NEAR Connect's
// Ethereum executor), account state, contract calls with tx links. At sign-in the app generates a key and asks the
// wallet to add it as a function-call key for this licence instance's zero-deposit methods; the user approves that in
// their wallet. Holder actions then go out as NEP-366 delegates and the relayer pays gas. The capture-only test signer
// (devsigner.ts) has no UI and never runs outside a localhost capture build.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { connectWallet, connector, EVM_WALLET_ID, forgetWallet, restoredAccount, walletCall, type SignInKind } from "./connector";
import { DEV_ALLOWED, devCall, loadDev, saveDev, type DevSession } from "./devsigner";
import { gaslessCall, GASLESS_METHODS, keyUsable, loadKey, newSecret, publicKeyFromSecret, RELAYER_URL, relayerCovers, saveKey, waitForKey } from "./gasless";
import { accountUrl, txUrl } from "./near";
import { useToast } from "./toast";

/** receiver: another contract than this licence instance (e.g. the factory); never relayed gas-free. */
export interface CallOpts { deposit?: string; gasTgas?: number; label: string; receiver?: string }
export type WalletKind = "near" | "evm" | "capture";
export interface WalletState {
  ready: boolean;
  accountId: string | null;
  /** Opens NEAR Connect: "near" (default) lists every testnet wallet and asks for the gas-free key; "evm" opens Ethereum wallets. */
  signIn: (kind?: SignInKind) => void;
  signOut: () => Promise<void>;
  call: (method: string, args: Record<string, unknown>, o: CallOpts) => Promise<string | null>;
  pending: string | null;
  connecting: boolean;
  devSignIn: (s: DevSession) => void;
  isDev: boolean;
  /** True when this session's holder actions go through the relayer (the player pays no gas). */
  gasless: boolean;
  /** The wallet's display name ("Meteor Wallet", "Ethereum Wallets"), when known. */
  walletName?: string | null;
  kind?: WalletKind | null;
  /** Public half of the wallet-approved gas-free key, when this browser holds one. */
  gaslessPublicKey?: string | null;
}

export const Ctx = createContext<WalletState | null>(null);
const panicOf = (msg: string) => msg.match(/Smart contract panicked: ([^"\\]+)/)?.[1];
const LAST = "lastsave:wallet";
const loadLast = (): { id: string; name: string } | null => { try { return JSON.parse(localStorage.getItem(LAST) ?? "null"); } catch { return null; } };
const saveLast = (v: { id: string; name: string } | null) => { try { if (v) localStorage.setItem(LAST, JSON.stringify(v)); else localStorage.removeItem(LAST); } catch { /* storage blocked */ } };

export function WalletProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [walletAccount, setWalletAccount] = useState<string | null>(null);
  const [last, setLast] = useState(loadLast);
  const [dev, setDev] = useState<DevSession | null>(() => loadDev());
  const [key, setKey] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  // Gas-free only where the relayer pays for this instance. A wallet session gets a key only then (sign-in checks it);
  // the localhost capture signer has its own key, so it needs the same check or every holder action dies at the relayer.
  const [covered, setCovered] = useState(false);
  const accountId = dev?.accountId ?? walletAccount;
  const pendingKey = useRef<string | null>(null);

  // Restore a session, then follow NEAR Connect's sign-in/out events.
  useEffect(() => {
    let live = true;
    void relayerCovers().then((ok) => { if (live) setCovered(ok); }); // warmed early, so a sign-in click opens the wallet at once
    const onIn = (p: { accounts: { accountId: string }[] }) => { if (live) setWalletAccount(p.accounts[0]?.accountId ?? null); };
    const onOut = () => { forgetWallet(); if (live) { setWalletAccount(null); setKey(null); } };
    restoredAccount().then((r) => { if (live && r) { setWalletAccount(r.accountId); const v = { id: r.wallet.manifest.id, name: r.wallet.manifest.name }; saveLast(v); setLast(v); } })
      .finally(() => live && setReady(true));
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
    setConnecting(true);
    let secret: string | null = null;
    relayerCovers()
      .then((ok) => { secret = ok ? newSecret() : null; pendingKey.current = secret; return connectWallet(kind, secret ? publicKeyFromSecret(secret) : null); })
      .then(async ({ wallet, walletId, walletName, keyRequested }) => {
        const id = (await wallet.getAccounts())[0]?.accountId ?? null;
        setWalletAccount(id);
        const v = { id: walletId, name: walletName }; saveLast(v); setLast(v);
        if (!id) return;
        if (!keyRequested || !secret) {
          toast.push({ kind: "info", title: `Signed in with ${walletName}`, body: walletId === EVM_WALLET_ID
            ? `${id} is a NEAR account your Ethereum wallet controls. Each action opens your wallet to approve.`
            : "Each action opens your wallet to approve." });
          return;
        }
        if (await waitForKey(id, publicKeyFromSecret(secret))) {
          saveKey(id, secret); setKey(secret);
          toast.push({ kind: "ok", title: `Signed in with ${walletName} · gas-free`, body: "Your wallet added a key that can only call this licence's free actions. The relayer pays their gas.",
            href: `${accountUrl(id)}?tab=accesskeys`, linkText: "See the key on NearBlocks" });
        } else {
          toast.push({ kind: "info", title: `Signed in with ${walletName}`, body: "The wallet did not add the gas-free key, so each action opens your wallet and you pay the gas." });
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (/reject|cancel|closed|abort/i.test(msg)) toast.push({ kind: "info", title: "Sign-in cancelled", body: "Nothing was signed and no key was added. Pick a wallet to try again." });
        else toast.push({ kind: "error", title: "Sign-in failed", body: msg.slice(0, 160) });
      })
      .finally(() => { pendingKey.current = null; setConnecting(false); });
  }, [connecting, toast]);

  const devSignIn = useCallback((sess: DevSession) => { if (!DEV_ALLOWED) return; saveDev(sess); setDev(sess); }, []);
  // Capture/e2e hook: only exists in a localhost build made with VITE_CAPTURE_SIGNER=1. No UI reaches it.
  useEffect(() => {
    if (!DEV_ALLOWED) return;
    (window as unknown as { __lastSaveCapture?: unknown }).__lastSaveCapture = { signIn: devSignIn, signOut: () => { saveDev(null); setDev(null); } };
  }, [devSignIn]);

  const signOut = useCallback(async () => {
    if (dev) { saveDev(null); setDev(null); return; }
    if (walletAccount) saveKey(walletAccount, null);
    setKey(null);
    forgetWallet();
    try { const c = await connector(); await c.disconnect(); } catch { /* already signed out */ }
    setWalletAccount(null);
    toast.push({ kind: "info", title: "Disconnected", body: "This browser forgot its gas-free key. Your licence stays on chain." });
  }, [dev, walletAccount, toast]);

  const gaslessKey = RELAYER_URL && accountId ? (dev ? (covered ? dev.privateKey : null) : key) : null;
  const call = useCallback(async (method: string, args: Record<string, unknown>, o: CallOpts) => {
    const fail = (body: string, hash?: string | null) => { toast.push({ kind: "error", title: `${o.label} failed`, body, hash: hash ?? undefined, href: hash ? txUrl(hash) : undefined }); return null; };
    const done = (hash: string, body: string, kind: "ok" | "info" = "ok", title = o.label) => { toast.push({ kind, title, body, hash, href: txUrl(hash), linkText: "Open on NearBlocks" }); return hash; };
    if (gaslessKey && accountId && !o.receiver && GASLESS_METHODS.has(method) && (o.deposit ?? "0") === "0") {
      setPending(method);
      try {
        const r = await gaslessCall(accountId, gaslessKey, method, args, o.gasTgas ?? 100);
        if (r.failure) return fail(r.failure, r.hash);
        return done(r.hash, "Gas paid by the relayer: you paid 0 Ⓝ.", r.pending ? "info" : "ok", r.pending ? `${o.label}: submitted` : o.label);
      } catch (e) { return fail((e instanceof Error ? e.message : String(e)).slice(0, 160)); } finally { setPending(null); }
    }
    if (dev) {
      setPending(method);
      try {
        const r = await devCall(dev, method, args, o.gasTgas ?? 100, o.deposit ?? "0", o.receiver);
        if (r.failure) return fail(r.failure, r.hash);
        return done(r.hash, "Confirmed on NEAR testnet (capture signer).");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/Exceeded|timeout|TIMEOUT|PENDING/.test(msg)) { toast.push({ kind: "info", title: `${o.label}: submitted`, body: "Still running in an OutLayer enclave. The dashboard updates when it lands." }); return "pending"; }
        return fail(panicOf(msg) ?? msg.slice(0, 160));
      } finally { setPending(null); }
    }
    if (!accountId) { signIn(); return null; }
    setPending(method);
    try {
      const { hash, failed } = await walletCall(method, args, o.gasTgas ?? 100, o.deposit ?? "0", o.receiver);
      if (failed) return fail("The contract refused it. Open the transaction for the reason.", hash);
      if (hash) return done(hash, "Approved in your wallet · confirmed on NEAR testnet.");
      toast.push({ kind: "ok", title: o.label, body: "Approved in your wallet · confirmed on NEAR testnet." });
      return "sent";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return fail(panicOf(msg) ?? (/reject|cancel|closed/i.test(msg) ? "You cancelled in the wallet." : msg.slice(0, 160)));
    } finally { setPending(null); }
  }, [accountId, toast, dev, gaslessKey, signIn]);

  const kind: WalletKind | null = dev ? "capture" : walletAccount ? (last?.id === EVM_WALLET_ID ? "evm" : "near") : null;
  const walletName = dev ? "Capture signer" : walletAccount ? last?.name ?? null : null;
  const gaslessPublicKey = useMemo(() => { try { return gaslessKey ? publicKeyFromSecret(gaslessKey) : null; } catch { return null; } }, [gaslessKey]);
  const value = useMemo(() => ({ ready, accountId, signIn, signOut, call, pending, connecting, devSignIn, isDev: !!dev, gasless: !!gaslessKey, walletName, kind, gaslessPublicKey }),
    [ready, accountId, signIn, signOut, call, pending, connecting, devSignIn, dev, gaslessKey, walletName, kind, gaslessPublicKey]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}
