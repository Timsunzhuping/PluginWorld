import type { Plugin } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Quality score badge: >=75 live (volt), >=50 normal, <50 weak */
export function ScoreBadge({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const tone =
    score >= 75
      ? "bg-volt text-ink"
      : score >= 50
        ? "bg-ink text-paper"
        : "bg-line text-muted";
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-[6px] px-1.5 font-mono text-[13px] font-medium",
        tone,
        className,
      )}
      title={`Unified quality score ${score}/100`}
    >
      {Math.round(score)}
    </span>
  );
}

const DIMENSIONS = [
  ["maintenance", "Maintenance", 30],
  ["popularity", "Popularity", 25],
  ["compliance", "Compliance", 20],
  ["security", "Security", 15],
  ["docs", "Docs", 10],
] as const;

/** Per-dimension score bars on the detail page (spec §5) */
export function ScoreBars({ plugin }: { plugin: Plugin }) {
  return (
    <div className="space-y-2.5">
      {DIMENSIONS.map(([key, label, max]) => {
        const value = plugin.scoreBreakdown[key];
        const pct = Math.min(100, (value / max) * 100);
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[12px] text-muted">{label}</span>
            <div className="h-1.5 flex-1 rounded-full bg-line/70 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  pct >= 70 ? "bg-volt-dark" : pct >= 35 ? "bg-charcoal" : "bg-faint",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-muted">
              {value}/{max}
            </span>
          </div>
        );
      })}
    </div>
  );
}
