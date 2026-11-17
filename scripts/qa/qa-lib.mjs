// QA helpers for stranger passes: a fresh headless, muted agent-browser session; chain reads and tx readback over
// public RPC; a JSONL step log; and a layout audit at 390 / 768 / 1440 (page overflow, elements past the edge, clipped
// leaf text, images without alt, controls without a name, console and page errors).
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

export const RPC = process.env.NEAR_RPC ?? "https://near-testnet.drpc.org";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const AUDIT = `(() => {
  const W = innerWidth, vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const all = [...document.querySelectorAll("body *")];
  const past = [], clipped = [], noAlt = [], noName = [];
  for (const el of all) {
    if (!vis(el) || el.closest("svg, canvas")) continue;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (r.right > W + 1 && r.width < W * 3) {
      let p = el.parentElement, inScroller = false;
      while (p) { const c = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(c.overflowX) && p.getBoundingClientRect().right <= W + 1) { inScroller = true; break; } p = p.parentElement; }
      if (!inScroller) past.push(el.tagName.toLowerCase() + ":" + Math.round(r.right - W) + "px:" + (el.textContent || "").trim().slice(0, 30));
    }
    const t = (el.innerText || "").trim();
    if (t && !t.includes("\\n") && el.children.length <= 2 && !/(auto|scroll)/.test(s.overflowX)
      && (s.overflowX !== "visible" || s.textOverflow === "ellipsis" || s.webkitLineClamp !== "none")
      && (el.scrollWidth > el.clientWidth + 1 || (s.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 2)))
      clipped.push(Math.round(el.clientWidth) + "px:" + t.slice(0, 50) + (el.title || el.closest("[title]") ? " +title" : ""));
    if (el.tagName === "IMG" && !el.hasAttribute("alt")) noAlt.push(el.src.slice(-40));
    if (/^(BUTTON|A)$/.test(el.tagName) && !t && !el.getAttribute("aria-label") && !el.getAttribute("title")) noName.push(el.tagName.toLowerCase() + ":" + (el.className || "").toString().slice(0, 30));
  }
  return JSON.stringify({ w: W, path: location.pathname, docOver: document.documentElement.scrollWidth - W, past: past.slice(0, 8), clipped: [...new Set(clipped)].slice(0, 10), noAlt, noName: noName.slice(0, 6) });
})()`;

export function browser(name) {
  const run = (...a) => execFileSync("agent-browser", ["--session", name, ...a], { encoding: "utf8", maxBuffer: 64 << 20, env: { ...process.env, AGENT_BROWSER_ARGS: "--mute-audio,--no-first-run" } }).trim();
  const ev = (js) => { const r = run("eval", js); try { const v = JSON.parse(r); if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } } catch { return r; } };
  const b = {
    run, ev,
    open: (url) => run("open", url),
    viewport: (w, h) => run("set", "viewport", String(w), String(h)),
    text: () => ev("document.body.innerText"),
    async waitText(re, ms = 60000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const t = b.text(); if (re.test(t)) return t; await sleep(1000); } throw new Error(`timeout waiting for ${re}`); },
    clearLogs() { try { run("errors", "--clear"); run("console", "--clear"); } catch { /* fresh session */ } },
    logs() { let e = "", c = ""; try { e = run("errors"); } catch { /* none */ } try { c = run("console"); } catch { /* none */ } return { pageErrors: e.split("\n").filter((l) => l.trim()), console: c.split("\n").filter((l) => /\b(error|warn)/i.test(l)).slice(0, 4) }; },
    audit: () => ev(AUDIT),
    close() { try { run("close"); } catch { /* already closed */ } },
  };
  return b;
}

const post = async (body) => (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body }) })).json();
export async function view(contract, method, args = {}) {
  const r = await post({ method: "query", params: { request_type: "call_function", finality: "final", account_id: contract, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } });
  return r.result ? JSON.parse(Buffer.from(r.result.result).toString()) : { error: r.error?.cause?.name ?? r.error };
}
export async function balance(account) {
  const r = await post({ method: "query", params: { request_type: "view_account", finality: "final", account_id: account } });
  return r.result ? Number(BigInt(r.result.amount) / 10n ** 18n) / 1e6 : null;
}
export async function tx(hash, sender) {
  const r = await post({ method: "EXPERIMENTAL_tx_status", params: { tx_hash: hash, sender_account_id: sender, wait_until: "FINAL" } });
  const t = r.result?.transaction, a = t?.actions?.[0];
  const fc = a?.FunctionCall ?? a?.Delegate?.delegate_action?.actions?.[0]?.FunctionCall;
  const fails = (r.result?.receipts_outcome ?? []).map((o) => o.outcome.status).filter((s) => s.Failure).map((s) => JSON.stringify(s.Failure).slice(0, 160));
  return { hash, signer: t?.signer_id, receiver: t?.receiver_id, method: fc?.method_name, deposit: fc?.deposit, status: r.result ? Object.keys(r.result.status)[0] : r.error?.cause?.name, receiptFailures: fails };
}
export const txHashes = (b) => b.ev(`[...new Set([...document.querySelectorAll("a[href]")].map(a => a.href).filter(h => /\\/txns?\\/[1-9A-HJ-NP-Za-km-z]{43,44}/.test(h)).map(h => h.match(/[1-9A-HJ-NP-Za-km-z]{43,44}/)[0]))]`) || [];

export function logger(file) {
  return (step, data = {}) => { const line = JSON.stringify({ at: new Date().toISOString(), step, ...data }); appendFileSync(file, line + "\n"); console.log(line.slice(0, 500)); };
}
/** Audits one route at 390 / 768 / 1440. Clipped entries ending in "+title" are deliberate (tooltip and copy button). */
export async function widths(b, url, label, log, settle = 4000) {
  for (const [w, h] of [[390, 844], [768, 1024], [1440, 900]]) {
    b.viewport(w, h); b.clearLogs(); b.open(url); await sleep(settle);
    const a = b.audit(), L = b.logs();
    log(`width:${label}`, { w, docOver: a.docOver, past: a.past, clipped: a.clipped.filter((c) => !c.endsWith("+title")), noAlt: a.noAlt, noName: a.noName, ...L });
  }
}
