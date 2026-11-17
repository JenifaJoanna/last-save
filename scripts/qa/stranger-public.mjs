// Stranger, signed out, on a deployed site: what the page claims vs what the chain says, the instance switch, the wallet
// picker. Read-only: sends no transactions.   node scripts/qa/stranger-public.mjs <base-url> <log.jsonl>
import { browser, logger, sleep, view } from "./qa-lib.mjs";

const [base, file] = process.argv.slice(2);
const B = base.replace(/\/$/, "");
const log = logger(file);
const b = browser(`pub${Date.now().toString(36).slice(-5)}`);
const near = (y) => (Number(BigInt(y) / 10n ** 21n) / 1000).toString();
const txt = () => b.text().replace(/\s+/g, " ");
try {
  b.open("about:blank"); b.viewport(1440, 900);
  b.clearLogs(); b.open(`${B}/`); await b.waitText(/Ⓝ locked for holders/, 30000).catch(() => null); await sleep(1500);
  const home = txt();
  const contract = (home.match(/[a-z0-9-]+\.lastsave-factory\.testnet/) ?? [])[0];
  const i = await view(contract, "get_info");
  log("landing", { contract, chain: { status: i.status, released: !!i.released_key, locked: near(i.totals.pot_locked), pool: near(i.totals.pool), hosts: i.hosts },
    shows: { alive: /Official server online/i.test(home), released: /server released/i.test(home), locked: home.includes(`${near(i.totals.pot_locked)} Ⓝ locked`), pool: home.includes(`${near(i.totals.pool)} Ⓝ in the keep-alive pool`) },
    judgesLink: /judges' instance, as filmed/i.test(home), ...b.logs() });
  b.clearLogs(); b.open(`${B}/status`); await sleep(7000);
  const st = txt();
  log("status", { chain: { status: i.status, supply: i.totals.supply, needed: i.reports_needed }, shows: { alive: /ALIVE|serving players/i.test(st), reports: st.includes(`/${i.reports_needed} holder reports`), sold: st.includes(`${i.totals.supply} licences sold`) }, ...b.logs() });
  const rel = await view(contract, "release_info");
  b.clearLogs(); b.open(`${B}/judges`); await sleep(8000);
  const jt = b.text();
  log("judges", { buildHash: jt.includes(rel.build_hash), artifact: jt.includes(rel.artifact_sha256), escrowVerified: /Escrow verified in enclave\s*yes/i.test(jt), noReleaseRows: !/Server key released/.test(jt), ...b.logs() });
  b.clearLogs(); b.open(`${B}/?instance=ember-rift`); await sleep(6000);
  const er = txt(), eri = await view("ember-rift.lastsave-factory.testnet", "get_info");
  log("switch:ember-rift", { chip: b.ev(`[...document.querySelectorAll("header a")].map(a => a.innerText.trim()).filter(t => /ember-rift/i.test(t))`), contractShown: er.includes("ember-rift.lastsave-factory.testnet"), released: /server released/i.test(er) && !!eri.released_key, backLink: /Back to the live store/i.test(er), ...b.logs() });
  b.open(`${B}/judges`); await sleep(7000);
  log("switch:persists", { keyShown: b.text().includes(eri.released_key ?? "none") });
  b.open(`${B}/?instance=default`); await sleep(5000);
  log("switch:back", { contractShown: txt().includes(contract), chipGone: b.ev(`![...document.querySelectorAll("header a")].some(a => /ember-rift/i.test(a.innerText))`) });
  b.clearLogs(); b.open(`${B}/signin`); await sleep(5000); b.run("press", "1"); await sleep(4000);
  log("signin", { picker: b.ev(`(document.querySelector(".hot-connector-popup")?.innerText || "").replace(/\\s+/g, " ").slice(0, 120)`) });
  b.run("press", "Escape"); await sleep(1500);
  log("signin:esc", { open: b.ev(`!!document.querySelector(".hot-connector-popup")`), path: b.ev("location.pathname"), ...b.logs() });
} catch (e) { log("error", { err: String(e).slice(0, 300) }); }
finally { b.close(); }
