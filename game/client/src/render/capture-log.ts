// Film capture only. With `?capture` in the page URL, the client keeps the times of the impacts it actually renders
// (the same ones that trigger hit-stop and the camera punch), so a recording can be cut on real hits. Without the flag
// nothing is kept or exposed. Times are performance.now() seconds; the capture tool subtracts its own record start.
import type { GameEvent } from "../../../shared/protocol";

export type CaptureKind = "hit" | "kill" | "shard" | "dash";
export interface CaptureEntry { t: number; kind: CaptureKind }

const enabled = typeof location !== "undefined" && new URLSearchParams(location.search).has("capture");
const entries: CaptureEntry[] = [];
if (enabled) (window as unknown as { __lsCapture?: { events: CaptureEntry[] } }).__lsCapture = { events: entries };

function kindOf(e: GameEvent, ownId: string | null): CaptureKind | null {
  switch (e.k) {
    case "hit": return e.a === ownId || e.b === ownId || Math.min(1, e.power / 900) > 0.55 ? "hit" : null;
    case "ko": return "kill";
    case "collect": return e.id === ownId ? "shard" : null;
    case "dash": return e.id === ownId ? "dash" : null;
    default: return null;
  }
}

export function captureEvents(events: GameEvent[], ownId: string | null): void {
  if (!enabled) return;
  const t = Math.round(performance.now()) / 1000;
  for (const e of events) {
    const kind = kindOf(e, ownId);
    if (kind) entries.push({ t, kind });
  }
  if (entries.length > 5000) entries.splice(0, entries.length - 5000);
}
