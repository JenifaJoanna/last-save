// Stranger launches their own game from /launch (localhost build, test signer): one create_instance through the factory,
// then chain readback: the contract exists, its studio is the stranger, it has 0 access keys, the factory lists it.
//   ACCT=<test account> NAME=<new contract name> node scripts/qa/launch-own.mjs http://127.0.0.1:<port> <log.jsonl>
import { readFileSync } from "node:fs";
import { browser, logger, RPC, sleep, tx, txHashes, view } from "./qa-lib.mjs";

const [base, file] = process.argv.slice(2);
const ME = process.env.ACCT, NAME = process.env.NAME;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base ?? "") || !ME || !NAME) { process.stderr.write("localhost only: ACCT=<id> NAME=<name> launch-own.mjs http://127.0.0.1:<port> <log>\n"); process.exit(2); }
const cred = JSON.parse(readFileSync(`${process.env.HOME}/.near-credentials/testnet/${ME}.json`, "utf8"));
const log = logger(file);
const b = browser(`lch${Date.now().toString(36).slice(-5)}`);
const setInput = (label, value) => b.ev(`(() => { const l = [...document.querySelectorAll("label")].find(e => e.innerText.startsWith(${JSON.stringify(label)})); const i = l && l.querySelector("input"); if (!i) return "no input"; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event("input", { bubbles: true })); return "set"; })()`);
try {
  b.open(`${base}/`); b.viewport(1440, 900);
  b.ev(`sessionStorage.setItem("lastsave.devsigner", ${JSON.stringify(JSON.stringify({ accountId: ME, privateKey: cred.private_key }))}); "ok"`);
  b.clearLogs(); b.open(`${base}/launch`); await sleep(5000);
  log("form", { name: setInput("Contract name", NAME), title: setInput("Game title", "Stranger's Rift"), price: setInput("Licence price", "0.1") });
  await sleep(3000);
  const btn = b.ev(`[...document.querySelectorAll("button")].map(e => ({ t: e.innerText.trim(), d: e.disabled })).find(x => /^launch/i.test(x.t)) ?? null`);
  log("ready", { button: btn });
  const before = txHashes(b);
  b.ev(`[...document.querySelectorAll("button")].find(e => /^launch/i.test(e.innerText.trim()) && !e.disabled)?.click(); "ok"`);
  await b.waitText(/is live on NEAR testnet|failed/i, 90000).catch(() => null); await sleep(3000);
  const account = `${NAME}.lastsave-factory.testnet`;
  const i = await view(account, "get_info");
  const keys = await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_access_key_list", finality: "final", account_id: account } }) })).json();
  const listed = (await view("lastsave-factory.testnet", "instances")).some((x) => (x.account_id ?? x.accountId) === account);
  log("readback", { page: b.text().replace(/\s+/g, " ").match(/[a-z0-9-]+\.lastsave-factory\.testnet is live.{0,200}/)?.[0] ?? null, txs: await Promise.all(txHashes(b).filter((h) => !before.includes(h)).map((h) => tx(h, ME))), status: i.status, studio: i.config?.studio, title: i.config?.title, escrowed: i.escrowed, keys: keys.result?.keys?.length ?? null, listed, ...b.logs() });
} catch (e) { log("error", { err: String(e).slice(0, 300) }); }
finally { b.close(); }
