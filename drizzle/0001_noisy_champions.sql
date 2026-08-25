ALTER TABLE "plugins" ADD COLUMN "security_grade" text;--> statement-breakpoint
ALTER TABLE "plugins" ADD COLUMN "security_findings" jsonb;