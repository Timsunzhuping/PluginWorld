/**
 * 把 src/data/seed 快照灌入 Postgres：
 *   npx tsx scripts/db/seed.ts
 * 前置：DATABASE_URL 已设置，且已执行 npm run db:migrate
 */
import fs from "node:fs";
import path from "node:path";
import { upsertPlugins } from "./upsert";
import type { MarketStats, Plugin } from "../../src/lib/types";

const SEED_DIR = path.join(process.cwd(), "src", "data", "seed");

async function main() {
  const plugins: Plugin[] = JSON.parse(
    fs.readFileSync(path.join(SEED_DIR, "plugins.json"), "utf-8"),
  );
  const stats: MarketStats = JSON.parse(
    fs.readFileSync(path.join(SEED_DIR, "stats.json"), "utf-8"),
  );
  await upsertPlugins(plugins, stats, new Date());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
