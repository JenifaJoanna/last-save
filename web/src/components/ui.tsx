// Terminal design-system primitives: keycaps, panels, chips, numbered rows, screen titles, bracketed key-fact boxes.
import { Check, Copy as CopyIcon, Loader2 } from "lucide-react";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { blip } from "../lib/sound";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "quiet"; size?: "sm" | "md" | "lg"; loading?: boolean };
const VARIANT = {
  primary: "keycap keycap-primary",
  ghost: "keycap",
  danger: "keycap !bg-dead !text-[#1a0306]",
  quiet: "label text-muted hover:text-text underline-offset-4 hover:underline",
};
const SIZE = { sm: "h-9 px-3 text-[11px]", md: "h-11 px-4 text-[12px]", lg: "h-12 px-6 text-[13px]" };

export function Button({ variant = "primary", size = "md", loading, children, className = "", disabled, onPointerDown, ...rest }: BtnProps) {
  return (
    <button {...rest} disabled={disabled || loading} onPointerDown={(e) => { if (!disabled && !loading) blip(variant === "primary" ? "go" : "key"); onPointerDown?.(e); }}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap ${VARIANT[variant]} ${variant === "quiet" ? "" : SIZE[size]} ${className}`}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary", size = "md", className = "", external }: { href: string; children: ReactNode; variant?: BtnProps["variant"]; size?: BtnProps["size"]; className?: string; external?: boolean }) {
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener" } : {})} onPointerDown={() => blip("key")}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap no-underline ${VARIANT[variant ?? "primary"]} ${variant === "quiet" ? "" : SIZE[size ?? "md"]} ${className}`}>
      {children}
    </a>
  );
}

export function StatusBadge({ status, big, released }: { status: "Alive" | "Dead"; big?: boolean; released?: boolean }) {
  const alive = status === "Alive";
  const tone = alive ? "border-alive/50 text-alive" : released ? "border-gold/60 text-gold" : "border-dead/60 text-dead";
  return (
    <span className={`label inline-flex items-center gap-2 border ${big ? "px-3 py-1.5 text-[12px]" : "px-2 py-0.5 text-[10px]"} ${tone}`}>
      <span className={`size-2 ${alive ? "blink bg-alive" : released ? "bg-gold" : "blink-fast bg-dead"}`} />
      {alive ? "Official server · online" : released ? "Studio gone · server released" : "Studio gone dark"}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ember" | "alive" | "dead" | "gold" }) {
  const color = tone === "ember" ? "text-ember" : tone === "alive" ? "text-alive" : tone === "dead" ? "text-dead" : tone === "gold" ? "text-gold" : "text-text";
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className={`num mt-1.5 truncate text-2xl ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function Copy({ text, label, className = "" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { void navigator.clipboard?.writeText(text); blip("key"); setDone(true); window.setTimeout(() => setDone(false), 1400); }}
      className={`inline-flex min-w-0 items-center gap-1.5 px-1 py-0.5 text-muted hover:bg-white/5 hover:text-text ${className}`} title="Copy">
      <span className="mono truncate">{label ?? text}</span>
      {done ? <Check className="size-3.5 shrink-0 text-alive" /> : <CopyIcon className="size-3.5 shrink-0" />}
    </button>
  );
}

export function Ext({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noopener" className={`label inline-flex items-center gap-1 text-[12px] text-gold no-underline hover:underline ${className}`}>{children}<span aria-hidden>▸</span></a>;
}

/** A terminal panel: `// EYEBROW`, an uppercase title, prints in on screen entry. */
export function Card({ children, className = "", title, action, eyebrow }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; eyebrow?: string }) {
  return (
    <section data-print className={`card p-5 sm:p-6 ${className}`}>
      {(title || action || eyebrow) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">{eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}{title && <h2 className="label text-[15px] leading-snug text-text sm:text-base">{title}</h2>}</div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Bracketed key-facts box (ember corner marks). */
export function Bracket({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div data-print className={`bracket p-4 sm:p-5 ${className}`}>{children}</div>;
}

/** Screen title: wide heavy display type over the sunset stripe bar. `sunset` cuts the bands through the letters. */
export function ScreenTitle({ children, eyebrow, sunset, sub }: { children: ReactNode; eyebrow?: string; sunset?: boolean; sub?: ReactNode }) {
  return (
    <div data-print className="mb-6">
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h1 className={`display text-[clamp(30px,5.4vw,60px)] ${sunset ? "display-sunset" : "text-text"}`}>{children}</h1>
      {!sunset && <div className="stripes mt-3 w-[min(300px,62%)]" aria-hidden />}
      {sub && <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}

/** A numbered menu / choice row. Selection is instant (no transition), like a terminal cursor. */
export function MenuRow({ n, title, sub, selected, onSelect, onOpen, right, big }: { n: string | number; title: ReactNode; sub?: ReactNode; selected: boolean; onSelect: () => void; onOpen: () => void; right?: ReactNode; big?: boolean }) {
  return (
    <button data-print onMouseEnter={onSelect} onFocus={onSelect} onClick={() => { blip("go"); onOpen(); }}
      className={`grid w-full grid-cols-[2.6rem_1fr_auto] items-center gap-3 px-3 text-left ${big ? "py-4" : "py-2.5"} ${selected ? "row-sel" : "text-text"}`}>
      <span className={`num ${big ? "text-2xl" : "text-lg"} ${selected ? "" : "text-gold"}`}>{n}</span>
      <span className="min-w-0">
        <span className={`display block truncate ${big ? "text-[clamp(18px,2.4vw,26px)]" : "text-[clamp(15px,1.8vw,20px)]"}`}>{title}</span>
        {sub && <span className={`block truncate text-[12.5px] ${selected ? "text-key-ink/75" : "text-muted"}`}>{sub}</span>}
      </span>
      {right && <span className={`num text-sm ${selected ? "" : "text-muted"}`}>{right}</span>}
    </button>
  );
}

export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`skeleton ${className}`} />;

export function Note({ tone = "muted", children }: { tone?: "muted" | "dead" | "gold"; children: ReactNode }) {
  const c = tone === "dead" ? "border-dead text-dead" : tone === "gold" ? "border-gold text-gold" : "border-cyan/70 text-muted";
  return <div className={`border-l-2 bg-white/[0.025] px-4 py-3 text-[13px] ${c}`}>{children}</div>;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" className="inline-flex border border-line-2">
      {options.map((opt, i) => (
        <button key={opt.value} role="radio" aria-checked={value === opt.value} onClick={() => { blip("select"); onChange(opt.value); }}
          className={`label px-3 py-1.5 text-[11px] ${value === opt.value ? "row-sel" : "text-muted hover:text-text"}`}><span className="num mr-1.5">{i + 1}</span>{opt.label}</button>
      ))}
    </div>
  );
}
