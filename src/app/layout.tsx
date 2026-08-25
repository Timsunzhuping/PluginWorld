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
    default: "PluginWorld — The Cross-Ecosystem AI Plugin Marketplace | dsh · Claude Code · MCP",
    template: "%s | PluginWorld",
  },
  description:
    "One search box for every plugin across DeepSeek Harness (dsh), Claude Code and MCP — with unified quality and security scores. Plug in. The world is ready.",
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
    title: "PluginWorld — The Cross-Ecosystem AI Plugin Marketplace",
    description:
      "One search box for every plugin across dsh, Claude Code and MCP. Plug in. The world is ready.",
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
    <html lang="en">
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
