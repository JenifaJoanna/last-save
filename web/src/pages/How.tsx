// How it works: the lifecycle diagram, the trust model and the FAQ. Public at /how, in-app at /app/how.
import { SiteFooter, SiteNav } from "../components/SiteNav";
import { Faq, Lifecycle, Trust } from "./landing-sections";

function Diagram() {
  const box = "fill-[#12101d] stroke-[rgba(255,255,255,0.14)]";
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="card overflow-x-auto p-4 sm:p-8">
        <svg viewBox="0 0 980 300" className="min-w-[760px]" role="img" aria-label="Diagram: studio escrows the server key in an OutLayer enclave owned by the licence contract; on death the enclave releases it; holders refund or pledge; fans host and are paid per signed player session.">
          <defs>
            <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="#ff7a1a" /></marker>
          </defs>
          {[
            { x: 10, y: 40, w: 170, t: "Studio", s: "encrypts the server build" },
            { x: 250, y: 40, w: 220, t: "Licence contract", s: "NEAR · no keys, no delete path" },
            { x: 540, y: 40, w: 200, t: "OutLayer enclave", s: "release.wasm, pinned by hash" },
            { x: 800, y: 40, w: 170, t: "Released key", s: "public, on-chain" },
            { x: 250, y: 190, w: 220, t: "Holders", s: "refund or pledge their share" },
            { x: 540, y: 190, w: 200, t: "Fan hosts", s: "paid per signed player session" },
            { x: 800, y: 190, w: 170, t: "Players", s: "same progress, back in" },
          ].map((b) => (
            <g key={b.t}>
              <rect x={b.x} y={b.y} width={b.w} height="70" rx="14" className={box} strokeWidth="1.2" />
              <text x={b.x + 16} y={b.y + 30} fill="#efeaff" fontSize="16" fontWeight="600" fontFamily="Inter">{b.t}</text>
              <text x={b.x + 16} y={b.y + 52} fill="#9a92b8" fontSize="12.5" fontFamily="Inter">{b.s}</text>
            </g>
          ))}
          {[
            ["M180 75 H245", "escrow K"], ["M470 75 H535", "on death"], ["M740 75 H795", "K"],
            ["M360 110 V185", "unlocks"], ["M470 225 H535", "pool"], ["M885 110 V185", "decrypt + host"], ["M740 225 H795", "serves"],
          ].map(([d, label]) => {
            const m = /M(\d+) (\d+) ([HV])(\d+)/.exec(d)!;
            const [x, y, dir, end] = [Number(m[1]), Number(m[2]), m[3], Number(m[4])];
            const lx = dir === "H" ? (x + end) / 2 : x + 8, ly = dir === "H" ? y - 8 : (y + end) / 2;
            return (
              <g key={d}>
                <path d={d} stroke="#ff7a1a" strokeWidth="1.6" fill="none" markerEnd="url(#ar)" />
                <text x={lx} y={ly} fill="#ffd27a" fontSize="11.5" fontFamily="Chakra Petch" textAnchor={dir === "H" ? "middle" : "start"}>{label}</text>
              </g>
            );
          })}
          <text x="10" y="290" fill="#6b6488" fontSize="12" fontFamily="Inter">Death = failed enclave probes spaced in time, a quorum of holders, or the studio's own end_of_service. The studio's word alone can never keep it alive.</text>
        </svg>
      </div>
    </section>
  );
}

export default function How({ inApp = false }: { inApp?: boolean }) {
  const body = (
    <>
      <div className={inApp ? "" : "mx-auto max-w-7xl px-4 pt-14 sm:px-6"}>
        <p className="eyebrow">How it works</p>
        <h1 className="mt-3 max-w-3xl text-[clamp(32px,4.6vw,56px)] font-semibold leading-[1.05] tracking-[-0.03em]">A licence that keeps working after the company stops.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">Four parts: an NFT licence, a sealed server key, liveness that players prove, and an afterlife that pays the people who keep the game running.</p>
      </div>
      <div className="mt-10"><Diagram /></div>
      <Lifecycle />
      <Trust />
      <Faq />
    </>
  );
  if (inApp) return <div className="mx-auto max-w-7xl [&_section]:px-0">{body}</div>;
  return <div className="min-h-dvh"><SiteNav />{body}<SiteFooter /></div>;
}
