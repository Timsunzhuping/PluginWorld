import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * GitHub OAuth sessions (Phase 3 · plugin claiming requires a verified GitHub identity).
 * Zero-dependency implementation: HMAC-signed HttpOnly cookie.
 * Requires GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / AUTH_SECRET env vars;
 * when unset, the site hides the login entry point (demo mode).
 */

export const SESSION_COOKIE = "pw_session";

export interface Session {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  exp: number;
}

export function authConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.AUTH_SECRET,
  );
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET not set");
  return s;
}

export function sign(payload: string): string {
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

export function verify(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payloadB64 = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}

export async function getSession(): Promise<Session | null> {
  if (!authConfigured()) return null;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  try {
    const session = JSON.parse(payload) as Session;
    if (typeof session.login !== "string" || session.exp < Date.now() / 1000) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}
