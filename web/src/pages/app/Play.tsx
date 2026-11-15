// Play: pick a server. Official while the studio lives; community hosts registered on-chain after release.
import { Gamepad2, Radio, Server, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, LinkButton, Note, ScreenTitle, Skeleton, StatusBadge } from "../../components/ui";
import { useHosts, useInfo } from "../../lib/licence";
import { OFFICIAL_URL, shortAcct } from "../../lib/near";
import { PLAY_URL } from "../Landing";
import { PREVIEW } from "../../preview/store";

interface Health { ok: boolean; players: number | null; ms: number | null }

function useHealth(url: string): Health | null {
  const [h, setH] = useState<Health | null>(null);
  const dead = useInfo(6000).data?.status === "Dead";
  useEffect(() => {
    if (PREVIEW) { const off = url.includes("emberrift.pages.dev") && dead; setH(off ? { ok: false, players: null, ms: null } : { ok: true, players: url.includes("community") ? 3 : 4, ms: url.includes("community") ? 48 : 31 }); return; }
    if (!url) { setH({ ok: false, players: null, ms: null }); return; }
    let alive = true;
    const run = async () => {
      const t0 = performance.now();
      try {
        const ctrl = new AbortController();
        const to = window.setTimeout(() => ctrl.abort(), 5000);
        const r = await fetch(`${url.replace(/\/$/, "")}/health`, { signal: ctrl.signal, cache: "no-store" });
        window.clearTimeout(to);
        const j = await r.json().catch(() => ({}));
        if (alive) setH({ ok: r.ok && j?.ok !== false, players: typeof j?.players_online === "number" ? j.players_online : null, ms: Math.round(performance.now() - t0) });
      } catch { if (alive) setH({ ok: false, players: null, ms: null }); }
    };
    void run();
    const t = window.setInterval(run, 8000);
    return () => { alive = false; window.clearInterval(t); };
  }, [url, dead]);
  return h;
}

function ServerRow({ name, kind, url }: { name: string; kind: "official" | "community"; url: string }) {
  const h = useHealth(url);
  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4">
      <span className={`grid size-10 place-items-center border border-line-2 bg-ink-2 ${kind === "official" ? "text-ember" : "text-cyan"}`}>{kind === "official" ? <Radio className="size-5" /> : <Server className="size-5" />}</span>
      <div className="min-w-[12rem] flex-1">
        <p className="label text-[13px]">{name}</p>
        <p className="mono break-all text-muted" title={url || undefined}>{url || "no endpoint"}</p>
      </div>
      <div className="text-right text-sm">
        {!h ? <Skeleton className="h-4 w-20" /> : h.ok
          ? <span className="text-alive">Online{h.players !== null ? ` · ${h.players} playing` : ""}{h.ms !== null ? ` · ${h.ms} ms` : ""}</span>
          : <span className="inline-flex items-center gap-1.5 text-dead"><WifiOff className="size-4" />Unreachable</span>}
      </div>
      <LinkButton href={PREVIEW ? `${PLAY_URL}?practice=1` : `${PLAY_URL}?server=${encodeURIComponent(url)}`} external size="sm" variant={h?.ok ? "primary" : "ghost"}><Gamepad2 className="size-4" />Play</LinkButton>
    </li>
  );
}

export default function Play() {
  const info = useInfo(6000);
  const hosts = useHosts(8000);
  const d = info.data;
  const official = d?.officialEndpoint || OFFICIAL_URL;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ScreenTitle eyebrow="Choose a server">Play</ScreenTitle>
        {d && <StatusBadge status={d.status} released={!!d.releasedKey} />}
      </div>
      <p data-print className="max-w-2xl text-[13px] text-muted">Every server checks your licence when you sign in and restores the same progress from the on-chain snapshot. The game opens in a new tab and asks your wallet for one signature.</p>
      <Card className="mt-6 !p-0">
        <ul className="divide-y divide-line">
          {!d ? <li className="p-5"><Skeleton className="h-10 w-full" /></li> : <ServerRow name={d.status === "Dead" ? "Official server (studio gone dark)" : "Official server · Kiln Interactive"} kind="official" url={official} />}
          {(hosts.data ?? []).map((h) => <ServerRow key={h.hostId} name={`Community host · ${shortAcct(h.hostId)}`} kind="community" url={h.endpoint} />)}
        </ul>
      </Card>
      {d && d.status === "Alive" && (hosts.data?.length ?? 0) === 0 && <div className="mt-4"><Note>Community hosts appear here after a release. Until then the studio runs the only server.</Note></div>}
      {d && d.status === "Dead" && (hosts.data?.length ?? 0) === 0 && <div className="mt-4"><Note tone="gold">No community host has registered yet. Anyone can host with one command from the Community hosts page.</Note></div>}
    </div>
  );
}
