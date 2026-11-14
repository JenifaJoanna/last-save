// Sign-in terminal: numbered menu (1 connect wallet, 2 practice offline), wallet picker (NEAR Connect: Meteor, Intear,
// Nightly, Ledger, NEAR CLI; or a pasted testnet key), and the red ACCESS DENIED readout. Digits select, Enter confirms, Esc goes back.
import type { DeniedCode } from "../../../shared/protocol";
import { loginMessage, newSessionKey, signLoginWithKey, type Session } from "../session";
import { walletLogin } from "../wallet";

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const hex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, "0")).join("");
const SESSION_MS = 12 * 3600_000;

export interface SigninOpts {
  host: string;
  hostLabel: string;
  buildHash: string;
  contract: string;
  platformUrl: string;
  onSession: (s: Session) => void;
  onPractice: () => void;
}

const DENIED_TEXT: Record<DeniedCode, string> = {
  no_licence: "This account does not hold an Ember Rift licence.",
  bad_signature: "The login signature did not verify. Try signing in again.",
  no_access_key: "That key is not an access key of the account.",
  expired: "Your session expired. Sign in again.",
  replay: "That login was already used. Sign in again.",
  wrong_host: "That login was made for a different server.",
  full: "The arena is full (8 skiffs). Try again after this match.",
  bad_version: "This client is out of date. Reload the page.",
};
const DENIED_CODE: Record<DeniedCode, string> = {
  no_licence: "No licence", bad_signature: "Bad signature", no_access_key: "Unknown key", expired: "Session expired",
  replay: "Login reused", wrong_host: "Wrong host", full: "Arena full", bad_version: "Client out of date",
};

interface Opt { label: string; act?: () => void; href?: string }
let keyOff: (() => void) | null = null;
const typing = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

function win(card: HTMLElement, status: string, inner: string, denied = false): void {
  card.classList.toggle("denied", denied);
  card.innerHTML = `<div class="win-bar label"><span>LS-0001 · Ember Rift</span><span>${status}</span></div><div class="win-body">${inner}</div>`;
}

const foot = (o: SigninOpts, hint: string) => `<div class="win-foot mono"><span>host ${esc(o.hostLabel.toLowerCase())} · build ${esc(o.buildHash.slice(0, 8) || "—")}</span><span>${hint}</span></div>`;

/** Numbered menu: hover or digit selects (instant), click or Enter confirms. */
function menu(list: HTMLElement, opts: Opt[], back?: () => void): void {
  keyOff?.();
  let sel = 0;
  const rows = opts.map((o, i) => {
    const el = document.createElement(o.href ? "a" : "button");
    el.className = "opt";
    el.innerHTML = `<span class="k">${i + 1}</span><span>${esc(o.label)}</span><span class="go">${o.href ? "↗" : "▸"}</span>`;
    if (el instanceof HTMLAnchorElement) { el.href = o.href ?? ""; el.target = "_blank"; el.rel = "noopener"; }
    el.addEventListener("pointerenter", () => { sel = i; paint(); });
    el.addEventListener("click", () => { sel = i; paint(); if (!o.href) o.act?.(); });
    const li = document.createElement("li");
    li.appendChild(el);
    list.appendChild(li);
    return el;
  });
  const paint = () => rows.forEach((r, i) => r.classList.toggle("row-sel", i === sel));
  paint();
  const onKey = (e: KeyboardEvent) => {
    if (typing(e.target) || (document.getElementById("signin") as HTMLElement).hidden) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= rows.length) { sel = n - 1; paint(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { sel = (sel + (e.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length; paint(); }
    else if (e.key === "Enter") { e.preventDefault(); if (!(rows[sel] as HTMLButtonElement).disabled) rows[sel].click(); }
    else if (e.key === "Escape" && back) back();
  };
  window.addEventListener("keydown", onKey);
  keyOff = () => window.removeEventListener("keydown", onKey);
}

function mainScreen(o: SigninOpts, card: HTMLElement): void {
  win(card, "Ready", `<div class="eyebrow">Sign in</div><h1 class="display display-sunset">Ember<br>Rift</h1>
    <p class="lede">Sign in with the NEAR testnet account that holds your licence. One signature starts a session. Nothing is sent on-chain.</p>
    <ol class="menu"></ol><p class="err" id="err" role="alert"></p>${foot(o, "1–2 select · enter confirm")}`);
  menu($(".menu", card), [
    { label: "Connect wallet", act: () => walletScreen(o, card) },
    { label: "Practice offline", act: () => { hideSignin(); o.onPractice(); } },
  ]);
}

function walletScreen(o: SigninOpts, card: HTMLElement): void {
  win(card, "Wallet", `<div class="eyebrow">Connect wallet</div>
    <p class="lede">Pick the wallet that holds your Ember Rift licence. It signs one login message; nothing goes on-chain.</p>
    <ol class="menu"></ol><p class="err" id="err" role="alert"></p>
    <div class="actions"><button class="keycap" id="back">Back <kbd>Esc</kbd></button></div>${foot(o, "1–2 select · enter confirm")}`);
  const err = $("#err", card);
  const fresh = () => { const k = newSessionKey(); return { ...k, message: loginMessage(o.host, k.pub, Date.now() + SESSION_MS) }; };
  const busy = (on: boolean) => card.querySelectorAll("button").forEach((b) => ((b as HTMLButtonElement).disabled = on));
  const wallet = () => async () => {
    err.className = "busy mono caret";
    err.textContent = "> waiting for the wallet signature";
    busy(true);
    const k = fresh();
    try {
      const r = await walletLogin(k.message, o.contract, hex(k.secret), o.host);
      if (r === "redirect") return;
      hideSignin();
      o.onSession({ account_id: r.account_id, host: o.host, login: r, secret: k.secret });
    } catch (e) {
      err.className = "err";
      const m = e instanceof Error ? e.message : "";
      err.textContent = /reject|cancel|closed|abort/i.test(m) ? "No wallet picked. Choose one to sign in." : m || "The wallet did not sign the login.";
      busy(false);
    }
  };
  const back = () => mainScreen(o, card);
  menu($(".menu", card), [
    { label: "NEAR wallet (NEAR Connect)", act: wallet() },
    { label: "Testnet key", act: () => keyScreen(o, card) },
  ], back);
  $("#back", card).onclick = back;
}

function keyScreen(o: SigninOpts, card: HTMLElement): void {
  keyOff?.();
  win(card, "Key", `<div class="eyebrow">Testnet key</div>
    <p class="lede">The key signs one login message in this tab and is cleared right after.</p>
    <form id="keyform" autocomplete="off">
      <label class="field">Account<input id="acct" autocomplete="username" placeholder="lastsave-mira.testnet" spellcheck="false"></label>
      <label class="field">Private key (stays in this tab)<input id="pk" type="password" autocomplete="off" placeholder="ed25519:…" spellcheck="false"></label>
      <p class="err" id="err" role="alert"></p>
      <div class="actions"><button class="keycap keycap-primary" id="keysign" type="submit">Sign in <kbd>Enter</kbd></button>
        <button class="keycap" id="back" type="button">Back <kbd>Esc</kbd></button></div>
    </form>${foot(o, "enter sign in · esc back")}`);
  const err = $("#err", card);
  const back = () => walletScreen(o, card);
  $("#back", card).onclick = back;
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") back(); };
  window.addEventListener("keydown", onKey);
  keyOff = () => window.removeEventListener("keydown", onKey);
  ($("#acct", card) as HTMLInputElement).focus();
  ($("#keyform", card) as HTMLFormElement).onsubmit = (e) => {
    e.preventDefault();
    err.textContent = "";
    const account = ($("#acct", card) as HTMLInputElement).value.trim();
    const pk = ($("#pk", card) as HTMLInputElement).value.trim();
    if (!/^[a-z0-9._-]+\.testnet$/.test(account)) { err.textContent = "Enter a .testnet account id."; return; }
    try {
      const k = newSessionKey();
      const login = signLoginWithKey(account, pk, loginMessage(o.host, k.pub, Date.now() + SESSION_MS), o.contract);
      ($("#pk", card) as HTMLInputElement).value = "";
      hideSignin();
      o.onSession({ account_id: account, host: o.host, login, secret: k.secret });
    } catch (e2) { err.textContent = e2 instanceof Error ? e2.message : "Could not sign with that key."; }
  };
}

function deniedScreen(o: SigninOpts, card: HTMLElement, d: { code: DeniedCode; account?: string }): void {
  const who = d.account ? ` · <span class="acct">${esc(d.account)}</span>` : "";
  win(card, "Denied", `<div class="eyebrow">Licence check</div>
    <div class="readout" role="alert"><b>Access denied · ${DENIED_CODE[d.code]}${who}</b><p class="mono">${DENIED_TEXT[d.code]}</p></div>
    <ol class="menu"></ol>${foot(o, "digits select · enter confirm")}`, true);
  const opts: Opt[] = [{ label: "Use another account", act: () => mainScreen(o, card) }];
  if (d.code === "no_licence") opts.unshift({ label: "Get a licence", href: `${o.platformUrl}/app/store` });
  menu($(".menu", card), opts);
}

export function showSignin(o: SigninOpts, denied?: { code: DeniedCode; account?: string }): void {
  const card = document.getElementById("signincard") as HTMLElement;
  (document.getElementById("signin") as HTMLElement).hidden = false;
  if (denied) deniedScreen(o, card, denied);
  else mainScreen(o, card);
}

export function hideSignin(): void {
  keyOff?.();
  keyOff = null;
  (document.getElementById("signin") as HTMLElement).hidden = true;
}
