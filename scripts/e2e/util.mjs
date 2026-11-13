// Small shared helpers for the end-to-end run: logging, time, balances, sanitized environment.
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { accountState, NEAR } from "../lib/near.mjs";

/** The developer shell PATH may hold fleet-control scripts (ar/as/al/alr); every process we start gets this fixed PATH instead. */
export function sanitizePath() {
  const home = process.env.HOME ?? "";
  const path = ["/usr/bin", "/bin", "/usr/sbin", "/sbin", "/opt/homebrew/bin", `${home}/.cargo/bin`, dirname(process.execPath)].join(":");
  process.env.PATH = path;
  return path;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const sha256Hex = (buf) => createHash("sha256").update(buf).digest("hex");
export const nowIso = () => new Date().toISOString();

export function log(msg) {
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}Z] ${msg}\n`);
}

/** yoctoNEAR (bigint or decimal string) as a short NEAR string, 4 decimals, signed. */
export function fmtN(y) {
  const v = BigInt(y);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / 10n ** 24n;
  const frac = ((abs % 10n ** 24n) / 10n ** 20n).toString().padStart(4, "0");
  return `${neg ? "-" : ""}${whole}.${frac} N`;
}
export const N = (x) => NEAR(x);

export async function balance(id) {
  const s = await accountState(id);
  return s ? BigInt(s.amount) : 0n;
}

/** Text of a tx failure (or "") for matching panic messages. */
export function failText(r) {
  if (!r?.failure) return "";
  try { return JSON.stringify(r.failure); } catch { return String(r.failure); }
}
/**
 * True when the tx was refused. A release build of the contract aborts `require!` with a bare `unreachable` trap and no message
 * (near-sdk drops panic text outside debug builds), so a trap counts as a refusal and the reason is confirmed by state instead.
 */
export const refusedWith = (r, re) => Boolean(r?.failure) && (re.test(failText(r)) || /unreachable/.test(failText(r)));
export const reasonShown = (r, re) => re.test(failText(r));

export const absDiff = (a, b) => (a > b ? a - b : b - a);

/** Reads KEY=VALUE pairs of a dotenv-style file into a plain object (values never logged). */
export async function readEnvFile(path) {
  const { readFileSync, existsSync } = await import("node:fs");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

export async function getJson(url, ms = 8000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: "application/json" } });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, ok: res.ok, body, text: text.slice(0, 200) };
}
