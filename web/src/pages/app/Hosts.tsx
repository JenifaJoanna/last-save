// Community hosts: one-command host console, on-chain registration, epoch claims, payouts.
import { Coins, Download, KeyRound, Link2, ServerCog, ShieldCheck, Upload } from "lucide-react";
import { useState } from "react";
import { Button, Card, Copy, Note, Skeleton } from "../../components/ui";
import { useHosts, useInfo } from "../../lib/licence";
import { accountUrl, ago, duration, near, shortAcct, shortHash, toYocto } from "../../lib/near";
import { useWallet } from "../../lib/wallet";
import { EvmPayouts } from "./evm-payouts";

const CMD = `git clone https://github.com/JenifaJoanna/last-save && cd last-save
pnpm install
pnpm host --local --account <your-account>.testnet`;

const STEPS = [
  { icon: KeyRound, t: "Reads the released key and the committed artifact hash from the licence contract" },
  { icon: Download, t: "Downloads the encrypted server build and refuses it if one byte differs" },
  { icon: ShieldCheck, t: "Decrypts it, checks the build hash, restores the last on-chain progress snapshot" },
  { icon: Upload, t: "Runs the server with a public URL and registers it on-chain as a host" },
];

export default function Hosts() {
  const { accountId, call, pending, gasless: GASLESS } = useWallet();
  const info = useInfo(5000);
  const hosts = useHosts(6000);
  const d = info.data;
  const released = !!d?.releasedKey;
  const mineHost = hosts.data?.find((h) => h.hostId === accountId);
  const [endpoint, setEndpoint] = useState("");
  const [pubkey, setPubkey] = useState("");
  const [epoch, setEpoch] = useState("");
  const lastDone = d?.currentEpoch !== null && d?.currentEpoch !== undefined ? Math.max(0, d.currentEpoch - 1) : null;

  const register = async () => {
    if (!/^https:\/\/.+/.test(endpoint)) return;
    if (await call("register_host", { endpoint: endpoint.trim().replace(/\/$/, ""), host_pubkey: pubkey.trim() || "none" }, { deposit: toYocto("0.01"), gasTgas: 60, label: "Host registered" })) hosts.refresh();
  };
  const claim = async () => {
    const e = epoch === "" ? lastDone : Number(epoch);
    if (e === null || !Number.isInteger(e) || e < 0) return;
    if (await call("claim_epoch", { epoch: e }, { deposit: GASLESS ? "0" : toYocto("0.02"), gasTgas: 300, label: `Epoch ${e} claimed` })) { hosts.refresh(); info.refresh(); }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Community hosts</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Host Ember Rift, get paid per real player</h1>
      <p className="mt-3 max-w-2xl text-muted">After a release anyone can run the official server build. The pool pays hosts for each licence holder they serve, proven by sessions the players sign themselves and checked in an enclave.</p>
      {d && !released && <div className="mt-5"><Note>Hosting opens when the server is released. Today the studio still runs it ({d.status}).</Note></div>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card eyebrow="One command" title="Run a host">
          <div className="relative rounded-xl border border-line bg-ink p-4">
            <pre className="mono overflow-x-auto whitespace-pre pr-20 text-[13px] leading-relaxed text-text">{CMD}</pre>
            <div className="absolute right-2 top-2"><Copy text={CMD} label="copy" /></div>
          </div>
          <ol className="mt-5 grid gap-3">
            {STEPS.map((s, i) => (
              <li key={s.t} className="flex gap-3 text-[15px] text-muted"><span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-ink-2 text-xs text-text">{i + 1}</span><s.icon className="mt-1 size-4 shrink-0 text-cyan" /><span>{s.t}</span></li>
            ))}
          </ol>
        </Card>
        <div className="grid content-start gap-4">
          <Card eyebrow="The pool" title={d ? `${near(d.pool)} Ⓝ available` : "Keep-alive pool"}>
            {!d ? <Skeleton className="h-16" /> : (
              <ul className="grid gap-2 text-sm text-muted">
                <li className="flex justify-between"><span>Per verified holder session</span><b className="num text-text">{near(d.payPerSession)} Ⓝ</b></li>
                <li className="flex justify-between"><span>Cap per host per epoch</span><b className="num text-text">{near(d.epochCap)} Ⓝ</b></li>
                <li className="flex justify-between"><span>Epoch length</span><b className="text-text">{duration(d.epochMs)}</b></li>
                <li className="flex justify-between"><span>Current epoch</span><b className="num text-text">{d.currentEpoch ?? "—"}</b></li>
              </ul>
            )}
          </Card>
          <Card eyebrow={mineHost ? "Your host" : "Register by hand"} title={mineHost ? shortAcct(mineHost.hostId) : "Already running a server?"}>
            {mineHost ? (
              <div className="grid gap-3">
                <p className="mono truncate text-sm text-muted">{mineHost.endpoint}</p>
                <p className="text-sm text-muted">{mineHost.sessionsPaid} sessions paid · <b className="text-alive">{near(mineHost.earned)} Ⓝ</b> earned</p>
                <label className="grid gap-1.5 text-sm text-muted">Epoch to claim
                  <input value={epoch} onChange={(e) => setEpoch(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={lastDone !== null ? `${lastDone} (last completed)` : "—"}
                    className="h-11 rounded-xl border border-line bg-white/[0.03] px-3 text-text outline-none focus:border-ember/60" />
                </label>
                <Button onClick={claim} loading={pending === "claim_epoch"} disabled={!released}><Coins className="size-4" />Claim epoch{GASLESS ? " · gas-free" : ""}</Button>
              </div>
            ) : (
              <div className="grid gap-3">
                <label className="grid gap-1.5 text-sm text-muted">Public endpoint
                  <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://your-host.trycloudflare.com" spellCheck={false}
                    className="h-11 rounded-xl border border-line bg-white/[0.03] px-3 text-text outline-none focus:border-ember/60" />
                </label>
                <label className="grid gap-1.5 text-sm text-muted">Host public key (optional)
                  <input value={pubkey} onChange={(e) => setPubkey(e.target.value)} placeholder="ed25519:…" spellCheck={false}
                    className="h-11 rounded-xl border border-line bg-white/[0.03] px-3 text-text outline-none focus:border-ember/60" />
                </label>
                <Button onClick={register} loading={pending === "register_host"} disabled={!released || !accountId || !/^https:\/\/.+/.test(endpoint)}><Link2 className="size-4" />Register host (0.01 Ⓝ)</Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-4 !p-0" title={<span className="px-6 pt-6 inline-flex items-center gap-2"><ServerCog className="size-5 text-cyan" />Registered hosts</span>}>
        {hosts.loading ? <div className="p-6"><Skeleton className="h-12" /></div> : (hosts.data ?? []).length === 0 ? <p className="px-6 pb-6 text-sm text-muted">No hosts registered yet.</p> : (
          <ul className="divide-y divide-line">
            {(hosts.data ?? []).map((h) => (
              <li key={h.hostId} className="grid gap-2 px-6 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
                <span className="min-w-0"><a href={accountUrl(h.hostId)} target="_blank" rel="noopener" className="font-medium no-underline hover:underline">{h.hostId}</a><span className="mono block truncate text-faint">{h.endpoint}</span></span>
                <span className="text-sm text-muted">{h.epochsPaid} {h.epochsPaid === 1 ? "epoch" : "epochs"} · {h.sessionsPaid} sessions · since {ago(h.registeredAt)}{h.payoutEvm && <span className="ml-2 rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-[11px] font-semibold text-cyan">pays out on Base · <span className="mono">{shortHash(h.payoutEvm, 4)}</span></span>}</span>
                <span className="num text-lg font-semibold text-alive">{near(h.earned)} Ⓝ</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <EvmPayouts mine={mineHost} />
    </div>
  );
}
