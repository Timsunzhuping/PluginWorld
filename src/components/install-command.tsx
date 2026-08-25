"use client";

import { useState } from "react";
import type { InstallOption } from "@/lib/install";
import { cn } from "@/lib/utils";

/** 安装命令块：多方式 tab + 一键复制（复制即「接入」埋点） */
export function InstallCommand({
  options,
  slug,
}: {
  options: InstallOption[];
  slug: string;
}) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  if (options.length === 0) return null;
  const current = options[Math.min(active, options.length - 1)];

  async function copy() {
    try {
      await navigator.clipboard.writeText(current.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      // install-copy 埋点（events 表，算 trending；demo 模式为 no-op）
      fetch("/api/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, kind: "install-copy" }),
      }).catch(() => {});
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-ink">
      <div className="flex items-center justify-between border-b border-line-dark px-4">
        <div className="flex gap-1">
          {options.map((opt, i) => (
            <button
              key={opt.label}
              onClick={() => setActive(i)}
              className={cn(
                "cursor-pointer border-b-2 px-3 py-2.5 font-mono text-[12px] tracking-wide transition-colors",
                i === active
                  ? "border-volt text-volt"
                  : "border-transparent text-faint hover:text-paper",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          className={cn(
            "cursor-pointer rounded-[6px] px-3 py-1 font-mono text-[11px] tracking-wide transition-colors",
            copied ? "bg-volt text-ink" : "text-faint hover:text-paper",
          )}
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-relaxed text-paper">
        <code>{current.command}</code>
      </pre>
      {current.note && (
        <p className="border-t border-line-dark px-5 py-2.5 text-[12px] text-faint">
          {current.note}
        </p>
      )}
    </div>
  );
}
