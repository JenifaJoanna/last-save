// Preview store: current lifecycle step + persona, serves contract views, simulates calls. No chain writes.
import { buildWorld, PERSONAS, personaAccount, STEPS, type Persona, type World } from "./world";
import { sfx } from "./sound";

export const PREVIEW = import.meta.env.VITE_PREVIEW === "1";
const KEY = "lastsave-preview";

interface S { step: string; persona: Persona }
let cur: S = { step: "sold", persona: "mira" };
let world: World = buildWorld(cur.step);
const subs = new Set<() => void>();

function init(): void {
  try { const saved = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (saved?.step) cur = saved; } catch { /* storage blocked */ }
  const q = new URLSearchParams(location.search);
  const pv = q.get("pv"), as = q.get("as") as Persona | null;
  if (pv && STEPS.some((s) => s.id === pv)) cur = { step: pv, persona: as && PERSONAS.includes(as) ? as : STEPS.find((s) => s.id === pv)!.persona };
  if (pv || as) { q.delete("pv"); q.delete("as"); history.replaceState(null, "", location.pathname + (q.size ? `?${q}` : "")); }
  world = buildWorld(cur.step);
}
if (PREVIEW) init();

function emit(): void {
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* storage blocked */ }
  subs.forEach((f) => f());
}
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const current = () => cur;
export const stepIndex = () => Math.max(0, STEPS.findIndex((s) => s.id === cur.step));
export const account = () => personaAccount(cur.persona);

export function goto(step: string, persona?: Persona): void {
  const s = STEPS.find((x) => x.id === step);
  if (!s) return;
  cur = { step, persona: persona ?? s.persona };
  world = buildWorld(step);
  emit();
}
export const setPersona = (persona: Persona) => { cur = { ...cur, persona }; emit(); };
export const move = (d: number) => { const i = Math.min(STEPS.length - 1, Math.max(0, stepIndex() + d)); goto(STEPS[i].id, d > 0 ? undefined : STEPS[i].persona); };

/** Serves the same JSON the licence contract (and factory) views return. */
export function previewView(method: string, args: Record<string, unknown>): unknown {
  const w = world;
  switch (method) {
    case "get_info": return { ...w.info, now_ms: Date.now() };
    case "licence_of": return w.licences[String(args.account_id)] ?? null;
    case "get_hosts": return w.hosts;
    case "get_activity": return w.activity.slice(0, Number(args.limit ?? 30));
    case "nft_tokens": return w.tokens;
    case "get_snapshot": return w.snapshot;
    case "evm_payout_info": return w.evmInfo;
    case "get_evm_payouts": return w.evmPayouts;
    case "instances": return w.instances;
    default: return null;
  }
}
export const previewKeys = () => world.keys;
export const previewCodeHash = () => "9pZ3kTqfR4mWbXh7c2LsVd8nEo1yGuJa6KePiHt5QrBs";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export interface ActResult { ok: boolean; title: string; body: string }

/** Simulates a contract call: plays its sound, moves the lifecycle on where the call would. */
export async function act(method: string, args: Record<string, unknown>, label: string): Promise<ActResult> {
  const i = stepIndex();
  const at = (id: string) => STEPS.findIndex((s) => s.id === id);
  const gasless = "Gas paid by the relayer: you paid 0 Ⓝ.";
  switch (method) {
    case "buy_licence":
      await wait(900); sfx("confirm");
      if (i < at("sold")) goto("sold", cur.persona);
      else if (cur.persona === "ines" || i >= at("chosen")) goto(i >= at("postbuy") ? cur.step : "postbuy", "ines");
      return { ok: true, title: label, body: i >= at("dead") ? "Bought after the shutdown: the whole price went to the hosts' pool." : "Licence minted. 40% of the price is locked for you by contract." };
    case "probe_official": {
      const p = cur.persona;
      sfx("scan"); world.info.probe.in_flight = true; world.info.probe.in_flight_since_ms = Date.now(); emit();
      await wait(2600);
      if (i <= at("sold")) { goto("sold", p); sfx("confirm"); return { ok: true, title: "Probe: alive", body: `An enclave verified 4 holder-signed sessions on the official server. ${gasless}` }; }
      const to = cur.step === "fail1" ? "fail2" : cur.step === "fail2" ? "dead" : "fail1";
      goto(to, p); sfx(to === "dead" ? "flatline" : "powerDown");
      return to === "dead" ? { ok: true, title: "Probe 3 of 3 failed", body: "The contract declared the studio gone. Anyone can trigger the release now." }
        : { ok: true, title: `Probe failed (${to === "fail1" ? 1 : 2} of 3)`, body: `The official server did not answer. ${gasless}` };
    }
    case "report_down":
      await wait(700); sfx("confirm"); return { ok: true, title: label, body: `Your report counts for 2 minutes. ${gasless}` };
    case "release":
      world.info.release.in_flight = true; emit(); sfx("scan"); await wait(2800); goto("released", cur.persona); sfx("unlock");
      return { ok: true, title: "Server released", body: "The enclave checked the death on-chain and published the key." };
    case "choose": {
      await wait(800); sfx("confirm");
      const lic = world.licences[account() ?? ""];
      if (lic) { lic.choice = args.choice; world.info.totals[args.choice === "Refund" ? "refunded" : "pledged"] = (BigInt(world.info.totals[args.choice === "Refund" ? "refunded" : "pledged"]) + BigInt(lic.pot_share)).toString(); emit(); }
      return { ok: true, title: label, body: gasless };
    }
    case "register_host":
      await wait(900); sfx("reconnect"); if (i < at("hosted")) goto("hosted", "fanhost");
      return { ok: true, title: label, body: "Your server is now listed for every licence holder." };
    case "claim_epoch":
      sfx("scan"); await wait(2400); sfx("confirm"); if (i < at("paid")) goto("paid", "fanhost");
      return { ok: true, title: label, body: `The enclave verified 3 holder sessions. ${gasless}` };
    case "set_payout_evm":
      await wait(700); sfx("confirm"); if (world.hosts[0]) { world.hosts[0].payout_evm = args.address; emit(); }
      return { ok: true, title: label, body: `Future epochs pay out on Base Sepolia. ${gasless}` };
    case "sign_evm_payout": case "bump_evm_payout":
      sfx("scan"); await wait(2400); sfx("unlock"); if (i < at("evm")) goto("evm", "fanhost");
      return { ok: true, title: label, body: "NEAR's MPC network signed the Base Sepolia transfer for the licence contract." };
    default:
      await wait(600); return { ok: true, title: label, body: "Preview only." };
  }
}
