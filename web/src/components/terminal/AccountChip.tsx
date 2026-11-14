// Header account chip: which account and which wallet are signed in, whether holder actions are gas-free, and Disconnect.
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { accountUrl } from "../../lib/near";
import { useWallet } from "../../lib/wallet";

const short = (a: string) => (/^0x[0-9a-f]{40}$/i.test(a) ? `${a.slice(0, 6)}…${a.slice(-4)}` : a.replace(/\.testnet$/, ""));

export function AccountChip() {
  const { ready, accountId, signOut, walletName, gasless, kind } = useWallet();
  const [loc, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  if (!ready) return null;
  if (!accountId) {
    if (loc === "/signin") return null;
    return (
      <button onClick={() => navigate(`/signin${loc.startsWith("/app") ? `?next=${encodeURIComponent(loc)}` : ""}`)}
        className="label h-9 shrink-0 whitespace-nowrap rounded-[5px] border border-alive/70 px-3 text-[11px] text-alive hover:bg-alive/10">Connect wallet</button>
    );
  }
  return (
    <div className="flex h-9 min-w-0 items-center rounded-[5px] border border-line-2 text-[11px]" data-account={accountId}>
      <a href={accountUrl(accountId)} target="_blank" rel="noopener" title={`${accountId}${walletName ? ` · ${walletName}` : ""}`}
        className="flex min-w-0 items-center gap-2 px-2.5 no-underline hover:bg-white/5 sm:px-3">
        <span className={`size-2 shrink-0 rounded-full ${kind === "evm" ? "bg-cyan" : "bg-alive"}`} aria-hidden />
        <span className="mono min-w-0 max-w-[22vw] truncate text-text sm:max-w-[200px]">{short(accountId)}</span>
        {walletName && <span className="label hidden whitespace-nowrap text-[10px] text-faint md:inline">{walletName}</span>}
        {gasless && <span className="label hidden whitespace-nowrap border border-alive/50 px-1 text-[9.5px] text-alive sm:inline">gas-free</span>}
      </a>
      <button onClick={async () => { setBusy(true); try { await signOut(); navigate("/signin"); } finally { setBusy(false); } }} disabled={busy}
        aria-label="Disconnect wallet" title="Disconnect"
        className="label flex h-full shrink-0 items-center gap-1.5 border-l border-line-2 px-2.5 text-faint hover:text-text disabled:opacity-50">
        <LogOut className="size-3.5" /><span className="hidden lg:inline">Disconnect</span>
      </button>
    </div>
  );
}
