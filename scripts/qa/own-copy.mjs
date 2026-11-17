// A stranger runs the whole afterlife on their own copy (localhost build, test signer): /own → take a free sbx copy →
// buy → play page → report (1 of 1 kills it) → release (enclave publishes the key) → pledge. Chain readback each step.
//   ACCT=<test account> node scripts/qa/own-copy.mjs http://127.0.0.1:<port> <log.jsonl>
import { readFileSync } from "node:fs";
import { balance, browser, logger, sleep, tx, txHashes, view } from "./qa-lib.mjs";

const [base, file] = process.argv.slice(2);
const ME = process.env.ACCT;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base ?? "") || !ME) { process.stderr.write("localhost only: ACCT=<id> own-copy.mjs http://127.0.0.1:<port> <log>\n"); process.exit(2); }
const cred = JSON.parse(readFileSync(`${process.env.HOME}/.near-credentials/testnet/${ME}.json`, "utf8"));
const log = logger(file);
const b = browser(`own${Date.now().toString(36).slice(-5)}`);
const click = (re) => b.ev(`(() => { const el = [...document.querySelectorAll("button, a")].filter(e => new RegExp(${JSON.stringify(re)}, "i").test(e.innerText.trim()) && !e.disabled).pop(); if (!el) return "none"; el.click(); return el.innerText.trim().slice(0, 40); })()`);
async function act(label, re, until, C) {
  const before = txHashes(b);
  const r = click(re);
  for (let i = 0; i < 60 && !txHashes(b).some((h) => !before.includes(h)); i++) await sleep(1500);
  if (until) for (let i = 0; i < 60 && !(await until()); i++) await sleep(3000);
  const i = await view(C, "get_info");
  log(label, { clicked: r, txs: await Promise.all(txHashes(b).filter((h) => !before.includes(h)).map((h) => tx(h, ME))), status: i.status, cause: i.cause, released: i.released_key?.slice(0, 12) ?? null, totals: i.totals, ...b.logs() });
}
try {
  b.open(`${base}/`); b.viewport(1440, 900);
  b.ev(`sessionStorage.setItem("lastsave.devsigner", ${JSON.stringify(JSON.stringify({ accountId: ME, privateKey: cred.private_key }))}); "ok"`);
  b.clearLogs(); b.open(`${base}/own`); await b.waitText(/free of \d+/i, 40000);
  const take = b.ev(`[...document.querySelectorAll("a")].find(a => /take it/i.test(a.innerText))?.getAttribute("href") ?? null`);
  log("own", { take, list: b.ev(`[...document.querySelectorAll("li")].map(l => l.innerText.replace(/\\s+/g, " ")).filter(t => /sbx-/.test(t))`), ...b.logs() });
  if (!take) throw new Error("no free copy");
  const name = new URLSearchParams(take.split("?")[1]).get("instance"), C = `${name}.lastsave-factory.testnet`;
  b.open(`${base}${take}`); await b.waitText(/Buy for [\d.]+ Ⓝ/i, 40000);
  await act("buy", "^buy for", null, C);
  b.open(`${base}/app/play`); await sleep(7000);
  log("play", { rows: b.ev(`[...document.querySelectorAll("li")].map(l => l.innerText.replace(/\\s+/g, " ")).filter(t => /SERVER|HOST/i.test(t)).slice(0, 2)`) });
  b.open(`${base}/app/afterlife`); await b.waitText(/Report it down/i, 40000);
  await act("report", "^report it down", async () => (await view(C, "get_info")).status === "Dead", C);
  b.open(`${base}/app/afterlife`); await b.waitText(/Release/i, 40000); await sleep(2000);
  await act("release", "release", async () => !!(await view(C, "get_info")).released_key, C);
  b.open(`${base}/app/afterlife`); await b.waitText(/Pledge/i, 40000); await sleep(2000);
  const bal0 = await balance(ME);
  b.run("press", "2"); // the choice card: 1 Refund, 2 Pledge
  for (let i = 0; i < 40 && !JSON.parse((await view(C, "nft_tokens_for_owner", { account_id: ME }))[0]?.metadata?.extra ?? "{}").choice; i++) await sleep(1500);
  const tok = (await view(C, "nft_tokens_for_owner", { account_id: ME }))[0];
  log("pledge", { token: tok?.metadata?.extra, balanceBefore: bal0, balanceAfter: await balance(ME), totals: (await view(C, "get_info")).totals, ...b.logs() });
} catch (e) { log("error", { err: String(e).slice(0, 300) }); }
finally { b.close(); }
