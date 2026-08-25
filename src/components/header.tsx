import Link from "next/link";
import { LogoLockup } from "./logo";
import { getSession } from "@/lib/auth";
import { authConfigured } from "@/lib/auth";

const NAV = [
  { href: "/browse", label: "Explore" },
  { href: "/browse?view=categories", label: "Categories" },
  { href: "/docs/api", label: "Developers" },
  { href: "/submit", label: "Submit" },
];

export async function Header() {
  const session = await getSession();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="PluginWorld home">
          <LogoLockup size={30} />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="hidden rounded-[8px] px-3 py-2 text-[14px] text-charcoal transition-colors hover:bg-line/50 hover:text-ink sm:block"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/browse"
            className="rounded-[8px] px-3 py-2 text-[14px] text-charcoal hover:bg-line/50 sm:hidden"
          >
            Explore
          </Link>
          {session ? (
            <span className="ml-2 flex items-center gap-2">
              <span className="font-mono text-[12px] text-charcoal">
                @{session.login}
              </span>
              <a
                href="/api/auth/logout"
                className="rounded-[8px] border border-line bg-white px-3 py-1.5 text-[13px] text-charcoal hover:border-ink"
              >
                Sign out
              </a>
            </span>
          ) : authConfigured() ? (
            <a
              href="/api/auth/login"
              className="ml-2 rounded-[8px] bg-ink px-4 py-2 text-[14px] font-medium text-paper transition-colors hover:bg-charcoal"
            >
              Sign in
            </a>
          ) : (
            <Link
              href="/browse"
              className="ml-2 hidden rounded-[8px] bg-ink px-4 py-2 text-[14px] font-medium text-paper transition-colors hover:bg-charcoal sm:block"
            >
              Get started
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
