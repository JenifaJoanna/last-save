#!/usr/bin/env node
// Discord alert feed: polls a licence instance's on-chain activity and posts each new event to the
// "Last Save alerts" #status channel. The webhook URL is read from local/discord/webhook.url (gitignored, 0600),
// never printed. A cursor in local/discord/cursor-<instance>.json keeps it from posting an event twice.
//   node scripts/alerts/discord-feed.mjs --instance <id> [--once] [--interval 15] [--dry-run]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { view } from "../lib/near.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const INSTANCE = arg("instance", process.env.CONTRACT ?? "v2dev.lastsave-factory.testnet");
const ONCE = process.argv.includes("--once");
const DRY = process.argv.includes("--dry-run");
const INTERVAL = Number(arg("interval", "15")) * 1000;
const DIR = "local/discord";
const CURSOR = `${DIR}/cursor-${INSTANCE}.json`;
const out = (s) => process.stdout.write(`${s}\n`);
const N = (y) => (Number(BigInt(String(y || "0")) / 10n ** 20n) / 1e4).toFixed(3).replace(/\.?0+$/, "");
const EXPLORER = `https://testnet.near.rocks/account/${INSTANCE}`;
const COLOR = { alive: 0x45e394, warn: 0xffb02e, dead: 0xff4d5e, gold: 0xffc94a, info: 0x9b8fd0 };

function webhook() {
  const f = `${DIR}/webhook.url`;
  if (!existsSync(f)) throw new Error(`missing ${f}`);
  const u = readFileSync(f, "utf8").trim();
  if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(u)) throw new Error("webhook file does not hold a Discord webhook URL");
  return u;
}

/** One activity record → a Discord embed, worded like the terminal. Returns null for events we don't announce. */
export function embedFor(a, info, fails = 0) {
  const out = String(a.outcome ?? ""), det = String(a.detail ?? "");
  const t = info?.totals ?? {};
  const base = { timestamp: new Date(Number(a.at_ms)).toISOString(), footer: { text: `LS-0001 · ${INSTANCE}` }, url: EXPLORER };
  switch (a.kind) {
    case "probe":
      if (out === "failed") return { ...base, color: COLOR.warn, title: `PROBE FAILED · ${fails}/${info?.config?.liveness?.fail_threshold ?? 3}`, description: `The enclave found no players being served (${det}).` };
      if (out === "alive") return { ...base, color: COLOR.alive, title: "PROBE · ALIVE", description: det };
      return null;
    case "death": return { ...base, color: COLOR.dead, title: "DEAD · THE STUDIO WENT DARK", description: "Three probes failed. The contract declared the studio gone. Anyone can now trigger the release." };
    case "release": return { ...base, color: COLOR.gold, title: "SERVER KEY RELEASED", description: "The enclave published the server key on-chain. Fans can host the game now." };
    case "choose": return { ...base, color: COLOR.gold, title: out === "refund" ? "HOLDER TOOK A REFUND" : "HOLDER PLEDGED TO HOSTS", description: `Pledged so far ${N(t.pledged)} Ⓝ · refunded ${N(t.refunded)} Ⓝ · keep-alive pool ${N(t.pool)} Ⓝ. Hosts wanted.` };
    case "host": return { ...base, color: COLOR.alive, title: "HOST ONLINE", description: det };
    case "claim": return { ...base, color: COLOR.alive, title: out === "booked" ? "HOST PAID ON BASE (BOOKED)" : "HOST PAID", description: det.replace(/(\d{20,})/g, (m) => `${N(m)} Ⓝ`) };
    case "evm_payout": return { ...base, color: COLOR.gold, title: "BASE PAYOUT SIGNED BY NEAR MPC", description: det };
    default: return null;
  }
}

async function tick(state) {
  const [info, acts] = await Promise.all([view(INSTANCE, "get_info"), view(INSTANCE, "get_activity", { limit: 30 })]);
  // get_activity is newest first; reversing keeps on-chain order for same-millisecond events (3rd failure, then death).
  const fresh = (acts ?? []).filter((a) => Number(a.at_ms) > state.last).reverse();
  state.fails ??= state.last === 0 ? 0 : Number(info?.probe?.consecutive_failures ?? 0);
  for (const a of fresh) {
    if (a.kind === "probe") state.fails = a.outcome === "alive" ? 0 : a.outcome === "failed" ? state.fails + 1 : state.fails;
    const e = embedFor(a, info, state.fails);
    state.last = Math.max(state.last, Number(a.at_ms));
    if (!e) continue;
    if (DRY) { out(`would post: ${e.title}`); continue; }
    const r = await fetch(`${webhook()}?wait=true`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "Last Save", embeds: [e] }) });
    if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise((res) => setTimeout(res, (j.retry_after ?? 2) * 1000)); continue; }
    out(`${r.ok ? "posted" : `failed ${r.status}`}: ${e.title}`);
  }
  if (!DRY) writeFileSync(CURSOR, JSON.stringify(state));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const state = existsSync(CURSOR) ? JSON.parse(readFileSync(CURSOR, "utf8")) : { last: process.argv.includes("--from-start") ? 0 : Date.now() };
  out(`discord feed for ${INSTANCE} from ${new Date(state.last).toISOString()}${DRY ? " (dry run)" : ""}`);
  do {
    try { await tick(state); } catch (e) { out(`tick error: ${String(e?.message ?? e).slice(0, 160)}`); }
    if (!ONCE) await new Promise((r) => setTimeout(r, INTERVAL));
  } while (!ONCE);
}
