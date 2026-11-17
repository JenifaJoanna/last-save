// Game login, two taps, through NEAR Connect with the localhost scripted wallet: picker → connect → Sign the login → match.
import { readFileSync } from "node:fs";
import { browser, logger, sleep } from "./qa-lib.mjs";
const ME = process.env.ACCT ?? "lastsave-mira.testnet";
// GAME_URL: a localhost capture build of the game with ?server=&contract=&capture=1; HOLD_MS: keep playing (session receipts).
const URL = process.env.GAME_URL ?? `http://127.0.0.1:4410/?server=${encodeURIComponent("https://emberrift-community-v2dev.pages.dev")}&contract=v2dev.lastsave-factory.testnet&capture=1`;
const HOLD_MS = Number(process.env.HOLD_MS ?? 0);
const log = logger(process.env.QA_LOG ?? "/tmp/qa-login.jsonl");
const cred = JSON.parse(readFileSync(`${process.env.HOME}/.near-credentials/testnet/${ME}.json`, "utf8"));
const b = browser(`rdyl${Date.now().toString(36).slice(-5)}`);
const opts = () => b.ev(`[...document.querySelectorAll("button.opt")].map(e => e.textContent.trim().replace(/\\s+/g," "))`);
try {
  b.open("about:blank"); b.viewport(1440, 900); b.clearLogs(); b.open(URL); await sleep(6000);
  log("hook", { ready: b.ev(`typeof window.__lastSaveTestWallet`) });
  b.ev(`window.__lastSaveTestWallet(${JSON.stringify(ME)}, ${JSON.stringify(cred.private_key)}); "ok"`);
  b.ev(`[...document.querySelectorAll("button.opt")].find(e => /CONNECT/i.test(e.textContent))?.click(); "ok"`); await sleep(1200);
  log("wallet-screen", { options: opts() });
  b.ev(`[...document.querySelectorAll("button.opt")].find(e => /NEAR wallet/i.test(e.textContent))?.click(); "ok"`); await sleep(3500);
  const picker = b.ev(`(document.querySelector(".hot-connector-popup")?.innerText || "").replace(/\\s+/g," ").slice(0, 200)`);
  log("picker", { picker });
  const clicked = b.ev(`(() => { const p = document.querySelector(".hot-connector-popup"); const el = p && [...p.querySelectorAll("*")].filter(e => /^Test wallet \\(localhost\\)/.test((e.textContent||"").trim()) && e.children.length < 6).pop(); const c = el && (el.closest(".connect-item, [class*=item], button, li") || el); if (!c) return "none"; c.click(); return "clicked"; })()`);
  await sleep(3000);
  log("after-connect", { clicked, screen: b.ev(`(document.querySelector("#signincard, .term-win")?.innerText || "").replace(/\\s+/g," ").slice(0, 260)`), signBtn: b.ev(`!!document.getElementById("sign")`) });
  b.run("press", "Enter"); await sleep(12000);
  if (HOLD_MS > 0) { const t0 = Date.now(); while (Date.now() - t0 < HOLD_MS) { b.run("press", "Space"); await sleep(5000); } }
  log("match", { hud: b.ev(`(document.getElementById("strip")?.innerText || "").replace(/\\s+/g," ")`), board: b.ev(`(document.getElementById("board")?.innerText || "").replace(/\\s+/g," ").slice(0, 160)`), signinHidden: b.ev(`document.getElementById("signin")?.hidden`), overlay: b.text().replace(/\s+/g, " ").slice(0, 200), ...b.logs() });
} catch (e) { log("error", { err: String(e).slice(0, 300) }); }
finally { b.close(); }
