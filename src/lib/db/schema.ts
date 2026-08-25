import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** 插件主表 —— 字段命名严格对齐开发方案 §4 */
export const plugins = pgTable(
  "plugins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ecosystem: text("ecosystem", { enum: ["dsh", "claude-code", "mcp"] }).notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    repoUrl: text("repo_url"),
    homepage: text("homepage"),
    ownerGithub: text("owner_github"),
    license: text("license"),
    manifest: jsonb("manifest"),
    categories: text("categories").array().notNull().default(sql`'{}'`),
    keywords: text("keywords").array().notNull().default(sql`'{}'`),
    stars: integer("stars").notNull().default(0),
    downloads: integer("downloads").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    versionLatest: text("version_latest"),
    lastCommitAt: timestamp("last_commit_at", { withTimezone: true }),
    specValid: boolean("spec_valid").notNull().default(false),
    qualityScore: numeric("quality_score"),
    // §5：每个维度落库为独立字段
    scoreMaintenance: numeric("score_maintenance"),
    scorePopularity: numeric("score_popularity"),
    scoreCompliance: numeric("score_compliance"),
    scoreSecurity: numeric("score_security"),
    scoreDocs: numeric("score_docs"),
    trustFlags: jsonb("trust_flags"),
    readmeHtml: text("readme_html"),
    npmPackage: text("npm_package"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("plugins_slug_idx").on(t.slug),
    index("plugins_ecosystem_idx").on(t.ecosystem),
    index("plugins_score_idx").on(t.qualityScore),
    index("plugins_stars_idx").on(t.stars),
    // Postgres FTS：name + description（keywords 用数组重叠条件补充，见 lib/data.ts）
    index("plugins_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${t.name},'') || ' ' || coalesce(${t.description},''))`,
    ),
    index("plugins_keywords_idx").using("gin", t.keywords),
  ],
);

export const pluginVersions = pgTable("plugin_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  pluginId: uuid("plugin_id")
    .notNull()
    .references(() => plugins.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  changelog: text("changelog"),
  manifest: jsonb("manifest"),
});

export const syncSources = pgTable("sync_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type", {
    enum: ["github_topic", "mcp_registry", "manual"],
  }).notNull(),
  config: jsonb("config"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  status: jsonb("status"),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubLogin: text("github_login").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const claims = pgTable(
  "claims",
  {
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("claims_plugin_user_idx").on(t.pluginId, t.userId)],
);

// P1：用户评价
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  pluginId: uuid("plugin_id")
    .notNull()
    .references(() => plugins.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  body: text("body"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// view / install-copy 埋点，算 trending
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["view", "install-copy"] }).notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_plugin_ts_idx").on(t.pluginId, t.ts)],
);
