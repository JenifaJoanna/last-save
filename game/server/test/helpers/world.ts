import { Bot } from "../../scripts/botlib.mjs";
import { FakeRpc } from "./fakeRpc";
import { newPilot, type Pilot } from "./keys";

export const CONTRACT = "lastsave-licence.testnet";
export const baseVars = (rpc: FakeRpc, extra: Record<string, string> = {}) => ({
  RPC_URLS: rpc.url, RPC_BACKOFF_MS: "1", LICENCE_CONTRACT: CONTRACT, ...extra,
});

export async function fixture(count: number, names = ["mira", "kofi", "yuna", "dario", "noor", "tomas", "ines", "oleg", "pia"]) {
  const rpc = await new FakeRpc().start();
  const pilots: Pilot[] = names.slice(0, count).map((n) => newPilot(`lastsave-${n}.testnet`));
  for (const p of pilots) rpc.allow(p.account, p.public);
  return { rpc, pilots };
}

export const makeBot = (url: string, p: Pilot, o: { hostId?: string; play?: boolean } = {}): any =>
  new Bot({ url, accountId: p.account, secretKey: p.secret, recipient: CONTRACT, hostId: o.hostId ?? "official", play: o.play ?? true });

export async function join(url: string, p: Pilot, o: { hostId?: string; play?: boolean } = {}): Promise<any> {
  const bot = makeBot(url, p, o);
  await bot.connect();
  await bot.waitFor((b: any) => b.profile || b.denied, 15_000, "welcome or denied");
  return bot;
}

export const getJson = async (url: string) => (await fetch(url)).json() as Promise<any>;
