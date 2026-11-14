// The "rehearsed vs real" table and the list of what is not proven. Hand-written on purpose: these are statements of limits, and they are
// reviewed whenever the demo changes. Kept next to the generator so a change to one is a change to the other.
const ROWS = [
  ["Demo-speed timers", "Rehearsed setting", "The judge instances run probe interval 20 s, 3 failures, windows 2 to 3 min, epoch 2 min so a lifecycle fits a video. The contract code is identical; production defaults (6 h, 4 failures, 72 h windows, 7-day epochs) are init config, listed in the README. No production-length run was done."],
  ["Death of the official server", "Real, staged by us", "We deleted our own Cloudflare Worker (`scripts/ops/kill-official.sh`). What followed is real contract state: failed probes spaced in time, then Dead, then release. We chose the moment; the contract decided the rest."],
  ["Studio, players, fan host", "Role-played", "Ember Rift is a fictional studio title. The studio account, the four player accounts and the fan host are all ours, on testnet. The community server is the released build running for real, hosted by us in the fan role."],
  ["Films and UI flows", "Rehearsed tooling", "UI flows in the film were driven from a local build with a localhost-only test-account signer (no wallet keys imported anywhere). Every transaction they sent is on testnet and listed above. Wallet sign-in through Meteor or MyNearWallet was not exercised end to end."],
  ["Money", "Testnet only", "NEAR testnet and Base Sepolia. Nothing has real value. Base Sepolia payouts are demo-sized (10^13 wei per verified session, 0.00001 ETH)."],
  ["Chain Signatures", "Real", "The NEAR MPC signer `v1.signer-prod.testnet` signs the payout transactions; the contract verifies the signature recovers to its derived address before storing it. The Base Sepolia receipts are public."],
  ["Gas-free actions", "Real, with a convenience", "Zero-deposit calls are paid from the contract's ops budget (seeded by us, topped up by 10% of post-death sales). The relayer (Cloudflare Pages) pays gas only and is ours: a holder who distrusts it can send the same call and pay gas themselves."],
  ["Walrus mirror", "Real, not permanent", "Walrus testnet is not permanent storage and is wiped periodically. It is one mirror of three; the studio's copy and GitHub raw serve the same hash-pinned bytes, and any single honest mirror is enough."],
  ["Reproducible builds", "Partly", "release.wasm and probe.wasm (the code the escrow trusts) rebuild bit-for-bit in OutLayer's pinned compiler image. The licence wasm is cargo plus wasm-opt from a local toolchain and is not claimed to be bit-reproducible; its identity is its hash and its public on-chain bytes."],
  ["Build provenance", "Real from v2", "The v2 judge instance's bundle is attested by a public GitHub Actions workflow (Sigstore, Rekor). v1 and the dev instance predate that pipeline: their build hash is checked by decrypting the released artifact instead."],
  ["The escrow's trust root", "Trusted, not proven here", "The key opens only in OutLayer's TEE workers (Intel TDX) under a keystore whose master key comes from NEAR MPC. We prove the rule we asked the keystore to enforce (the store_secrets call on chain), not the enclave's honesty."],
];
const NOT = [
  "OutLayer's TEE and keystore behaving as documented. Our spike (`proof/spike.md`) shows a stranger refused and release.wasm refusing while alive; that is evidence, not a proof.",
  "Wallet sign-in with third-party wallets, mainnet behaviour, and any production-length run.",
  "Game balance or fun. The simulation is deterministic and tested; whether it is good is for the player.",
  "That a source repository is benign: provenance says which workflow built the bundle from which commit, not what the code does.",
  "Anything a mirror serves that is not hash-pinned (the web app itself).",
];
export const honesty = () => ["| Thing | Status | Detail |", "|---|---|---|", ...ROWS.map(([a, b, c]) => `| ${a} | **${b}** | ${c} |`)].join("\n");
export const notCovered = () => NOT.map((s) => `- ${s}`).join("\n");
