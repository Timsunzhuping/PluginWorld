import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/", new URL(req.url).origin));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
