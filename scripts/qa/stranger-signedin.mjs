// Stranger, signed in with the localhost test signer (capture build only), on the instance a localhost build is wired to:
// buy (if not yet a holder), library, play link, the report confirmation (never sends the report), widths of every
// signed-in screen.   ACCT=<test account> node scripts/qa/stranger-signedin.mjs <base-url> <log.jsonl>
import { readFileSync } from "node:fs";
import { browser, logger, sleep, tx, txHashes, view, widths } from "./qa-lib.mjs";

const [base, file] = process.argv.slice(2);
const ME = process.env.ACCT;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base ?? "") || !ME) { process.stderr.write("localhost only: ACCT=<id> stranger-signedin.mjs http://127.0.0.1:<port> <log>\n"); process.exit(2); }
const cred = JSON.parse(readFileSync(`${process.env.HOME}/.near-credentials/testnet/${ME}.json`, "utf8"));
const log = logger(file);
const b = browser(`sin${Date.now().toString(36).slice(-5)}`);
try {
  b.open(`${base}/`); b.viewport(1440, 900);
  b.ev(`sessionStorage.setItem("lastsave.devsigner", ${JSON.stringify(JSON.stringify({ accountId: ME, privateKey: cred.private_key }))}); "ok"`);
  b.open(`${base}/`); await sleep(5000);
  const contract = (b.text().match(/[a-z0-9-]+\.lastsave-factory\.testnet/) ?? [])[0];
  let mine = await view(contract, "nft_tokens_for_owner", { account_id: ME });
  if (!mine.length) {
    b.clearLogs(); b.open(`${base}/app/store`); await b.waitText(/Buy for [\d.]+ Ⓝ/i, 40000);
    const before = txHashes(b);
    b.ev(`document.querySelector(".keycap-primary")?.click(); "ok"`);
    for (let i = 0; i < 40 && !txHashes(b).some((h) => !before.includes(h)); i++) await sleep(1500);
    mine = await view(contract, "nft_tokens_for_owner", { account_id: ME });
    log("buy", { txs: await Promise.all(txHashes(b).filter((h) => !before.includes(h)).map((h) => tx(h, ME))), owned: mine.map((t) => t.token_id), supply: (await view(contract, "get_info")).totals.supply, ...b.logs() });
  }
  b.open(`${base}/app/play`); await sleep(6000);
  log("play", { links: b.ev(`[...document.querySelectorAll("a")].filter(a => /Play/i.test(a.innerText)).map(a => a.getAttribute("href"))`), rows: b.ev(`[...document.querySelectorAll("li")].map(l => l.innerText.replace(/\\s+/g, " ")).filter(t => /SERVER|HOST/i.test(t)).slice(0, 3)`) });
  b.open(`${base}/app/afterlife`); await b.waitText(/Report it down|Holders only|Vote closed/i, 40000);
  const reportsBefore = (await view(contract, "get_info")).reports_in_window;
  b.ev(`[...document.querySelectorAll("button")].find(e => /^Report it down/i.test(e.innerText.trim()))?.click(); "ok"`); await sleep(1200);
  const asking = b.ev(`[...document.querySelectorAll("[role=alert]")].map(e => e.innerText).find(t => /really down/i.test(t)) ?? null`);
  const yes = b.ev(`[...document.querySelectorAll("button")].map(e => e.innerText.trim()).find(t => /Yes, report it down/i.test(t)) ?? null`);
  b.ev(`[...document.querySelectorAll("button")].find(e => e.innerText.trim() === "Cancel")?.click(); "ok"`); await sleep(1500);
  log("report:confirm", { asking, yes, cancelled: !b.ev(`[...document.querySelectorAll("[role=alert]")].some(e => /really down/i.test(e.innerText))`), reportsBefore, reportsAfter: (await view(contract, "get_info")).reports_in_window });
  for (const r of ["store", "library", "play", "afterlife", "hosts"]) await widths(b, `${base}/app/${r}`, r, log);
} catch (e) { log("error", { err: String(e).slice(0, 300) }); }
finally { b.close(); }
