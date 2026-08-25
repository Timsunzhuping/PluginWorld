import Link from "next/link";
import { LogoMark } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-32 text-center">
      <LogoMark size={56} />
      <p className="label mt-8 text-muted">404 · PORT NOT FOUND</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.01em] text-ink">
        This port isn&apos;t connected
      </h1>
      <p className="mt-3 max-w-md text-[15px] text-muted">
        The page doesn&apos;t exist, or the plugin was removed from the index.
      </p>
      <Link
        href="/browse"
        className="mt-8 rounded-[8px] bg-volt px-6 py-3 text-[14.5px] font-semibold text-ink transition-colors hover:bg-[#b3e600]"
      >
        Explore all plugins
      </Link>
    </div>
  );
}
