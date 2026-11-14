// Terminal event log, adapted from ReUI's deployment-log timeline block onto the ReUI Timeline primitive:
// square status indicators on a dotted rail, uppercase event names, bracketed outcome chips, mono details.
import { Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "@/components/reui/timeline";
import { cn } from "@/lib/utils";

export type LogTone = "ok" | "fail" | "warn" | "info" | "gold";
export interface LogEntry { id: string; title: string; outcome?: string; detail?: string; when?: string; tone: LogTone }
const DOT: Record<LogTone, string> = { ok: "bg-alive", fail: "bg-dead", warn: "bg-amber", info: "bg-faint", gold: "bg-gold" };
const CHIP: Record<LogTone, string> = { ok: "text-alive border-alive/50", fail: "text-dead border-dead/60", warn: "text-amber border-amber/60", info: "text-muted border-line-2", gold: "text-gold border-gold/60" };

export function LogTimeline({ entries, className = "" }: { entries: LogEntry[]; className?: string }) {
  return (
    <Timeline value={entries.length} className={className}>
      {entries.map((e, i) => (
        <TimelineItem key={e.id} step={i + 1} className="group-data-[orientation=vertical]/timeline:ms-7">
          <TimelineHeader>
            <TimelineSeparator className="!w-px !bg-[repeating-linear-gradient(180deg,var(--color-line-2)_0_3px,transparent_3px_6px)] group-data-[orientation=vertical]/timeline:-left-5 group-data-[orientation=vertical]/timeline:h-[calc(100%-1rem)] group-data-[orientation=vertical]/timeline:translate-y-4" />
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <TimelineTitle className="label text-[12px] text-text">{e.title}</TimelineTitle>
              {e.outcome && <span className={cn("label border px-1.5 text-[10px] leading-4", CHIP[e.tone])}>{e.outcome}</span>}
            </div>
            <TimelineIndicator className={cn("!size-2.5 !rounded-none !border-0 group-data-[orientation=vertical]/timeline:-left-6", DOT[e.tone], i === 0 && "blink")} />
          </TimelineHeader>
          <TimelineContent className="!text-[12.5px] text-muted">
            {e.detail && <span className="mono block truncate">{e.detail}</span>}
            {e.when && <TimelineDate className="!mb-0 !mt-0.5 text-[11px] text-faint">{e.when}</TimelineDate>}
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
}
