import type { Plugin } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 质量评分徽章：≥75 接通（volt）、≥50 常规、<50 弱 */
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
      title={`统一质量评分 ${score}/100`}
    >
      {Math.round(score)}
    </span>
  );
}

const DIMENSIONS = [
  ["maintenance", "维护度", 30],
  ["popularity", "流行度", 25],
  ["compliance", "规范合规", 20],
  ["security", "安全", 15],
  ["docs", "文档", 10],
] as const;

/** 详情页分项评分条（§5：每个维度独立展示） */
export function ScoreBars({ plugin }: { plugin: Plugin }) {
  return (
    <div className="space-y-2.5">
      {DIMENSIONS.map(([key, label, max]) => {
        const value = plugin.scoreBreakdown[key];
        const pct = Math.min(100, (value / max) * 100);
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-[12px] text-muted">{label}</span>
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
