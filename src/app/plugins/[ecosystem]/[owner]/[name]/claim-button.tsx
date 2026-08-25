"use client";

import { useState } from "react";

/** 开发者认领（Phase 3）：GitHub 登录后，owner 本人可认领插件 */
export function ClaimButton({
  slug,
  ownerGithub,
  sessionLogin,
  claimed,
}: {
  slug: string;
  ownerGithub: string | null;
  sessionLogin: string | null;
  claimed: boolean;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    claimed ? "done" : "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  if (!ownerGithub) return null;
  const isOwner =
    sessionLogin !== null &&
    sessionLogin.toLowerCase() === ownerGithub.toLowerCase();

  async function claim() {
    setState("busy");
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const body = await res.json();
      if (res.ok) {
        setState("done");
        setMessage(body.message ?? null);
      } else {
        setState("error");
        setMessage(body.error ?? "认领失败");
      }
    } catch {
      setState("error");
      setMessage("网络错误，请重试");
    }
  }

  return (
    <div className="rounded-[12px] border border-line bg-white p-5">
      <h2 className="label text-muted">OWNER</h2>
      {state === "done" ? (
        <p className="mt-3 font-mono text-[12px] text-volt-dark">
          ✓ VERIFIED OWNER · @{ownerGithub}
        </p>
      ) : isOwner ? (
        <>
          <p className="mt-3 text-[13px] leading-relaxed text-charcoal">
            你是 @{ownerGithub}，认领后获得 verified owner 标识，提升安全评分。
          </p>
          <button
            onClick={claim}
            disabled={state === "busy"}
            className="mt-3 w-full cursor-pointer rounded-[8px] bg-ink px-4 py-2.5 text-[13.5px] font-medium text-paper transition-colors hover:bg-charcoal disabled:opacity-50"
          >
            {state === "busy" ? "认领中…" : "认领这个插件"}
          </button>
        </>
      ) : (
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          这是你的插件？使用 GitHub 账号 @{ownerGithub} 登录后即可认领。
        </p>
      )}
      {message && state === "error" && (
        <p className="mt-2 text-[12px] text-signal">{message}</p>
      )}
      {message && state === "done" && (
        <p className="mt-2 text-[12px] text-muted">{message}</p>
      )}
    </div>
  );
}
