import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { authConfigured, sign } from "@/lib/auth";

/** GitHub OAuth 入口：跳转 github.com/login/oauth/authorize */
export async function GET(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "auth_not_configured", message: "Set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / AUTH_SECRET." },
      { status: 501 },
    );
  }
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "read:user");
  const origin = new URL(req.url).origin;
  url.searchParams.set("redirect_uri", `${origin}/api/auth/callback`);

  const res = NextResponse.redirect(url);
  res.cookies.set("pw_oauth_state", sign(state), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
