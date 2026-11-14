// Last Save mark, partner logos and the heartbeat line.
import { useEffect, useId, useState } from "react";

export function Mark({ className = "size-8" }: { className?: string }) {
  // Unique gradient id: a copy inside a display:none sidebar would otherwise blank every other copy.
  const id = `lsg${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd27a" /><stop offset="0.55" stopColor="#ff7a1a" /><stop offset="1" stopColor="#ff4d6d" /></linearGradient>
      </defs>
      <rect x="3" y="3" width="34" height="34" rx="9" fill="#12101d" stroke={`url(#${id})`} strokeWidth="2" />
      <path d="M11 12h13l5 5v11a1 1 0 0 1-1 1H12a1 1 0 0 1-1-1z" fill="none" stroke="#efeaff" strokeOpacity=".22" strokeWidth="1.5" />
      <path d="M8 23h7l2.5-6 4 11 3-8 2 3h5.5" fill="none" stroke={`url(#${id})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark className="size-8" />
      <span className="font-display text-[17px] font-semibold tracking-[0.06em]">LAST SAVE</span>
    </span>
  );
}

/** Partner logo from /brand (sanitised official files); falls back to a text tile if missing. */
export function PartnerLogo({ name, src, className = "h-6" }: { name: string; src: string; className?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <span className="font-display text-sm font-semibold tracking-wider text-muted">{name}</span>;
  // Single-colour SVG marks render white, brand colour on hover; multi-colour raster marks keep their colours and
  // drop their black backdrop with screen blending.
  const raster = /\.(png|jpe?g|webp)$/.test(src);
  return <img src={src} alt={name} onError={() => setOk(false)}
    className={`${className} w-auto transition ${raster ? "opacity-85 mix-blend-screen hover:opacity-100" : "opacity-75 brightness-0 invert hover:opacity-100"}`} />;
}

/** ECG trace: beats while alive, flatlines red when dead. */
export function Heartbeat({ alive, className = "" }: { alive: boolean; className?: string }) {
  const [phase, setPhase] = useState(0);
  const id = `hb${useId().replace(/:/g, "")}`;
  useEffect(() => {
    if (!alive) return;
    const t = window.setInterval(() => setPhase((p) => (p + 1) % 1000), 1400);
    return () => window.clearInterval(t);
  }, [alive]);
  const beat = "M0 40 H70 l6 -4 6 4 H96 l5 -26 7 50 6 -32 5 8 H160 l8 -6 8 6 H240";
  return (
    <svg viewBox="0 0 240 70" preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="1"><stop offset="0" stopColor="currentColor" stopOpacity="0" /><stop offset=".25" stopColor="currentColor" stopOpacity=".9" /><stop offset="1" stopColor="currentColor" /></linearGradient>
      </defs>
      {alive ? (
        <path key={phase} d={beat} fill="none" stroke={`url(#${id})`} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          style={{ strokeDasharray: 600, animation: "sweep 1.4s cubic-bezier(.4,0,.2,1) both", filter: "drop-shadow(0 0 6px currentColor)" }} />
      ) : (
        <path d="M0 40 H240" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ filter: "drop-shadow(0 0 6px currentColor)" }} />
      )}
    </svg>
  );
}
