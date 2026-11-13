// Public site header + footer (never shown inside /app).
import { Link } from "wouter";
import { CONTRACT, accountUrl } from "../lib/near";
import { useWallet } from "../lib/wallet";
import { PartnerLogo, Wordmark } from "./brand";
import { LinkButton } from "./ui";

export function SiteNav() {
  const { accountId } = useWallet();
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="no-underline"><Wordmark /></Link>
        <nav className="hidden items-center gap-1 text-[15px] text-muted md:flex">
          <Link href="/how" className="rounded-lg px-3 py-2 no-underline hover:text-text">How it works</Link>
          <Link href="/status" className="rounded-lg px-3 py-2 no-underline hover:text-text">Live status</Link>
          <Link href="/judges" className="rounded-lg px-3 py-2 no-underline hover:text-text">Judge guide</Link>
          <a href="https://github.com/JenifaJoanna/last-save" target="_blank" rel="noopener" className="rounded-lg px-3 py-2 no-underline hover:text-text">Code</a>
        </nav>
        {accountId ? <LinkButton href="/app/library" size="sm">Open Last Save</LinkButton> : <LinkButton href="/signin" size="sm">Sign in</LinkButton>}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-sm text-sm text-muted">A game licence that outlives its publisher. Built on NEAR. Testnet only: no real money moves.</p>
          <div className="mt-5 flex items-center gap-5">
            <PartnerLogo name="NEAR" src="/brand/near-logo.svg" className="h-5" />
            <PartnerLogo name="OutLayer" src="/brand/outlayer-logo.png" className="h-5" />
          </div>
        </div>
        <div className="grid content-start gap-2 text-sm">
          <p className="eyebrow mb-1">Product</p>
          <Link href="/how" className="text-muted no-underline hover:text-text">How it works</Link>
          <Link href="/status" className="text-muted no-underline hover:text-text">Live licence status</Link>
          <Link href="/signin" className="text-muted no-underline hover:text-text">Sign in</Link>
        </div>
        <div className="grid content-start gap-2 text-sm">
          <p className="eyebrow mb-1">Verify</p>
          <a href={accountUrl(CONTRACT)} target="_blank" rel="noopener" className="text-muted no-underline hover:text-text">Licence contract</a>
          <Link href="/judges" className="text-muted no-underline hover:text-text">Judge guide</Link>
          <a href="https://github.com/JenifaJoanna/last-save" target="_blank" rel="noopener" className="text-muted no-underline hover:text-text">Source (MIT)</a>
        </div>
      </div>
    </footer>
  );
}
