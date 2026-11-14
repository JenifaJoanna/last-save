// Preview wallet: the signed-in persona comes from the preview store; calls are simulated, never sent.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Ctx, type CallOpts } from "../lib/wallet";
import { useToast } from "../lib/toast";
import { account, act, setPersona, subscribe } from "./store";

export function PreviewWalletProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [accountId, setAccount] = useState<string | null>(account());
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => subscribe(() => setAccount(account())), []);

  const call = useCallback(async (method: string, args: Record<string, unknown>, o: CallOpts) => {
    setPending(method);
    try {
      const r = await act(method, args, o.label);
      toast.push({ kind: r.ok ? "ok" : "error", title: r.title, body: `${r.body} (Preview: nothing was sent.)` });
      return r.ok ? "preview" : null;
    } finally { setPending(null); }
  }, [toast]);

  const value = useMemo(() => ({
    ready: true, accountId, pending, call, isDev: false, gasless: true, connecting: false,
    signIn: () => setPersona("mira"),
    signOut: async () => setPersona("guest"),
    devSignIn: () => setPersona("mira"),
  }), [accountId, pending, call]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
