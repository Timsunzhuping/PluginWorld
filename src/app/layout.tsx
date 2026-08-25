import type { Metadata } from "next";
import { Outfit, IBM_Plex_Mono, Noto_Sans_SC } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.pluginworld.ai"),
  title: {
    default: "PluginWorld — 跨生态 AI 插件聚合市场 | dsh · Claude Code · MCP",
    template: "%s | PluginWorld",
  },
  description:
    "一个搜索框找到 DeepSeek Harness (dsh)、Claude Code、MCP 三大生态的所有插件，附统一的质量与安全评分。Plug in. The world is ready.",
  keywords: [
    "AI plugins",
    "plugin marketplace",
    "DeepSeek Harness",
    "dsh plugin",
    "Claude Code plugin",
    "MCP server",
    "Model Context Protocol",
  ],
  openGraph: {
    type: "website",
    siteName: "PluginWorld",
    title: "PluginWorld — 跨生态 AI 插件聚合市场",
    description:
      "一个搜索框找到 dsh / Claude Code / MCP 的所有插件。Plug in. The world is ready.",
    url: "https://www.pluginworld.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "PluginWorld — One port for every plugin",
    description:
      "Search every plugin across dsh, Claude Code and MCP — with unified quality & trust scores.",
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${outfit.variable} ${plexMono.variable} ${notoSansSC.variable} flex min-h-screen flex-col antialiased`}
      >
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
