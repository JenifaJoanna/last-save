// A set of headless players (game/server/scripts/botlib.mjs) signing in with real testnet keys. Keys stay in memory.
import { Bot } from "../../game/server/scripts/botlib.mjs";
import { connection, ensureKey, NETWORK } from "../lib/near.mjs";
import { log, sleep } from "./util.mjs";

export const wsUrlOf = (httpUrl) => `${httpUrl.replace(/^http/, "ws").replace(/\/$/, "")}/ws`;

export class BotPool {
  constructor({ baseUrl, hostId, recipient, accounts }) {
    Object.assign(this, { baseUrl, hostId, recipient, accounts, bots: [] });
  }

  async start() {
    for (const accountId of this.accounts) {
      await ensureKey(accountId);
      const kp = await connection().mem.getKey(NETWORK, accountId);
      const bot = new Bot({ url: wsUrlOf(this.baseUrl), accountId, secretKey: kp.toString(), recipient: this.recipient, hostId: this.hostId });
      await bot.connect();
      this.bots.push(bot);
    }
    return this;
  }

  get(accountId) { return this.bots.find((b) => b.accountId === accountId); }

  /** Waits until every bot has a welcome (profile) or a denial. */
  async joined(ms = 20_000) {
    await Promise.all(this.bots.map((b) => b.waitFor((x) => x.profile || x.denied, ms, "welcome").catch(() => null)));
    return this.bots.map((b) => ({ account: b.accountId, joined: Boolean(b.profile), denied: b.denied?.code ?? null, epoch: b.welcome?.epoch ?? null, profile: b.profile }));
  }

  /** Re-opens any socket that dropped (a Worker restart, a tunnel hiccup). */
  async revive() {
    for (const b of this.bots) {
      if (!b.closed || b.denied) continue;
      try { b.profile = null; await b.connect(); log(`  bot ${b.accountId} reconnected`); } catch { /* retried on the next pass */ }
    }
  }

  /** Waits until every bot has finished `n` matches (or the timeout), reconnecting dropped sockets along the way. */
  async matches(n, timeoutMs) {
    const end = Date.now() + timeoutMs;
    let said = -1;
    while (Date.now() < end) {
      await this.revive();
      const counts = this.bots.map((b) => b.results.length);
      if (Math.min(...counts) >= n) return counts;
      const total = counts.reduce((a, c) => a + c, 0);
      if (total !== said) { said = total; log(`  matches finished per bot: ${counts.join(", ")}`); }
      await sleep(4000);
    }
    return this.bots.map((b) => b.results.length);
  }

  stop() {
    for (const b of this.bots) b.close();
    this.bots = [];
  }
}
