/** 收录管道共享工具：HTTP、README 渲染、并发控制 */
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export const GITHUB_API = "https://api.github.com";
export const RAW_BASE = "https://raw.githubusercontent.com";
export const MCP_REGISTRY = "https://registry.modelcontextprotocol.io";

export function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "pluginworld-sync (www.pluginworld.ai)",
  };
  // GitHub Actions 中用 token 提高限额（方案 §6）
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  retries = 3,
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 403 || res.status === 429) {
        // rate limited → 指数退避重试
        const wait = Math.min(60_000, 2_000 * 2 ** attempt);
        console.warn(`  rate limited on ${url}, waiting ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (res.status === 404) return null;
      if (!res.ok) {
        if (attempt < retries) {
          await sleep(1_000 * (attempt + 1));
          continue;
        }
        console.warn(`  failed ${res.status}: ${url}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      if (attempt < retries) {
        await sleep(1_000 * (attempt + 1));
        continue;
      }
      console.warn(`  error fetching ${url}:`, (err as Error).message);
      return null;
    }
  }
  return null;
}

export async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "pluginworld-sync (www.pluginworld.ai)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 简单并发池 */
export async function pooled<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

/** 第三方 README 中的泄露密钥脱敏（我们会再分发这些内容，见方案 §9 合规） */
const SECRET_PATTERNS: [RegExp, string][] = [
  [/https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9\/_-]+/g, "https://hooks.slack.com/services/REDACTED"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, "xox?-REDACTED"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "gh?_REDACTED"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, "github_pat_REDACTED"],
  [/\bsk-[A-Za-z0-9_-]{20,}/g, "sk-REDACTED"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "AKIA_REDACTED"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, "AIza_REDACTED"],
  [/\bhf_[A-Za-z0-9]{25,}\b/g, "hf_REDACTED"],
  [/\bnpm_[A-Za-z0-9]{30,}\b/g, "npm_REDACTED"],
  [/\b[sr]k_live_[A-Za-z0-9]{10,}\b/g, "sk_live_REDACTED"],
  [/\bglpat-[A-Za-z0-9_-]{15,}\b/g, "glpat-REDACTED"],
  [/\beyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "JWT_REDACTED"],
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const [re, replacement] of SECRET_PATTERNS) {
    out = out.replace(re, replacement);
  }
  return out;
}

/** README markdown → 消毒后的 HTML；相对链接改写为源仓库绝对地址 */
export function renderReadme(
  markdown: string,
  repoFullName: string | null,
): { html: string; textLength: number; hasCodeExample: boolean; hasStructure: boolean } {
  const redacted = redactSecrets(markdown);
  const truncated =
    redacted.length > 120_000 ? redacted.slice(0, 120_000) + "\n\n…" : redacted;
  const rawHtml = marked.parse(truncated, { async: false }) as string;

  const rawBase = repoFullName ? `${RAW_BASE}/${repoFullName}/HEAD/` : null;
  const blobBase = repoFullName ? `https://github.com/${repoFullName}/blob/HEAD/` : null;

  const html = sanitizeHtml(rawHtml, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "ul", "ol", "li",
      "blockquote", "pre", "code", "em", "strong", "del", "hr", "br",
      "table", "thead", "tbody", "tr", "th", "td", "img", "details",
      "summary", "sup", "sub", "kbd", "picture", "source",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height", "align"],
      source: ["srcset", "media"],
      th: ["align"],
      td: ["align"],
      code: ["class"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    transformTags: {
      a: (tagName, attribs) => {
        let href = attribs.href ?? "";
        if (href && !/^(https?:|mailto:|#)/.test(href) && blobBase) {
          href = blobBase + href.replace(/^\.?\//, "");
        }
        return {
          tagName,
          attribs: { ...attribs, href, target: "_blank", rel: "noopener noreferrer" },
        };
      },
      img: (tagName, attribs) => {
        let src = attribs.src ?? "";
        if (src && !/^https?:/.test(src) && rawBase) {
          src = rawBase + src.replace(/^\.?\//, "");
        }
        return { tagName, attribs: { ...attribs, src } };
      },
    },
  });

  const text = sanitizeHtml(rawHtml, { allowedTags: [], allowedAttributes: {} });
  const headingCount = (rawHtml.match(/<h[1-4][\s>]/g) ?? []).length;
  return {
    html,
    textLength: text.trim().length,
    hasCodeExample: /<pre>|<code>/.test(rawHtml),
    hasStructure: headingCount >= 2,
  };
}

/** 官方组织白名单：officialOwner trust flag */
export const OFFICIAL_OWNERS = new Set([
  "deepseek-ai",
  "anthropics",
  "modelcontextprotocol",
  "microsoft",
  "google-gemini",
  "openai",
  "cloudflare",
  "supabase",
  "stripe",
  "vercel",
  "github",
  "aws",
  "awslabs",
  "elastic",
  "mongodb",
  "redis",
  "upstash",
  "tencent",
  "volcengine",
  "alibaba",
  "bytedance",
]);
