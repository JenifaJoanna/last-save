// Small design-system primitives in the product's own tokens.
import { Check, Copy as CopyIcon, ExternalLink, Loader2 } from "lucide-react";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "quiet"; size?: "sm" | "md" | "lg"; loading?: boolean };
const VARIANT = {
  primary: "bg-ember text-ink hover:bg-ember-2 shadow-[0_8px_30px_-8px_rgb(255_122_26/0.6)]",
  ghost: "border border-line-2 text-text hover:bg-white/5",
  danger: "bg-dead/90 text-ink hover:bg-dead",
  quiet: "text-muted hover:text-text hover:bg-white/5",
};
const SIZE = { sm: "h-9 px-3 text-sm rounded-lg", md: "h-11 px-4 text-[15px] rounded-xl", lg: "h-13 px-6 text-base rounded-xl" };

export function Button({ variant = "primary", size = "md", loading, children, className = "", disabled, ...rest }: BtnProps) {
  return (
    <button {...rest} disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[transform,background-color,box-shadow,color] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary", size = "md", className = "", external }: { href: string; children: ReactNode; variant?: BtnProps["variant"]; size?: BtnProps["size"]; className?: string; external?: boolean }) {
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener" } : {})}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold no-underline transition-[transform,background-color] duration-150 active:scale-[0.97] ${VARIANT[variant ?? "primary"]} ${SIZE[size ?? "md"]} ${className}`}>
      {children}
    </a>
  );
}

export function StatusBadge({ status, big }: { status: "Alive" | "Dead"; big?: boolean }) {
  const alive = status === "Alive";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border font-display font-semibold uppercase tracking-[0.14em] ${big ? "px-4 py-1.5 text-sm" : "px-2.5 py-1 text-[11px]"} ${alive ? "border-alive/30 bg-alive/10 text-alive" : "border-dead/40 bg-dead/10 text-dead"}`}>
      <span className={`size-2 rounded-full ${alive ? "beat bg-alive shadow-[0_0_10px] shadow-alive" : "bg-dead"}`} />
      {alive ? "Official server alive" : "Studio gone dark"}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ember" | "alive" | "dead" | "gold" }) {
  const color = tone === "ember" ? "text-ember" : tone === "alive" ? "text-alive" : tone === "dead" ? "text-dead" : tone === "gold" ? "text-gold" : "text-text";
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className={`num mt-1.5 truncate text-2xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function Copy({ text, label, className = "" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { void navigator.clipboard?.writeText(text); setDone(true); window.setTimeout(() => setDone(false), 1400); }}
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-muted transition-colors hover:bg-white/5 hover:text-text ${className}`} title="Copy">
      <span className="mono truncate">{label ?? text}</span>
      {done ? <Check className="size-3.5 shrink-0 text-alive" /> : <CopyIcon className="size-3.5 shrink-0" />}
    </button>
  );
}

export function Ext({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noopener" className={`inline-flex items-center gap-1 text-ember hover:underline ${className}`}>{children}<ExternalLink className="size-3.5" /></a>;
}

export function Card({ children, className = "", title, action, eyebrow }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; eyebrow?: string }) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>{eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}{title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}</div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`skeleton ${className}`} />;

export function Note({ tone = "muted", children }: { tone?: "muted" | "dead" | "gold"; children: ReactNode }) {
  const c = tone === "dead" ? "border-dead/30 bg-dead/5 text-dead" : tone === "gold" ? "border-gold/30 bg-gold/5 text-gold" : "border-line bg-white/[0.02] text-muted";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${c}`}>{children}</div>;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" className="inline-flex rounded-xl border border-line bg-white/[0.02] p-1">
      {options.map((opt) => (
        <button key={opt.value} role="radio" aria-checked={value === opt.value} onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${value === opt.value ? "bg-white/10 text-text" : "text-muted hover:text-text"}`}>{opt.label}</button>
      ))}
    </div>
  );
}
