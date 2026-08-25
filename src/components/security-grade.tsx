import type { Plugin, SecurityGrade } from "@/lib/types";
import { cn } from "@/lib/utils";

const GRADE_STYLES: Record<SecurityGrade, string> = {
  "A+": "bg-volt text-ink",
  A: "bg-volt-tint text-volt-deep",
  B: "bg-ink text-paper",
  C: "bg-signal/10 text-signal border border-signal/30",
  D: "bg-signal text-white",
};

const GRADE_LABELS: Record<SecurityGrade, string> = {
  "A+": "Trusted",
  A: "Safe",
  B: "Low risk",
  C: "Caution",
  D: "Blocked",
};

export function SecurityGradeBadge({
  grade,
  showLabel = false,
  className,
}: {
  grade: SecurityGrade;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[6px] px-2 py-0.5 font-mono text-[12px] font-medium",
        GRADE_STYLES[grade],
        className,
      )}
      title={`Security grade ${grade} · ${GRADE_LABELS[grade]}`}
    >
      {grade}
      {showLabel && <span className="text-[10px] tracking-wide uppercase">{GRADE_LABELS[grade]}</span>}
    </span>
  );
}

const SEVERITY_TONE: Record<string, string> = {
  critical: "text-signal",
  warning: "text-signal",
  info: "text-muted",
};

/** Detail-page security panel: grade + scan findings */
export function SecurityPanel({ plugin }: { plugin: Plugin }) {
  return (
    <div className="rounded-[12px] border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="label text-muted">SECURITY SCAN</h2>
        <SecurityGradeBadge grade={plugin.securityGrade} showLabel />
      </div>
      {plugin.securityFindings.length === 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-charcoal">
          <span className="font-mono text-volt-dark">✓</span> No findings —
          install scripts, docs URLs and publishing signals all came back clean.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {plugin.securityFindings.map((f) => (
            <li key={f.id} className="text-[12.5px] leading-relaxed text-charcoal">
              <span
                className={cn(
                  "font-mono text-[10px] uppercase tracking-wide",
                  SEVERITY_TONE[f.severity] ?? "text-muted",
                )}
              >
                {f.severity}
              </span>{" "}
              {f.message}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-faint">
        Scanned before indexing on every daily sync: install-script patterns,
        obfuscation, typosquatting, suspicious URLs, leaked secrets, star
        velocity. Grade D is never listed.
      </p>
    </div>
  );
}
