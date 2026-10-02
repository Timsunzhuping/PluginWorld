import type { Metadata } from "next";
import { ECOSYSTEM_META } from "@/lib/types";

export const metadata: Metadata = {
  title: "Submit — List Your Plugin",
  description:
    "Add the ecosystem topic to your repo — PluginWorld indexes, validates and scores it automatically every 6 hours. No signup.",
  alternates: { canonical: "/submit" },
};

const STEPS: {
  eco: keyof typeof ECOSYSTEM_META;
  topic: string;
  extra: string;
}[] = [
  {
    eco: "dsh",
    topic: "dsh-plugin",
    extra:
      "Publish as an npm package (package.json with a dsh/cordis signal) to earn full compliance score.",
  },
  {
    eco: "claude-code",
    topic: "claude-code-plugin",
    extra:
      "Ship .claude-plugin/plugin.json (or marketplace.json) at the repo root.",
  },
  {
    eco: "mcp",
    topic: "mcp-server",
    extra:
      "Also publish to the official MCP Registry (server.json) to earn the registry-verified badge.",
  },
  {
    eco: "skills",
    topic: "skills.sh",
    extra:
      "Ship SKILL.md (name + description frontmatter) in your repo and list it on skills.sh — we sync the top skills daily.",
  },
];

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <p className="label text-muted">SUBMIT</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.01em] text-ink sm:text-4xl">
        List your plugin
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        PluginWorld doesn&apos;t rely on manual submissions. The indexing
        pipeline crawls GitHub topics and the official MCP Registry every 6
        hours, validating each repo against its ecosystem spec, scanning
        install scripts and computing a quality score. You only need to do one
        thing:
      </p>

      <div className="mt-8 rounded-[12px] bg-ink p-6">
        <p className="label text-faint">ONE STEP</p>
        <p className="mt-2 text-[15px] leading-relaxed text-paper">
          Add the ecosystem topic under your GitHub repo&apos;s{" "}
          <span className="font-mono text-volt">About → Topics</span> — the
          next sync picks it up automatically.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {STEPS.map((step) => (
          <div key={step.eco} className="rounded-[12px] border border-line bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">
                {ECOSYSTEM_META[step.eco].full}
              </h2>
              <code className="rounded-[6px] bg-volt-tint px-3 py-1 font-mono text-[13px] text-volt-deep">
                topic: {step.topic}
              </code>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">{step.extra}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-bold text-ink">Raise your quality score</h2>
      <ul className="mt-4 space-y-2.5 text-[14.5px] leading-relaxed text-charcoal">
        <li className="flex gap-3">
          <span className="font-mono text-volt-dark">01</span>
          Stay active: a commit within 30 days earns full maintenance score,
          decaying with a 180-day half-life after that.
        </li>
        <li className="flex gap-3">
          <span className="font-mono text-volt-dark">02</span>
          Ship a compliant manifest: passing the official ecosystem schema earns
          the full 20 compliance points.
        </li>
        <li className="flex gap-3">
          <span className="font-mono text-volt-dark">03</span>
          Declare a license, avoid suspicious install scripts and claim your
          repo to max out the 15 security points.
        </li>
        <li className="flex gap-3">
          <span className="font-mono text-volt-dark">04</span>
          Write a structured README with code examples for the 10 docs points.
        </li>
      </ul>

      <h2 className="mt-12 text-xl font-bold text-ink">Already indexed? Claim it</h2>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        Sign in with GitHub and hit &ldquo;Claim this plugin&rdquo; on your
        plugin&apos;s page to get the verified owner badge — it directly boosts
        your security score.
      </p>

      <h2 className="mt-12 text-xl font-bold text-ink">
        Wrong listing / report a malicious plugin
      </h2>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        Email{" "}
        <a
          href="mailto:report@pluginworld.ai"
          className="text-volt-dark underline underline-offset-2"
        >
          report@pluginworld.ai
        </a>{" "}
        with the plugin slug. Malicious plugins (malware repos, star-farmed
        poisoning) are delisted immediately and blacklisted.
      </p>
    </div>
  );
}
