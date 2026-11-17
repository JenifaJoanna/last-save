// The host claims a finished epoch from the Hosts page (localhost build, test signer), then reads back what it was paid.
//   ACCT=<host account> INSTANCE=<name> node scripts/qa/host-claim.mjs http://127.0.0.1:<port> <log.jsonl> [clicks]
import { readFileSync } from "node:fs";
import { browser, logger, sleep, tx, txHashes, view } from "./qa-lib.mjs";

const [base, file, clicks = "2"] = process.argv.slice(2);
const ME = process.env.ACCT, NAME = process.env.INSTANCE;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base ?? "") || !ME || !NAME) { process.stderr.write("localhost only: ACCT=<host> INSTANCE=<name> host-claim.mjs http://127.0.0.1:<port> <log>\n"); process.exit(2); }
const C = `${NAME}.lastsave-factory.testnet`;
const cred = JSON.parse(readFileSync(`${process.env.HOME}/.near-credentials/testnet/${ME}.json`, "utf8"));
const log = logger(file);
const b = browser(`clm${Date.now().toString(36).slice(-5)}`);
const mine = async () => (await view(C, "get_hosts")).find((h) => h.host_id === ME);
try {
  b.open(`${base}/`); b.viewport(1440, 900);
  b.ev(`sessionStorage.setItem("lastsave.devsigner", ${JSON.stringify(JSON.stringify({ accountId: ME, privateKey: cred.private_key }))}); "ok"`);
  b.open(`${base}/app/hosts?instance=${NAME}`); await b.waitText(/Claim epoch/i, 40000); await sleep(2000);
  log("before", { host: await mine(), pool: (await view(C, "get_info")).totals.pool });
  for (let k = 0; k < Number(clicks); k++) {
    const before = txHashes(b);
    const r = b.ev(`(() => { const el = [...document.querySelectorAll("button")].find(e => /claim epoch/i.test(e.innerText) && !e.disabled); if (!el) return "none"; el.click(); return el.innerText.trim(); })()`);
    for (let i = 0; i < 60 && !txHashes(b).some((h) => !before.includes(h)); i++) await sleep(2000);
    await sleep(8000);
    log(`claim ${k + 1}`, { clicked: r, txs: await Promise.all(txHashes(b).filter((h) => !before.includes(h)).map((h) => tx(h, ME))), host: await mine(), totals: (await view(C, "get_info")).totals, ...b.logs() });
  }
  log("claims", { claims: JSON.stringify(await view(C, "get_claims")).slice(0, 600) });
} catch (e) { log("error", { err: String(e).slice(0, 300) }); }
finally { b.close(); }
