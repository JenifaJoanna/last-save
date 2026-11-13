// Sign-in card: wallet (Meteor / MyNearWallet) or a pasted testnet key; plus offline practice.
import type { DeniedCode } from "../../../shared/protocol";
import { loginMessage, newSessionKey, signLoginWithKey, type Session } from "../session";
import { walletLogin, type WalletId } from "../wallet";

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

const BRAND = `<div class="signin-brand"><div class="mark"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M21 12 4 21l4-9-4-9z" fill="#0b0912"/></svg></div>
  <div><h1>EMBER RIFT</h1><p>Knock rivals into the rift. Up to 8 skiffs, 90-second matches.</p></div></div>`;

export function showSignin(o: SigninOpts, denied?: { code: DeniedCode; account?: string }): void {
  const overlay = document.getElementById("signin") as HTMLElement;
  const card = document.getElementById("signincard") as HTMLElement;
  overlay.hidden = false;
  if (denied) {
    card.innerHTML = `${BRAND}<div class="signin-body"><p><b>${esc(denied.account ?? "")}</b><br>${DENIED_TEXT[denied.code]}</p>
      <div class="stack">${denied.code === "no_licence" ? `<a class="btn block" href="${esc(o.platformUrl)}/store" target="_blank" rel="noopener">Get a licence</a>` : ""}
      <button class="btn ghost block" id="again">Use another account</button></div></div>`;
    $("#again", card).onclick = () => showSignin(o);
    return;
  }
  card.innerHTML = `${BRAND}<div class="signin-body">
    <p>Sign in with the NEAR testnet account that holds your licence. One signature starts a session. Nothing is sent on-chain.</p>
    <div class="stack">
      <button class="btn block" data-w="meteor-wallet">Sign in with Meteor Wallet</button>
      <button class="btn ghost block" data-w="my-near-wallet">Sign in with MyNearWallet</button>
    </div>
    <details class="adv"><summary>Use a testnet key instead</summary>
      <div class="stack" style="margin-top:10px">
        <label class="field">Account<input id="acct" autocomplete="username" placeholder="lastsave-mira.testnet" spellcheck="false"></label>
        <label class="field">Private key (stays in this tab)<input id="pk" type="password" autocomplete="off" placeholder="ed25519:…" spellcheck="false"></label>
        <button class="btn ghost block" id="keysign">Sign in with key</button>
      </div>
    </details>
    <p class="err" id="err" role="alert"></p>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px">
      <span class="pill">${esc(o.hostLabel)} · build ${esc(o.buildHash.slice(0, 8) || "—")}</span>
      <button class="btn ghost" id="practice" style="height:36px">Practice offline</button>
    </div></div>`;
  const err = $("#err", card);
  const busy = (on: boolean) => card.querySelectorAll("button").forEach((b) => ((b as HTMLButtonElement).disabled = on));
  const fresh = () => { const k = newSessionKey(); return { ...k, message: loginMessage(o.host, k.pub, Date.now() + SESSION_MS) }; };

  card.querySelectorAll<HTMLButtonElement>("[data-w]").forEach((b) => (b.onclick = async () => {
    err.textContent = "";
    busy(true);
    const k = fresh();
    try {
      const r = await walletLogin(b.dataset.w as WalletId, k.message, o.contract, hex(k.secret), o.host);
      if (r === "redirect") return;
      overlay.hidden = true;
      o.onSession({ account_id: r.account_id, host: o.host, login: r, secret: k.secret });
    } catch (e) {
      err.textContent = e instanceof Error ? e.message : "The wallet did not sign the login.";
      busy(false);
    }
  }));
  $("#keysign", card).onclick = () => {
    err.textContent = "";
    const account = ($("#acct", card) as HTMLInputElement).value.trim();
    const pk = ($("#pk", card) as HTMLInputElement).value.trim();
    if (!/^[a-z0-9._-]+\.testnet$/.test(account)) { err.textContent = "Enter a .testnet account id."; return; }
    try {
      const k = fresh();
      const login = signLoginWithKey(account, pk, k.message, o.contract);
      ($("#pk", card) as HTMLInputElement).value = "";
      overlay.hidden = true;
      o.onSession({ account_id: account, host: o.host, login, secret: k.secret });
    } catch (e) { err.textContent = e instanceof Error ? e.message : "Could not sign with that key."; }
  };
  $("#practice", card).onclick = () => { overlay.hidden = true; o.onPractice(); };
}

export function hideSignin(): void { (document.getElementById("signin") as HTMLElement).hidden = true; }
