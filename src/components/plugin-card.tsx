import Link from "next/link";
import type { Plugin } from "@/lib/types";
import { avatarText, formatCount } from "@/lib/utils";
import { EcosystemBadge } from "./ecosystem-badge";
import { ScoreBadge } from "./score-badge";

/**
 * PLUGIN CARD · core brand component
 * Letter avatar + name + version · license + description + ▲ stats + Install
 */
export function PluginCard({ plugin }: { plugin: Plugin }) {
  const count = plugin.downloads > 0 ? plugin.downloads : plugin.stars;
  const countLabel = plugin.downloads > 0 ? "installs" : "stars";
  return (
    <Link
      href={`/plugins/${plugin.slug}`}
      className="group flex flex-col rounded-[12px] border border-line bg-white p-5 transition-colors hover:border-ink"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-ink font-mono text-[15px] text-volt">
            {avatarText(plugin.name)}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-[15px] leading-tight text-ink group-hover:underline underline-offset-2">
              {plugin.name}
            </h3>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
              {plugin.versionLatest ? `v${plugin.versionLatest.replace(/^v/, "")}` : "—"}
              {" · "}
              {plugin.license ?? "no license"}
            </p>
          </div>
        </div>
        <ScoreBadge score={plugin.qualityScore} />
      </div>

      <p className="mt-3 line-clamp-2 flex-1 text-[13.5px] leading-relaxed text-charcoal">
        {plugin.description ?? "No description yet."}
      </p>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <EcosystemBadge ecosystem={plugin.ecosystem} />
          {plugin.trustFlags.specValid && (
            <span className="hidden sm:inline font-mono text-[11px] text-volt-dark">
              verified
            </span>
          )}
        </div>
        <span className="shrink-0 font-mono text-[12px] text-charcoal">
          <span className="text-volt-dark">▲</span> {formatCount(count)}{" "}
          <span className="text-faint">{countLabel}</span>
        </span>
      </div>
    </Link>
  );
}
