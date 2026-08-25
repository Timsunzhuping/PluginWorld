import type { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://www.pluginworld.ai";
  const slugs = await getAllSlugs();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/browse`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/submit`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/docs/api`, changeFrequency: "monthly", priority: 0.6 },
    ...slugs.map((slug) => ({
      url: `${base}/plugins/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
