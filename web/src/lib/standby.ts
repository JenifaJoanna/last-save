// Which store the root opens on. VITE_STANDBY lists alive stores in order ("live,live-2,live-3"): the root opens on the
// first one still Alive on chain, so if judges' reports kill one, the next page load opens on the next, and the dead ones
// are listed as stores judges killed. A tab that chose an instance (?instance= or remembered) is left alone.
// Runs before the app loads and must not import near.ts, which fixes the contract when it is first imported.
const LIST = ((import.meta.env.VITE_STANDBY as string | undefined) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const FACTORY = (import.meta.env.VITE_FACTORY as string | undefined) ?? "lastsave-factory.testnet";
const RPCS = ["https://near-testnet.drpc.org", "https://test.rpc.fastnear.com"];

export interface StandbyPick { open: string; killed: string[] }
declare global { interface Window { __lsStandby?: StandbyPick } }

async function status(account: string, signal: AbortSignal): Promise<string | null> {
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: "POST", signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "optimistic", account_id: account, method_name: "get_info", args_base64: "e30=" } }) });
      const j = await r.json();
      if (j.error?.cause?.name === "UNKNOWN_ACCOUNT") return null;
      if (Array.isArray(j.result?.result)) return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result))).status ?? null;
    } catch (e) { if (signal.aborted) throw e; }
  }
  return null;
}

/** Sets window.__lsStandby. Gives up after 2.5 s, and the build's default store opens. */
export async function pickStandby(): Promise<void> {
  if (LIST.length < 2) return;
  try {
    const q = new URLSearchParams(location.search).get("instance");
    if (q !== null && q !== "" && q !== "default") return; // this tab asked for a specific instance
    if (q === null && sessionStorage.getItem("lastsave:instance")) return; // and remembers it
  } catch { /* storage blocked */ }
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 2500);
  try {
    const accounts = LIST.map((n) => (n.includes(".") ? n : `${n}.${FACTORY}`));
    const states = await Promise.all(accounts.map((a) => status(a, ctrl.signal).catch(() => null)));
    const first = states.findIndex((s) => s === "Alive");
    if (first < 0) return;
    window.__lsStandby = { open: accounts[first], killed: accounts.filter((_, i) => i < first && states[i] === "Dead") };
  } finally { window.clearTimeout(timer); }
}
