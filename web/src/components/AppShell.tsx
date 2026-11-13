// Product shell: grouped sidebar, one identity block bottom-left, drawer on phones.
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, ExternalLink, Gamepad2, Globe, HeartPulse, Library, LogOut, Menu, Scale, Server, Store, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useInfo, useMyLicence } from "../lib/licence";
import { accountUrl, shortAcct } from "../lib/near";
import { useWallet } from "../lib/wallet";
import { Wordmark } from "./brand";

const GROUPS = [
  { label: "Play", items: [{ href: "/app/store", label: "Store", icon: Store }, { href: "/app/library", label: "Library", icon: Library }, { href: "/app/play", label: "Play Ember Rift", icon: Gamepad2 }] },
  { label: "Afterlife", items: [{ href: "/app/afterlife", label: "Licence status", icon: HeartPulse }, { href: "/app/hosts", label: "Community hosts", icon: Server }] },
  { label: "Learn", items: [{ href: "/app/how", label: "How it works", icon: BookOpen }, { href: "/app/judges", label: "Judge guide", icon: Scale }] },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const [loc] = useLocation();
  const info = useInfo(8000);
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-2">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="eyebrow px-3 pb-2 text-[11px]">{g.label}</p>
          <ul className="grid gap-0.5">
            {g.items.map(({ href, label, icon: Icon }) => {
              const active = loc === href || (href !== "/app" && loc.startsWith(href));
              const dot = href === "/app/afterlife" && info.data ? (info.data.status === "Dead" ? "bg-dead" : "bg-alive beat") : null;
              return (
                <li key={href}>
                  <Link href={href} onClick={onNavigate}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] no-underline transition-colors ${active ? "bg-white/[0.07] text-text" : "text-muted hover:bg-white/[0.04] hover:text-text"}`}>
                    {active && <motion.span layoutId="navpill" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-ember" />}
                    <Icon className="size-[18px]" />
                    <span className="flex-1">{label}</span>
                    {dot && <span className={`size-2 rounded-full ${dot}`} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Identity() {
  const { accountId, signOut } = useWallet();
  const lic = useMyLicence(accountId);
  const [open, setOpen] = useState(false);
  if (!accountId) return null;
  const initials = shortAcct(accountId).slice(0, 2).toUpperCase();
  return (
    <div className="relative border-t border-line p-3">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/5" aria-expanded={open}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold via-ember to-dead font-display text-sm font-bold text-ink">{initials}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{accountId}</span>
          <span className="block truncate text-xs text-muted">{lic.data ? `Licence #${lic.data.tokenId}` : lic.loading ? "Checking licence…" : "No licence yet"}</span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.16 }}
            className="glass absolute bottom-[72px] left-3 right-3 z-20 overflow-hidden rounded-xl p-1 shadow-2xl">
            <a href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted no-underline hover:bg-white/5 hover:text-text"><Globe className="size-4" />Website</a>
            <a href={accountUrl(accountId)} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted no-underline hover:bg-white/5 hover:text-text"><ExternalLink className="size-4" />Account on explorer</a>
            <button onClick={() => { setOpen(false); void signOut(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-dead hover:bg-dead/10"><LogOut className="size-4" />Sign out</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, accountId } = useWallet();
  const [loc, navigate] = useLocation();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { if (ready && !accountId) navigate(`/signin?next=${encodeURIComponent(loc)}`, { replace: true }); }, [ready, accountId, loc, navigate]);
  useEffect(() => setDrawer(false), [loc]);
  const side = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5"><Link href="/app/afterlife" className="no-underline"><Wordmark /></Link></div>
      <Nav onNavigate={() => setDrawer(false)} />
      <Identity />
    </div>
  );
  return (
    <div className="min-h-dvh bg-ink lg:pl-[264px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-line bg-ink-2/80 backdrop-blur lg:block">{side}</aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ink/80 px-4 backdrop-blur lg:hidden">
        <Link href="/app/afterlife" className="no-underline"><Wordmark /></Link>
        <button onClick={() => setDrawer(true)} className="rounded-lg p-2 text-muted hover:text-text" aria-label="Open menu"><Menu className="size-5" /></button>
      </header>
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside className="fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[300px] border-r border-line bg-ink-2 lg:hidden"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 380, damping: 36 }}>
              <button onClick={() => setDrawer(false)} className="absolute right-3 top-4 rounded-lg p-2 text-muted hover:text-text" aria-label="Close menu"><X className="size-5" /></button>
              {side}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <main className="relative min-h-[calc(100dvh-56px)] px-4 py-6 sm:px-8 lg:min-h-dvh lg:py-8">{ready && accountId ? children : null}</main>
    </div>
  );
}
