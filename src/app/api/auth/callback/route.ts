import { NextResponse } from "next/server";
import { authConfigured, sign, verify, SESSION_COOKIE, type Session } from "@/lib/auth";
import { getDb, hasDatabase, schema } from "@/lib/db";

/** GitHub OAuth callback: exchange token → fetch user → upsert users row → set session cookie */
export async function GET(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 501 });
  }
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = req.headers.get("cookie") ?? "";
  const stateCookie = /(?:^|;\s*)pw_oauth_state=([^;]+)/.exec(cookieHeader)?.[1];

  if (!code || !state || !stateCookie || verify(decodeURIComponent(stateCookie)) !== state) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenBody = (await tokenRes.json()) as { access_token?: string };
  if (!tokenBody.access_token) {
    return NextResponse.json({ error: "token_exchange_failed" }, { status: 502 });
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenBody.access_token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!userRes.ok) {
    return NextResponse.json({ error: "user_fetch_failed" }, { status: 502 });
  }
  const user = (await userRes.json()) as {
    login: string;
    name: string | null;
    avatar_url: string | null;
  };

  if (hasDatabase()) {
    const db = getDb();
    await db
      .insert(schema.users)
      .values({ githubLogin: user.login, name: user.name, avatarUrl: user.avatar_url })
      .onConflictDoUpdate({
        target: schema.users.githubLogin,
        set: { name: user.name, avatarUrl: user.avatar_url },
      });
  }

  const session: Session = {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };
  const res = NextResponse.redirect(new URL("/", url.origin));
  res.cookies.set(SESSION_COOKIE, sign(JSON.stringify(session)), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  res.cookies.delete("pw_oauth_state");
  return res;
}
