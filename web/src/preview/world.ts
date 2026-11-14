// Preview world: the licence contract's views, scripted through the whole lifecycle with real v1 values.
// Each step mutates the world built by the steps before it, so any state can be rebuilt from scratch.
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const Y = (n: number) => (BigInt(Math.round(n * 1e6)) * 10n ** 18n).toString();
const acct = (p: string) => `lastsave-${p}.testnet`;
export const PERSONAS = ["mira", "kofi", "yuna", "dario", "ines", "fanhost", "guest"] as const;
export type Persona = (typeof PERSONAS)[number];

export interface World {
  info: J; licences: Record<string, J>; hosts: J[]; activity: J[]; tokens: J[]; snapshot: J | null; keys: number;
  evmInfo: J; evmPayouts: J[]; instances: J[];
}

const SNAPSHOT_PLAYERS = {
  [acct("mira")]: { kos: 13, level: 6, matches: 7, shards: 259, skin: "emberwing", xp: 3380 },
  [acct("kofi")]: { kos: 8, level: 5, matches: 5, shards: 101, skin: "emberwing", xp: 1600 },
  [acct("yuna")]: { kos: 7, level: 4, matches: 5, shards: 104, skin: "emberwing", xp: 1580 },
  [acct("dario")]: { kos: 9, level: 4, matches: 5, shards: 95, skin: "emberwing", xp: 1515 },
};
const b64 = (o: unknown) => btoa(JSON.stringify(o));
export const EVM_ADDRESS = "0x7c4e2a9b51d3f08e6a2c94b17d5f3e0a8b6c1d29";
const HOST_EVM = "0x3f9a6e21c4d87b05e1a2f6c9d0b4e83a57c1e6f2";

function base(now: number): World {
  return {
    info: {
      contract_id: "lastsave-licence.testnet",
      config: {
        studio: acct("studio"), title: "Ember Rift", price: Y(0.25), fund_bps: 4000, royalty_bps: 1000,
        liveness: { fail_threshold: 3, probe_interval_ms: 20000, receipt_window_ms: 180000, report_window_ms: 120000, quorum_bps: 5000 },
        pool: { epoch_ms: 120000, pay_per_session: Y(0.01), epoch_cap: Y(0.05) },
        official_endpoint: "https://emberrift.pages.dev",
        artifact: { sha256: "ad3eb4f5560a8ae0bffd402587ef9d7d33bf9fa6485e0a9f079d68136fee21d2", build_hash: "b723c6d4854b1b8688a0a4a1191dda26d0492d6cf28a26cd1c88e7ac222bc967" },
        release: { sha256: "9fafaf8e417245337c30af82b045ecd0b75a6e2885f1c03300808a3f4f472b7a" },
        probe: { sha256: "b0cb38e1bc3e77eccabd6db0e21a6d8747d63955ccfd649ad3f8d7d349e0b0b4" },
        key_commitment: "5bb6b0cf211414cdcf27e6f836a03b242cf13f1e8b372845ed2e3d8230c6678f",
      },
      status: "Alive", cause: null, died_at_ms: null, escrowed: true, escrow_verified: true, attested_at_ms: now - 3 * 3600e3,
      release: { in_flight: false, released: false, released_key: null, released_at_ms: null, last_error: null },
      totals: { supply: 0, live_supply: 0, pot_locked: "0", pool: "0", refunded: "0", pledged: "0", paid_out: "0", evm_settled: "0", ops_budget: Y(1.5) },
      probe: { consecutive_failures: 0, last_alive_ms: null, last_probe_ms: null, in_flight: false, last_error: null },
      reports_in_window: 0, reports_needed: 2, current_epoch: 0,
    },
    licences: {}, hosts: [], activity: [], tokens: [], snapshot: null, keys: 0,
    evmInfo: { address: EVM_ADDRESS, next_nonce: 0, mpc: "v1.signer-prod.testnet", path: "lastsave/host-payouts", chain_id: 84532, derivation_account: "lastsave-licence.testnet", demo_wei_per_session: "10000000000000" },
    evmPayouts: [],
    instances: [
      { name: "lastsave-licence", account_id: "lastsave-licence.lastsave-factory.testnet", title: "Ember Rift", studio: acct("studio"), keys: 0, created_at_ms: now - 3 * 3600e3 },
    ],
  };
}

const ev = (w: World, at: number, kind: string, outcome: string, detail = "") => w.activity.unshift({ at_ms: at, kind, outcome, detail });
const add = (a: string, b: number) => (BigInt(a) + BigInt(Y(b))).toString();

export interface Step { id: string; label: string; short: string; persona: Persona; apply: (w: World, t: number) => void }

export const STEPS: Step[] = [
  { id: "launch", label: "Just launched: escrowed, verified, locked", short: "Launched", persona: "mira", apply: () => {} },
  { id: "sold", label: "4 licences sold · probe found 4 players", short: "Alive", persona: "mira", apply: (w, t) => {
    ["yuna", "mira", "kofi", "dario"].forEach((p, i) => {
      w.licences[acct(p)] = { token_id: String(i + 1), owner_id: acct(p), pot_share: Y(0.1), choice: null, minted_at_ms: t - 600e3 + i * 30e3, post_death: false };
      w.tokens.push({ token_id: String(i + 1), owner_id: acct(p) });
      ev(w, t - 600e3 + i * 30e3, "buy", "minted", `${acct(p)} licence #${i + 1}`);
    });
    Object.assign(w.info.totals, { supply: 4, live_supply: 4, pot_locked: Y(0.4) });
    Object.assign(w.info.probe, { last_alive_ms: t - 40e3, last_probe_ms: t - 40e3 });
    w.snapshot = { seq: 7, hash: "b16f7b17404a1dd094e46a517e74ca8bb714acc85e292372338cebc768cf5208", at_ms: t - 90e3, blob_base64: b64({ game: "ember-rift", seq: 7, players: SNAPSHOT_PLAYERS }) };
    ev(w, t - 40e3, "probe", "alive", "4 verified sessions");
  } },
  { id: "probing", label: "Anyone runs a probe: an enclave is checking", short: "Probing", persona: "kofi", apply: (w, t) => {
    Object.assign(w.info.probe, { in_flight: true, in_flight_since_ms: t - 4e3 });
  } },
  { id: "fail1", label: "Studio shut the server: probe 1 of 3 failed", short: "1/3 failed", persona: "kofi", apply: (w, t) => {
    Object.assign(w.info.probe, { in_flight: false, consecutive_failures: 1, last_probe_ms: t - 30e3 });
    ev(w, t - 30e3, "probe", "failed", "unreachable");
  } },
  { id: "fail2", label: "Probe 2 of 3 failed · mira reports it down", short: "2/3 failed", persona: "mira", apply: (w, t) => {
    Object.assign(w.info.probe, { consecutive_failures: 2, last_probe_ms: t - 25e3 });
    ev(w, t - 70e3, "probe", "inconclusive", "probe run failed or timed out");
    ev(w, t - 25e3, "probe", "failed", "unreachable");
    w.info.reports_in_window = 1;
    ev(w, t - 10e3, "report", "recorded", `${acct("mira")} licence #2`);
  } },
  { id: "dead", label: "Probe 3 of 3 failed: the studio is declared gone", short: "Dead", persona: "mira", apply: (w, t) => {
    Object.assign(w.info, { status: "Dead", cause: "probes", died_at_ms: t - 20e3, reports_in_window: 0 });
    Object.assign(w.info.probe, { consecutive_failures: 3, last_probe_ms: t - 20e3 });
    ev(w, t - 21e3, "probe", "failed", "unreachable");
    ev(w, t - 20e3, "death", "probes");
  } },
  { id: "releasing", label: "Anyone triggers the release: enclave running release.wasm", short: "Releasing", persona: "yuna", apply: (w, t) => {
    Object.assign(w.info.release, { in_flight: true, in_flight_since_ms: t - 5e3 });
  } },
  { id: "released", label: "Server key released on-chain · holders choose", short: "Released", persona: "yuna", apply: (w, t) => {
    const key = "fb0ac47f464bb2c8d5cb1b162c35185bd9c965b9278e8bf95c136c642717e490";
    Object.assign(w.info.release, { in_flight: false, released: true, released_key: key, released_at_ms: t - 15e3 });
    Object.assign(w.info, { released_key: key, released_at_ms: t - 15e3 });
    ev(w, t - 15e3, "release", "released", "key published");
  } },
  { id: "chosen", label: "yuna and dario refund · mira and kofi pledge", short: "Chosen", persona: "mira", apply: (w, t) => {
    [["yuna", "Refund"], ["mira", "Pledge"], ["dario", "Refund"], ["kofi", "Pledge"]].forEach(([p, c], i) => {
      w.licences[acct(p)].choice = c;
      ev(w, t - 60e3 + i * 12e3, "choose", c.toLowerCase(), `${acct(p)} licence #${w.licences[acct(p)].token_id}`);
    });
    Object.assign(w.info.totals, { pot_locked: "0", refunded: Y(0.2), pledged: Y(0.2), pool: Y(0.2) });
  } },
  { id: "postbuy", label: "ines buys after the shutdown: 90% to the hosts' pool, 10% to the gas-free budget", short: "Post-death buy", persona: "ines", apply: (w, t) => {
    w.licences[acct("ines")] = { token_id: "5", owner_id: acct("ines"), pot_share: "0", choice: null, minted_at_ms: t - 20e3, post_death: true };
    w.tokens.push({ token_id: "5", owner_id: acct("ines") });
    // 0.25 N minus ~0.002 N mint storage = 0.248 N net: 90% to the pool, 10% to the ops budget (sale.rs, OPS_SALE_BPS)
    Object.assign(w.info.totals, { supply: 5, pool: Y(0.4232), ops_budget: (BigInt(w.info.totals.ops_budget) + BigInt(Y(0.0248))).toString() });
    ev(w, t - 20e3, "buy", "minted", `${acct("ines")} licence #5 · after shutdown, 90% to the pool`);
  } },
  { id: "hosted", label: "A fan hosts the released build with one command", short: "Hosted", persona: "fanhost", apply: (w, t) => {
    w.hosts.push({ host_id: acct("fanhost"), endpoint: "https://emberrift-community.pages.dev", host_pubkey: "ed25519:99YdQ46e8nYXhzXDE7kusYjSGfvPkinngQthJ5derrWh", registered_at_ms: t - 240e3, epochs_paid: 0, sessions_paid: 0, earned: "0" });
    w.info.current_epoch = 9;
    ev(w, t - 240e3, "host", "registered", `${acct("fanhost")} · emberrift-community.pages.dev`);
  } },
  { id: "paid", label: "Host paid in NEAR for 3 verified player sessions", short: "Paid (NEAR)", persona: "fanhost", apply: (w, t) => {
    Object.assign(w.hosts[0], { epochs_paid: 1, sessions_paid: 3, earned: Y(0.03) });
    Object.assign(w.info.totals, { pool: Y(0.418), paid_out: Y(0.03) });
    ev(w, t - 30e3, "claim", "paid", `${acct("fanhost")} epoch 8: 3 verified, paid ${Y(0.03)}`);
  } },
  { id: "evm", label: "Next epoch paid on Base Sepolia, signed by NEAR's MPC network", short: "Paid (Base)", persona: "fanhost", apply: (w, t) => {
    Object.assign(w.hosts[0], { epochs_paid: 2, sessions_paid: 6, evm_address: HOST_EVM });
    Object.assign(w.info.totals, { pool: Y(0.388), evm_settled: Y(0.03) });
    w.evmInfo.next_nonce = 1;
    w.evmPayouts.push({ id: 0, host_id: acct("fanhost"), epoch: 9, to: HOST_EVM, verified: 3, value_wei: "30000000000000", near_debited: Y(0.03), nonce: 0, status: "Signed",
      signed_tx: "0x02f8708301499480843b9aca00847735940082520894" + HOST_EVM.slice(2) + "861b48eb57e00080c001a0…", tx_hash: "0x9d41c7a2e3b85f06d14a2c9e7b3f50a18c6d24e97f0b3a5c8e1d42f6a90b7c35", relayed: true });
    ev(w, t - 25e3, "claim", "booked", `${acct("fanhost")} epoch 9: 3 verified, 0.00003 ETH on Base Sepolia`);
    ev(w, t - 12e3, "evm_payout", "signed", "MPC signature · nonce 0");
  } },
  { id: "studio2", label: "Studio #2 launches its own game in one transaction", short: "Studio #2", persona: "mira", apply: (w, t) => {
    w.instances.push({ name: "tidebreak", account_id: "tidebreak.lastsave-factory.testnet", title: "Tidebreak", studio: "northpaw-games.testnet", keys: 0, created_at_ms: t - 8e3 });
  } },
];

export function buildWorld(stepId: string, now = Date.now()): World {
  const w = base(now);
  const k = Math.max(0, STEPS.findIndex((s) => s.id === stepId));
  for (let i = 0; i <= k; i++) STEPS[i].apply(w, now);
  w.info.now_ms = now;
  return w;
}

export const personaAccount = (p: Persona) => (p === "guest" ? null : acct(p));
export { add as addNear, Y as yocto };
