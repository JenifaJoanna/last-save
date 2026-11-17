// Drive the real-wallet recording Chrome (CDP on 127.0.0.1:9413) for the Meteor runs. Never touches the main Meteor
// wallet page (https://wallet.meteorwallet.app/wallet): it is never read, clicked, reloaded, navigated or closed. Works
// on tabs this script opens and on Meteor's approval tabs (/connect/...). Input events go to the page, not the OS.
//   node cdp.mjs list | new <url> | text <urlRe> | eval <urlRe> <js> | click <urlRe> <x> <y> | key <urlRe> <Key> | shot <urlRe> <file>
import { writeFileSync } from "node:fs";
const PORT = process.env.CDP_PORT ?? "9413";
const MAIN_WALLET = /^https:\/\/wallet\.meteorwallet\.app\/wallet\b/;
const [cmd, a, b, c] = process.argv.slice(2);
const pages = async () => (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const out = (s) => process.stdout.write(`${s}\n`);

if (cmd === "list") { for (const t of await pages()) out(`${t.id.slice(0, 8)} ${MAIN_WALLET.test(t.url) ? "[main wallet, untouched] " : ""}${t.url.slice(0, 110)}`); process.exit(0); }

async function session(wsUrl) {
  const ws = new WebSocket(wsUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const wait = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); wait.get(d.id)?.(d); };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, close: () => ws.close() };
}

if (cmd === "new") {
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const s = await session(ver.webSocketDebuggerUrl);
  const r = await s.send("Target.createTarget", { url: a, newWindow: false, background: false });
  out(r.result?.targetId?.slice(0, 8) ?? JSON.stringify(r.error)); s.close(); process.exit(0);
}

const re = new RegExp(a ?? "^$");
const t = (await pages()).find((p) => re.test(p.url) && !MAIN_WALLET.test(p.url));
if (!t) { out("no matching tab (the main wallet page is never used)"); process.exit(3); }
const s = await session(t.webSocketDebuggerUrl);
if (cmd === "text" || cmd === "eval") {
  const expr = cmd === "text" ? "document.body.innerText" : b;
  const r = await s.send("Runtime.evaluate", { expression: `(async () => { ${cmd === "text" ? "return " + expr : expr} })()`, awaitPromise: true, returnByValue: true, userGesture: true });
  const v = r.result?.result?.value;
  out(v === undefined ? JSON.stringify(r.result?.exceptionDetails?.exception?.description ?? r.error ?? null).slice(0, 400) : typeof v === "string" ? v : JSON.stringify(v));
} else if (cmd === "click") {
  const x = Number(b), y = Number(c);
  await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await s.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await s.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  out(`clicked ${x},${y} in ${t.id.slice(0, 8)}`);
} else if (cmd === "key") {
  const key = b, code = key.length === 1 ? `Key${key.toUpperCase()}` : key, vk = key === "Enter" ? 13 : key === "Escape" ? 27 : key.charCodeAt(0);
  await s.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, text: key === "Enter" ? "\r" : key.length === 1 ? key : undefined });
  await s.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk });
  out(`pressed ${key} in ${t.id.slice(0, 8)}`);
} else if (cmd === "shot") {
  const r = await s.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(b, Buffer.from(r.result.data, "base64")); out(`saved ${b}`);
} else out("usage: list | new <url> | text <re> | eval <re> <js> | click <re> <x> <y> | key <re> <Key> | shot <re> <file>");
s.close(); process.exit(0);
