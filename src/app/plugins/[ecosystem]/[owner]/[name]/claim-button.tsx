"use client";

import { useState } from "react";

/** Developer claim (Phase 3): repo owner can claim after GitHub sign-in */
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
        setMessage(body.error ?? "Claim failed");
      }
    } catch {
      setState("error");
      setMessage("Network error — please retry");
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
            You&apos;re @{ownerGithub}. Claim to get the verified owner badge and boost the security score.
          </p>
          <button
            onClick={claim}
            disabled={state === "busy"}
            className="mt-3 w-full cursor-pointer rounded-[8px] bg-ink px-4 py-2.5 text-[13.5px] font-medium text-paper transition-colors hover:bg-charcoal disabled:opacity-50"
          >
            {state === "busy" ? "Claiming…" : "Claim this plugin"}
          </button>
        </>
      ) : (
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Is this your plugin? Sign in with GitHub as @{ownerGithub} to claim it.
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
