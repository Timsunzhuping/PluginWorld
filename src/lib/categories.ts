/** Derive unified categories from GitHub topics / keywords / description */

export const CATEGORY_LABELS: Record<string, string> = {
  "ai-agents": "AI Agents",
  "developer-tools": "Developer Tools",
  "code-review": "Code Review",
  search: "Search",
  memory: "Memory & Context",
  database: "Database",
  "browser-automation": "Browser Automation",
  productivity: "Productivity",
  design: "Design",
  "data-analytics": "Data & Analytics",
  devops: "DevOps & Cloud",
  communication: "Communication",
  finance: "Finance",
  security: "Security",
  media: "Media",
  docs: "Docs & Knowledge",
  "web-scraping": "Web Scraping",
  testing: "Testing",
  workflow: "Workflow & Automation",
  integration: "Integrations",
};

const RULES: [category: string, patterns: RegExp][] = [
  ["ai-agents", /\b(agent|agents|agentic|multi-agent|swarm|autonomous|llm|copilot)\b/i],
  ["code-review", /\b(code[- ]?review|lint|linter|static[- ]?analysis|pr[- ]?review)\b/i],
  ["developer-tools", /\b(cli|sdk|dev[- ]?tools?|developer|ide|vscode|coding|compiler|git\b)/i],
  ["search", /\b(search|retrieval|rag\b|semantic|brave|exa|serp)\b/i],
  ["memory", /\b(memory|context|knowledge[- ]?graph|persist|session)\b/i],
  ["database", /\b(database|postgres|sqlite|mysql|mongodb|redis|supabase|sql\b|vector[- ]?db|qdrant|chroma)\b/i],
  ["browser-automation", /\b(browser|playwright|puppeteer|selenium|chrome|web[- ]?automation)\b/i],
  ["productivity", /\b(productivity|todo|notes?|calendar|task|gtd|obsidian|notion)\b/i],
  ["design", /\b(design|figma|ui\b|ux\b|icon|typography|css|tailwind)\b/i],
  ["data-analytics", /\b(data|analytics|visualization|chart|etl|pandas|jupyter|bigquery)\b/i],
  ["devops", /\b(devops|docker|kubernetes|k8s|terraform|aws|gcp|azure|cloudflare|deploy|ci\/?cd)\b/i],
  ["communication", /\b(slack|discord|email|gmail|telegram|whatsapp|chat|sms|teams)\b/i],
  ["finance", /\b(finance|payment|stripe|trading|crypto|billing|invoice)\b/i],
  ["security", /\b(security|auth|oauth|secret|vulnerabilit|pentest|scan)\b/i],
  ["media", /\b(image|video|audio|speech|music|podcast|ffmpeg|3d\b)\b/i],
  ["docs", /\b(docs?|documentation|markdown|wiki|readme|knowledge[- ]?base|pdf)\b/i],
  ["web-scraping", /\b(scrap|crawl|firecrawl|extract)\b/i],
  ["testing", /\b(test|testing|e2e|unit[- ]?test|qa\b|coverage)\b/i],
  ["workflow", /\b(workflow|automation|n8n|zapier|pipeline|orchestrat)\b/i],
  ["integration", /\b(integration|connector|api[- ]?client|webhook|bridge)\b/i],
];

export function deriveCategories(
  topics: string[],
  description: string | null,
  name: string,
): string[] {
  const haystack = [name, description ?? "", topics.join(" ")].join(" ");
  const cats = new Set<string>();
  for (const [category, re] of RULES) {
    if (re.test(haystack)) cats.add(category);
    if (cats.size >= 3) break;
  }
  if (cats.size === 0) cats.add("integration");
  return [...cats];
}
