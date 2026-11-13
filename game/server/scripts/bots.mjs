#!/usr/bin/env node
// Plays Ember Rift with real testnet accounts: node scripts/bots.mjs --url wss://host/ws --accounts lastsave-mira,lastsave-kofi --duration 120
// Keys come from the local near-credentials store through scripts/lib/near.mjs (read-only; never printed).
import { Bot } from "./botlib.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? "true" : all[i + 1]]] : acc), []));
const url = args.url ?? "ws://127.0.0.1:8787/ws";
const names = (args.accounts ?? "lastsave-mira,lastsave-kofi,lastsave-yuna,lastsave-dario").split(",").map((s) => s.trim()).filter(Boolean);
const suffix = args.suffix ?? ".testnet";
const duration = Number(args.duration ?? 120);
const recipient = args.licence ?? process.env.LICENCE_CONTRACT ?? "lastsave-licence.testnet";
const hostId = args.host ?? "official";
const out = (s) => process.stdout.write(`${s}\n`);

const near = await import("../../../scripts/lib/near.mjs");
const bots = [];
for (const n of names) {
  const id = n.includes(".") ? n : `${n}${suffix}`;
  await near.ensureKey(id);
  const kp = await near.connection().mem.getKey(near.NETWORK, id);
  const bot = new Bot({ url, accountId: id, secretKey: kp.toString(), recipient, hostId });
  await bot.connect();
  bots.push(bot);
  bot.waitFor((b) => b.profile || b.denied, 15_000, "welcome").then(() => {
    out(bot.denied ? `${id}: denied ${bot.denied.code} (${bot.denied.error})` : `${id}: joined as level ${bot.profile.level}, ${bot.profile.xp} xp`);
  }).catch((e) => out(e.message));
}

for (const b of bots) {
  let announced = 0;
  const poll = setInterval(() => {
    for (; announced < b.results.length; announced++) {
      const r = b.results[announced].results.find((x) => x.account_id === b.accountId);
      if (r) out(`${b.accountId}: match over, place ${r.place}, ${r.shards} shards, ${r.kos} KOs, +${r.xp_gained} xp, level ${r.level_after}${r.unlocked ? `, unlocked ${r.unlocked}` : ""}`);
    }
  }, 1000);
  b.ws.addEventListener("close", () => clearInterval(poll));
}

await new Promise((r) => setTimeout(r, duration * 1000));
for (const b of bots) b.close();
out(`done after ${duration}s`);
process.exit(0);
