import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * DB side of the dual-mode data layer: with DATABASE_URL set, Postgres is used (production);
 * without it, the site falls back to the data/seed snapshot (demo/static mode), see lib/data.ts.
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — running in snapshot mode");
  }
  if (!_db) {
    const client = postgres(process.env.DATABASE_URL, {
      prepare: false, // compatible with Supabase/Neon connection pooling
      max: 5,
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}

export { schema };
