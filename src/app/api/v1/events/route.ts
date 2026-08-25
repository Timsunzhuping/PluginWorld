import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** POST /api/v1/events — view / install-copy tracking (feeds trending, spec §4 events table) */
export async function POST(req: Request) {
  const { ok } = rateLimit(clientIp(req));
  if (!ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: { slug?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { slug, kind } = body;
  if (typeof slug !== "string" || !["view", "install-copy"].includes(kind ?? "")) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!hasDatabase()) {
    // demo/snapshot mode: tracking is a no-op
    return NextResponse.json({ ok: true, recorded: false });
  }

  const db = getDb();
  const rows = await db
    .select({ id: schema.plugins.id })
    .from(schema.plugins)
    .where(eq(schema.plugins.slug, slug))
    .limit(1);
  if (!rows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.insert(schema.events).values({
    pluginId: rows[0].id,
    kind: kind as "view" | "install-copy",
  });
  return NextResponse.json({ ok: true, recorded: true });
}
