"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function SearchBar({
  defaultValue = "",
  size = "lg",
  className,
}: {
  defaultValue?: string;
  size?: "lg" | "md";
  className?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/browse${params.size ? `?${params}` : ""}`);
  }

  return (
    <form onSubmit={submit} className={cn("flex w-full gap-2", className)} role="search">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={'search plugins, e.g. "ai code review"…'}
        aria-label="Search plugins"
        className={cn(
          "w-full rounded-[8px] border border-line bg-white text-ink placeholder:text-faint focus-visible:outline-none focus-visible:border-ink transition-colors",
          size === "lg" ? "h-14 px-5 text-[16px]" : "h-11 px-4 text-[14px]",
        )}
      />
      <button
        type="submit"
        className={cn(
          "shrink-0 rounded-[8px] bg-volt font-semibold text-ink transition-colors hover:bg-[#b3e600] cursor-pointer",
          size === "lg" ? "h-14 px-8 text-[16px]" : "h-11 px-5 text-[14px]",
        )}
      >
        Search
      </button>
    </form>
  );
}
