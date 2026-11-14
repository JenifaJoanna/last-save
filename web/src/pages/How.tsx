// How it works: the lifecycle diagram, the trust model and the FAQ. Public at /how, in-app at /app/how.
import { ScreenTitle } from "../components/ui";
import { Faq, Lifecycle, Trust } from "./landing-sections";

function Diagram() {
  const box = "fill-[#19142e] stroke-[rgba(196,182,255,0.24)]";
  return (
    <section>
      <div data-print className="card overflow-x-auto p-4 sm:p-8">
        <svg viewBox="0 0 980 300" className="min-w-[760px]" role="img" aria-label="Diagram: studio escrows the server key in an OutLayer enclave owned by the licence contract; on death the enclave releases it; holders refund or pledge; fans host and are paid per signed player session.">
          <defs>
            <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="#ff6b2b" /></marker>
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
              <rect x={b.x} y={b.y} width={b.w} height="70" rx="4" className={box} strokeWidth="1.2" />
              <text x={b.x + 16} y={b.y + 30} fill="#efe5d0" fontSize="15" fontWeight="600" fontFamily="Chakra Petch" letterSpacing="1.5">{b.t.toUpperCase()}</text>
              <text x={b.x + 16} y={b.y + 52} fill="#b0a7cc" fontSize="12" fontFamily="IBM Plex Mono">{b.s}</text>
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
                <path d={d} stroke="#ff6b2b" strokeWidth="1.6" fill="none" markerEnd="url(#ar)" />
                <text x={lx} y={ly} fill="#ffc94a" fontSize="11.5" fontFamily="Chakra Petch" letterSpacing="1" textAnchor={dir === "H" ? "middle" : "start"}>{label}</text>
              </g>
            );
          })}
          <text x="10" y="290" fill="#8f86ad" fontSize="11.5" fontFamily="IBM Plex Mono">Death = failed enclave probes spaced in time, a quorum of holders, or the studio's own end_of_service. The studio's word alone can never keep it alive.</text>
        </svg>
      </div>
    </section>
  );
}

export default function How() {
  return (
    <div className="mx-auto max-w-7xl [&_section]:px-0">
      <ScreenTitle eyebrow="How it works" sub="Four parts: an NFT licence, a sealed server key, liveness that players prove, and an afterlife that pays the people who keep the game running.">A licence that keeps working</ScreenTitle>
      <Diagram />
      <Lifecycle />
      <Trust />
      <Faq />
    </div>
  );
}
