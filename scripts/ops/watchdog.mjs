#!/usr/bin/env node
// Watches the standby stores the root opens on (STANDBY, same list as the web build's VITE_STANDBY). The root itself
// already opens on the first alive one (web/src/lib/standby.ts); this adds the afterlife for a store judges killed: its
// release is triggered (zero deposit, paid from that store's own ops budget), and a warning is logged when one or no
// alive standby is left, so a new one can be launched (scripts/ops/launch-pool.sh).
//   STANDBY=live,live-2,live-3 node scripts/ops/watchdog.mjs [--once]      log: local/watchdog.log
import { appendFileSync, mkdirSync } from "node:fs";
import { call, view } from "../lib/near.mjs";

const FACTORY = process.env.FACTORY ?? "lastsave-factory.testnet";
const STUDIO = process.env.STUDIO ?? "lastsave-studio.testnet";
const LIST = (process.env.STANDBY ?? "live,live-2,live-3").split(",").map((n) => `${n.trim()}.${FACTORY}`);
const EVERY_MS = Number(process.env.EVERY_MS ?? 300_000);
mkdirSync("local", { recursive: true, mode: 0o700 });
const log = (o) => { const line = JSON.stringify({ at: new Date().toISOString(), ...o }); appendFileSync("local/watchdog.log", line + "\n"); process.stdout.write(line + "\n"); };

async function tick() {
  let alive = 0;
  for (const c of LIST) {
    const i = await view(c, "get_info").catch(() => null);
    if (!i) { log({ store: c, state: "missing" }); continue; }
    if (i.status === "Alive") { alive++; continue; }
    const released = !!i.released_key, flying = !!i.release?.in_flight;
    if (!released && !flying) {
      const r = await call(STUDIO, c, "release", {}, { gas: 300, deposit: "0" }).catch((e) => ({ failure: String(e).slice(0, 200) }));
      log({ store: c, state: "dead", action: "release", tx: r.hash ?? null, failure: r.failure ? JSON.stringify(r.failure).slice(0, 200) : null });
    } else log({ store: c, state: released ? "dead, released" : "dead, release running" });
  }
  log({ alive, warning: alive <= 1 ? `only ${alive} alive standby store left: launch another (scripts/ops/launch-pool.sh)` : null });
}

do { await tick().catch((e) => log({ error: String(e).slice(0, 200) })); } while (!process.argv.includes("--once") && await new Promise((r) => setTimeout(r, EVERY_MS)) === undefined);
