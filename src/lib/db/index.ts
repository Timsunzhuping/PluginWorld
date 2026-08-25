import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * 双模式数据层的 DB 侧：设置 DATABASE_URL 时启用 Postgres（生产），
 * 未设置时站点回退到 data/seed 快照（demo / 静态模式），见 lib/data.ts。
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
      prepare: false, // 兼容 Supabase/Neon 的连接池
      max: 5,
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}

export { schema };
