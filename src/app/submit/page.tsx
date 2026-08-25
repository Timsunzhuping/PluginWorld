import type { Metadata } from "next";
import { ECOSYSTEM_META } from "@/lib/types";

export const metadata: Metadata = {
  title: "Submit — 收录你的插件",
  description:
    "给仓库加上生态 topic，PluginWorld 每 6 小时自动收录、校验、评分。无需注册。",
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
    extra: "发布为 npm 包（package.json 含 dsh/cordis 信号）可获得规范合规满分。",
  },
  {
    eco: "claude-code",
    topic: "claude-code-plugin",
    extra: "仓库根目录提供 .claude-plugin/plugin.json（或 marketplace.json）。",
  },
  {
    eco: "mcp",
    topic: "mcp-server",
    extra: "同时发布到官方 MCP Registry（server.json）可获得 registry verified 标识。",
  },
];

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <p className="label text-muted">SUBMIT</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.01em] text-ink sm:text-4xl">
        收录你的插件
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        PluginWorld 不靠人工提交冷启动——收录管道每 6 小时自动抓取 GitHub topic 与官方
        MCP Registry，对每个仓库做规范校验、install script 静态扫描与质量评分。
        你只需要做一件事：
      </p>

      <div className="mt-8 rounded-[12px] bg-ink p-6">
        <p className="label text-faint">ONE STEP</p>
        <p className="mt-2 text-[15px] leading-relaxed text-paper">
          在 GitHub 仓库的 <span className="font-mono text-volt">About → Topics</span>{" "}
          中加上对应生态的 topic，下一轮同步自动收录。
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

      <h2 className="mt-12 text-xl font-bold text-ink">提升质量评分</h2>
      <ul className="mt-4 space-y-2.5 text-[14.5px] leading-relaxed text-charcoal">
        <li className="flex gap-3">
          <span className="font-mono text-volt-dark">01</span>
          保持活跃：30 天内有 commit 维护度满分，之后按 180 天半衰期衰减。
        </li>
        <li className="flex gap-3">
          <span className="font-mono text-volt-dark">02</span>
          提供合规 manifest：通过生态官方 schema 校验拿满 20 分规范分。
        </li>
        <li className="flex gap-3">
          <span className="font-mono text-volt-dark">03</span>
          声明 license、避免可疑 install script、登录认领仓库，安全分 15 分拿满。
        </li>
        <li className="flex gap-3">
          <span className="font-mono text-volt-dark">04</span>
          README 写好结构与代码示例，文档分 10 分。
        </li>
      </ul>

      <h2 className="mt-12 text-xl font-bold text-ink">已被收录？认领它</h2>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        用 GitHub 登录后，在你的插件详情页点击「认领这个插件」，获得 verified owner
        标识并直接提升安全评分。
      </p>

      <h2 className="mt-12 text-xl font-bold text-ink">收录有误 / 举报恶意插件</h2>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        发邮件到{" "}
        <a
          href="mailto:report@pluginworld.ai"
          className="text-volt-dark underline underline-offset-2"
        >
          report@pluginworld.ai
        </a>
        ，附插件 slug。恶意插件（挂马仓库、刷 star 投毒）会被立即下架并加入黑名单。
      </p>
    </div>
  );
}
