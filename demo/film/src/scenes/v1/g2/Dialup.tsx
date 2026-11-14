// The app's dial-up box (web/src/components/terminal/effects.tsx Dialup) as a frame-driven film object: types
// `$ ls-0001 open <path>` in 260 ms, prints the two "> … ok" lines at 300 / 380 ms, then a stepped receive bar
// (steps of 12.5 %) from 420 to 700 ms; done at 720 ms (≈22 f). `speed` > 1 compresses it (explorer flashes).
import { FONT, T } from "../../../ds/tokens";

export const DIALUP_FRAMES = 22;

export function DialupBox({ path, t, k = 1, speed = 1 }: { path: string; t: number; k?: number; speed?: number }) {
  const ms = (t * 1000 * speed) / 30;
  const cmd = `$ ls-0001 open ${path}`;
  const typed = cmd.slice(0, Math.floor(Math.min(1, Math.max(0, ms / 260)) * cmd.length));
  const pct = Math.max(0, Math.min(100, Math.floor(((ms - 420) / 280) * 8) * 12.5));
  const bar = "#".repeat(Math.round(pct / 10)).padEnd(10, "─");
  const line = { margin: 0, color: T.muted, whiteSpace: "pre" as const };
  return (
    <div style={{ width: 448 * k, boxSizing: "border-box", border: `1px solid ${T.line2}`, background: "rgba(25,20,46,0.8)", padding: 16 * k,
      fontFamily: FONT.mono, fontSize: 12.5 * k, lineHeight: `${24 * k}px` }}>
      <p style={{ ...line, color: T.gold }}>{typed}{ms < 260 && <span style={{ color: T.gold }}>█</span>}</p>
      <p style={{ ...line, opacity: ms > 300 ? 1 : 0 }}>&gt; resolving NEAR testnet ...... <span style={{ color: T.alive }}>ok</span></p>
      <p style={{ ...line, opacity: ms > 380 ? 1 : 0 }}>&gt; link 1200 baud ............. <span style={{ color: T.alive }}>ok</span></p>
      <p style={{ ...line, opacity: ms > 420 ? 1 : 0 }}>&gt; receiving [<span style={{ color: T.gold }}>{bar}</span>] {pct} %</p>
    </div>
  );
}

/** Full-cover dial-up as the app draws it: the screen clears to ink and the box sits centred. */
export function DialupCover({ path, t, k = 1.7, speed = 1 }: { path: string; t: number; k?: number; speed?: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, display: "grid", placeItems: "center" }}>
      <DialupBox path={path} t={t} k={k} speed={speed} />
    </div>
  );
}
