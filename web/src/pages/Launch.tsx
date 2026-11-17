// Launch your own game: one transaction from the visitor's wallet creates a licence contract through the factory (NEP-591
// global code), born locked with 0 access keys, with the visitor as studio. The enclave programs and build fields come
// from the live store's own on-chain config (the Ember Rift template). Selling needs the studio's escrowed build (CLI).
import { BadgeCheck, Rocket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Copy, Ext, Note, ScreenTitle } from "../components/ui";
import { FACTORY } from "../lib/licence";
import { accountUrl, DEFAULT_CONTRACT, near, toYocto, view } from "../lib/near";
import { useWallet } from "../lib/wallet";

type Cfg = Record<string, unknown>;
const NAME_OK = /^[a-z0-9][a-z0-9_-]{1,31}$/;
const DEMO = { probe_interval_ms: 20_000, fail_threshold: 3, receipt_window_ms: 180_000, report_window_ms: 120_000, quorum_bps: 5000 };
const REAL = { probe_interval_ms: 6 * 3600_000, fail_threshold: 4, receipt_window_ms: 72 * 3600_000, report_window_ms: 72 * 3600_000, quorum_bps: 5000 };
const field = "mono h-11 w-full border border-line-2 bg-void px-3 text-text outline-none focus:border-gold aria-[invalid=true]:border-dead";

export default function Launch() {
  const { accountId, call, pending, signIn } = useWallet();
  const [template, setTemplate] = useState<Cfg | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("0.1");
  const [demo, setDemo] = useState(true);
  const [taken, setTaken] = useState<boolean | null>(null);
  const [deposit, setDeposit] = useState<string | null>(null);
  const [done, setDone] = useState<{ account: string; keys: number | null; studio: string } | null>(null);
  useEffect(() => { view<{ config?: Cfg }>("get_info", {}, DEFAULT_CONTRACT).then((i) => setTemplate(i.config ?? null)).catch(() => setTemplate(null)); }, []);

  const account = `${name}.${FACTORY}`;
  const priceOk = Number(price) > 0 && Number(price) <= 100;
  // evm_payout is left out: its address is derived for the template store's own account, not for a new one.
  const config = useMemo(() => !template || !accountId ? null : {
    ...Object.fromEntries(Object.entries(template).filter(([k]) => k !== "evm_payout")), studio: accountId, title: title.trim() || "Untitled game", game_id: name || "game",
    price: toYocto(priceOk ? price : "0.1"), official_endpoint: `https://emberrift-${name || "game"}.pages.dev`,
    liveness: demo ? DEMO : REAL, pool: { ...(template.pool as Cfg), epoch_ms: demo ? 120_000 : 7 * 86400_000 },
  }, [template, accountId, title, name, price, priceOk, demo]);

  useEffect(() => {
    setTaken(null); setDeposit(null);
    if (!NAME_OK.test(name) || !config) return;
    const t = window.setTimeout(() => {
      view("get_info", {}, account).then(() => setTaken(true)).catch(() => setTaken(false));
      view<string>("min_deposit", { config }, FACTORY).then((d) => setDeposit(String(d))).catch(() => setDeposit(null));
    }, 400);
    return () => window.clearTimeout(t);
  }, [name, config, account]);

  const ready = !!accountId && NAME_OK.test(name) && taken === false && !!deposit && priceOk && !!config;
  const launch = async () => {
    if (!ready || !config || !deposit) return;
    const extra = (BigInt(deposit) + 10n ** 22n).toString(); // 0.01 Ⓝ float on top of the factory's own figure
    if (!(await call("create_instance", { name, config }, { receiver: FACTORY, deposit: extra, gasTgas: 300, label: "Game launched" }))) return;
    const i = await view<{ config?: Cfg }>("get_info", {}, account).catch(() => null);
    const keys = await fetch("https://near-testnet.drpc.org", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_access_key_list", finality: "final", account_id: account } }) })
      .then((r) => r.json()).then((j) => (j.result?.keys ?? []).length as number).catch(() => null);
    setDone({ account, keys, studio: String(i?.config?.studio ?? accountId) });
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-4">
      <ScreenTitle eyebrow="Launch your own game" sub="One transaction from your wallet creates your game's licence contract from the same published code as every Last Save store. It is born locked: no access keys, so nobody, you included, can change it later.">Launch a licence contract</ScreenTitle>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card eyebrow="Your game" title={done ? "Launched" : "Name, price, timers"}>
          {done ? (
            <div className="grid gap-3 text-[14px]">
              <p className="flex items-center gap-2 text-alive"><BadgeCheck className="size-5" />{done.account} is live on NEAR testnet.</p>
              <ul className="grid gap-1 text-muted">
                <li>Studio: <span className="mono text-text">{done.studio}</span></li>
                <li>Access keys on the contract: <span className="num text-text">{done.keys ?? "…"}</span>{done.keys === 0 ? " (locked)" : ""}</li>
                <li>Listed by the factory: <Ext href={accountUrl(FACTORY)}>{FACTORY}</Ext></li>
              </ul>
              <a href={`/status?instance=${name}`} className="label text-[12px] text-cyan no-underline hover:underline">Open its licence status ▸</a>
            </div>
          ) : (
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm text-muted">Contract name
                <input value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder="my-game" spellCheck={false} className={field} aria-invalid={name !== "" && (!NAME_OK.test(name) || taken === true)} />
                <span className="mono break-all text-[12px] text-faint">{name ? account : `<name>.${FACTORY}`}</span>
                {name !== "" && !NAME_OK.test(name) && <span className="text-[12px] text-dead" role="alert">2 to 32 characters: a-z, 0-9, - or _.</span>}
                {taken === true && <span className="text-[12px] text-dead" role="alert">That name is taken. Pick another.</span>}
              </label>
              <label className="grid gap-1.5 text-sm text-muted">Game title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled game" className={field} /></label>
              <label className="grid gap-1.5 text-sm text-muted">Licence price (Ⓝ)<input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={field} aria-invalid={!priceOk} /></label>
              <fieldset className="grid gap-1.5 text-sm text-muted"><legend className="mb-1.5">Liveness timers</legend>
                <label className="flex items-center gap-2"><input type="radio" checked={demo} onChange={() => setDemo(true)} />Seconds: try the whole lifecycle today</label>
                <label className="flex items-center gap-2"><input type="radio" checked={!demo} onChange={() => setDemo(false)} />Real: probes hours apart, reports over 72 h</label>
              </fieldset>
              {!accountId
                ? <Button onClick={() => signIn()}><Rocket className="size-4" />Connect a wallet to launch</Button>
                : <Button onClick={launch} disabled={!ready} loading={pending === "create_instance"}><Rocket className="size-4" />Launch{deposit ? ` · ${near(deposit)} Ⓝ deposit` : ""}</Button>}
              <p className="text-[12px] text-faint">The deposit pays the contract's storage, as the factory computes it from your settings. It stays with your contract.</p>
            </div>
          )}
        </Card>
        <Card eyebrow="What you get, and what comes next" title="Born locked, listed, honest">
          <ul className="grid gap-2 text-[13.5px] text-muted">
            <li><b className="text-text">One transaction</b> through <span className="mono">{FACTORY}</span>, using the published global code every store runs.</li>
            <li><b className="text-text">0 access keys</b> from the first block: the escrow, prices and rules can never be swapped.</li>
            <li><b className="text-text">The enclave programs</b> (release and probe) are the same pinned builds as the live store.</li>
            <li><b className="text-text">Not on sale yet.</b> Selling starts once your encrypted server build and its key are escrowed in OutLayer. The studio CLI builds, escrows and launches in one run:</li>
          </ul>
          <div className="mt-3"><Copy text="pnpm studio:launch" /></div>
          {!template && <div className="mt-3"><Note tone="dead">Could not read the template from the live store. Retrying when you reload.</Note></div>}
        </Card>
      </div>
    </div>
  );
}
