import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, hasDatabase, schema } from "@/lib/db";

/** POST /api/claim — 开发者认领插件（需 GitHub 登录且为 owner 本人） */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先使用 GitHub 登录" }, { status: 401 });
  }
  let body: { slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.slug !== "string") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!hasDatabase()) {
    return NextResponse.json({
      ok: true,
      message: "Demo 模式：认领已记录到会话（配置 DATABASE_URL 后持久化）",
    });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.plugins)
    .where(eq(schema.plugins.slug, body.slug))
    .limit(1);
  const plugin = rows[0];
  if (!plugin) return NextResponse.json({ error: "插件不存在" }, { status: 404 });
  if (
    !plugin.ownerGithub ||
    plugin.ownerGithub.toLowerCase() !== session.login.toLowerCase()
  ) {
    return NextResponse.json(
      { error: `只有 @${plugin.ownerGithub ?? "?"} 本人可以认领` },
      { status: 403 },
    );
  }

  const userRows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.githubLogin, session.login))
    .limit(1);
  let userId = userRows[0]?.id;
  if (!userId) {
    const inserted = await db
      .insert(schema.users)
      .values({ githubLogin: session.login, name: session.name })
      .returning({ id: schema.users.id });
    userId = inserted[0].id;
  }

  await db
    .insert(schema.claims)
    .values({ pluginId: plugin.id, userId, verifiedAt: new Date() })
    .onConflictDoNothing();

  // trust_flags.verifiedOwner = true，安全评分 +4 在下轮 sync 重算
  await db
    .update(schema.plugins)
    .set({
      trustFlags: sql`coalesce(${schema.plugins.trustFlags}, '{}'::jsonb) || '{"verifiedOwner": true}'::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(schema.plugins.id, plugin.id));

  return NextResponse.json({ ok: true, message: "认领成功，verified owner 标识已生效" });
}
