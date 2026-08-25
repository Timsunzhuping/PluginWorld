/**
 * Load the src/data/seed snapshot into Postgres:
 *   npx tsx scripts/db/seed.ts
 * Prerequisites: DATABASE_URL is set and `npm run db:migrate` has been run.
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
