// Stranger sweep of a deployed site: every public route at 390 / 768 / 1440 in a fresh headless browser, logging layout
// problems and console or page errors. Clipped text marked "+title" (tooltip and copy button) is deliberate and omitted.
//   node scripts/qa/sweep.mjs <base-url> <log.jsonl> [route ...]
import { browser, logger, widths } from "./qa-lib.mjs";

const [base, file, ...given] = process.argv.slice(2);
if (!base || !file) { process.stderr.write("usage: sweep.mjs <base-url> <log.jsonl> [route ...]\n"); process.exit(2); }
const routes = given.length ? given : ["/", "/how", "/judges", "/status", "/attack", "/signin", "/app/store", "/app/library", "/app/afterlife", "/app/hosts", "/app/play", "/play/?practice=1", "/no-such-page", "/?instance=ember-rift", "/status?instance=ember-rift"];
const log = logger(file);
const b = browser(`sweep${Date.now().toString(36).slice(-5)}`);
try {
  b.open("about:blank");
  for (const r of routes) await widths(b, `${base.replace(/\/$/, "")}${r}`, r, log);
} finally { b.close(); }
