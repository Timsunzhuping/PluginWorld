import { ECOSYSTEM_META, type Ecosystem } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<Ecosystem, string> = {
  dsh: "bg-volt-tint text-volt-deep border-transparent",
  "claude-code": "bg-signal/10 text-signal border-transparent",
  mcp: "bg-paper text-charcoal border-line",
  skills: "bg-ink text-volt border-transparent",
};

export function EcosystemBadge({
  ecosystem,
  className,
}: {
  ecosystem: Ecosystem;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] leading-5 tracking-wide",
        STYLES[ecosystem],
        className,
      )}
    >
      {ECOSYSTEM_META[ecosystem].label}
    </span>
  );
}
