CREATE TABLE "claims" (
	"plugin_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"version" text NOT NULL,
	"published_at" timestamp with time zone,
	"changelog" text,
	"manifest" jsonb
);
--> statement-breakpoint
CREATE TABLE "plugins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecosystem" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"repo_url" text,
	"homepage" text,
	"owner_github" text,
	"license" text,
	"manifest" jsonb,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"downloads" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"version_latest" text,
	"last_commit_at" timestamp with time zone,
	"spec_valid" boolean DEFAULT false NOT NULL,
	"quality_score" numeric,
	"score_maintenance" numeric,
	"score_popularity" numeric,
	"score_compliance" numeric,
	"score_security" numeric,
	"score_docs" numeric,
	"trust_flags" jsonb,
	"readme_html" text,
	"npm_package" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"config" jsonb,
	"last_run_at" timestamp with time zone,
	"status" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_login" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_github_login_unique" UNIQUE("github_login")
);
--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_versions" ADD CONSTRAINT "plugin_versions_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "claims_plugin_user_idx" ON "claims" USING btree ("plugin_id","user_id");--> statement-breakpoint
CREATE INDEX "events_plugin_ts_idx" ON "events" USING btree ("plugin_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "plugins_slug_idx" ON "plugins" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "plugins_ecosystem_idx" ON "plugins" USING btree ("ecosystem");--> statement-breakpoint
CREATE INDEX "plugins_score_idx" ON "plugins" USING btree ("quality_score");--> statement-breakpoint
CREATE INDEX "plugins_stars_idx" ON "plugins" USING btree ("stars");--> statement-breakpoint
CREATE INDEX "plugins_fts_idx" ON "plugins" USING gin (to_tsvector('simple', coalesce("name",'') || ' ' || coalesce("description",'')));--> statement-breakpoint
CREATE INDEX "plugins_keywords_idx" ON "plugins" USING gin ("keywords");