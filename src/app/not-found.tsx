import Link from "next/link";
import { LogoMark } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-32 text-center">
      <LogoMark size={56} />
      <p className="label mt-8 text-muted">404 · PORT NOT FOUND</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.01em] text-ink">
        这个接口没有接通
      </h1>
      <p className="mt-3 max-w-md text-[15px] text-muted">
        页面不存在，或插件已从索引中移除。
      </p>
      <Link
        href="/browse"
        className="mt-8 rounded-[8px] bg-volt px-6 py-3 text-[14.5px] font-semibold text-ink transition-colors hover:bg-[#b3e600]"
      >
        探索全部插件
      </Link>
    </div>
  );
}
