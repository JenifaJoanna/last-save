// "The promise is code": the server build is sealed, its key travels into the enclave, two locks bind it, and the
// contract is shown with no keys and no delete path. Real hashes from the run; one continuous motion.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, chakra, inter, mono, RUN, s } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;

function Box({ x, y, w, h, title, sub, glow, children, opacity = 1 }: { x: number; y: number; w: number; h: number; title: string; sub?: string; glow?: string; children?: React.ReactNode; opacity?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: 26, background: "linear-gradient(180deg,#171428,#100d1b)", border: `1.5px solid ${glow ?? C.line}`,
      boxShadow: glow ? `0 0 60px ${glow}44, inset 0 0 40px ${glow}14` : "none", padding: "26px 30px", opacity, fontFamily: inter, color: C.text }}>
      <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.4 }}>{title}</div>
      {sub && <div style={{ fontSize: 20, color: C.muted, marginTop: 6 }}>{sub}</div>}
      {children}
    </div>
  );
}

function Chip({ text, color, appear, x, y }: { text: string; color: string; appear: number; x: number; y: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `scale(${0.6 + 0.4 * appear})`, opacity: appear, fontFamily: mono, fontSize: 20, color,
      border: `1.5px solid ${color}88`, background: `${color}14`, borderRadius: 999, padding: "8px 18px", whiteSpace: "nowrap" }}>{text}</div>
  );
}

export function Escrow() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = (at: number, damping = 200) => spring({ frame: f - s(at), fps, config: { damping } });
  // key flight: from the studio box to the enclave
  const fly = interpolate(f, [s(1.6), s(3.2)], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const keyX = interpolate(fly, [0, 1], [330, 905]);
  const keyY = interpolate(fly, [0, 0.5, 1], [470, 360, 455]);
  const lock1 = sp(3.6, 16), lock2 = sp(4.3, 16), contract = sp(5.2), zero = sp(6.3, 14);
  const enclaveGlow = interpolate(f, [s(3.1), s(3.6)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <AbsoluteFill style={{ background: "radial-gradient(50% 50% at 50% 55%, rgba(42,31,122,0.35), transparent)" }} />
      <div style={{ position: "absolute", left: 120, top: 86, fontFamily: chakra, fontSize: 22, letterSpacing: 6, color: C.muted }}>THE PROMISE IS CODE</div>
      <Box x={120} y={300} w={420} h={330} title="Studio" sub="encrypts the server build" opacity={sp(0.1)}>
        <div style={{ marginTop: 34, fontFamily: mono, fontSize: 19, color: C.faint, lineHeight: 1.7 }}>artifact sha256<br /><span style={{ color: C.text }}>{short(RUN.artifact)}</span><br />build hash<br /><span style={{ color: C.text }}>{short(RUN.build)}</span></div>
      </Box>
      <Box x={760} y={250} w={520} h={430} title="OutLayer enclave" sub="Intel TDX · keystore secret" glow={enclaveGlow > 0 ? C.cyan : undefined} opacity={sp(0.4)}>
        <div style={{ position: "absolute", left: 140, top: 170, width: 240, height: 140, borderRadius: 22, border: `2px dashed ${C.cyan}66`, opacity: enclaveGlow }} />
      </Box>
      <div style={{ position: "absolute", left: keyX, top: keyY, fontSize: 64, transform: `rotate(${interpolate(fly, [0, 1], [-30, 0])}deg)`, filter: `drop-shadow(0 0 22px ${C.gold})`, opacity: f > s(1.4) ? 1 : 0 }}>
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round"><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14 9l2 2" /></svg>
      </div>
      <Chip text="only lastsave-licence.testnet may ask" color={C.alive} appear={lock1} x={780} y={700} />
      <Chip text={`only release.wasm ${short(RUN.release)}`} color={C.alive} appear={lock2} x={780} y={760} />
      <Box x={1380} y={300} w={420} h={330} title="Licence contract" sub={RUN.contract} glow={zero > 0.5 ? C.ember : undefined} opacity={contract}>
        <div style={{ marginTop: 40, display: "grid", gap: 16, fontSize: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>access keys</span><b style={{ fontFamily: chakra, fontSize: 40, color: C.ember, transform: `scale(${0.7 + 0.3 * zero})` }}>0</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", opacity: zero }}><span style={{ color: C.muted }}>delete path</span><b style={{ color: C.text }}>none</b></div>
        </div>
      </Box>
      <svg style={{ position: "absolute", inset: 0 }} width="1920" height="1080">
        <path d="M1280 465 H1375" stroke={C.ember} strokeWidth="2" strokeDasharray="6 8" opacity={contract} />
        <path d="M545 465 H755" stroke={C.gold} strokeWidth="2" strokeDasharray="6 8" opacity={sp(0.8)} />
      </svg>
    </AbsoluteFill>
  );
}
