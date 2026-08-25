import Link from "next/link";
import { LogoLockup } from "./logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "MARKET",
    links: [
      { label: "Explore", href: "/browse" },
      { label: "dsh plugins", href: "/browse?ecosystem=dsh" },
      { label: "Claude Code plugins", href: "/browse?ecosystem=claude-code" },
      { label: "MCP servers", href: "/browse?ecosystem=mcp" },
    ],
  },
  {
    title: "DEVELOPERS",
    links: [
      { label: "API docs", href: "/docs/api" },
      { label: "Submit a plugin", href: "/submit" },
      { label: "Quality score", href: "/docs/api#quality-score" },
    ],
  },
  {
    title: "ECOSYSTEMS",
    links: [
      {
        label: "DeepSeek Harness",
        href: "https://github.com/deepseek-ai/deepseek-harness",
      },
      { label: "Claude Code", href: "https://code.claude.com" },
      { label: "Model Context Protocol", href: "https://modelcontextprotocol.io" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <LogoLockup onDark size={30} />
            <p className="mt-4 text-[14px] leading-relaxed text-faint">
              Plug in. The world is ready.
            </p>
            <p className="mt-4 font-mono text-[11px] tracking-wide text-faint">
              WWW.PLUGINWORLD.AI
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h4 className="label text-faint">{col.title}</h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith("http") ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13.5px] text-[#d3d1c9] transition-colors hover:text-volt"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-[13.5px] text-[#d3d1c9] transition-colors hover:text-volt"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-line-dark pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] tracking-wide text-faint">
            © {new Date().getFullYear()} PLUGINWORLD · ONE PORT FOR EVERY PLUGIN
          </p>
          <p className="font-mono text-[11px] tracking-wide text-faint">
            DSH · CLAUDE CODE · MCP
          </p>
        </div>
      </div>
    </footer>
  );
}
