import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/** Trigger site-wide ISR regeneration after the sync pipeline finishes (spec §6); Bearer REVALIDATE_SECRET auth */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "revalidate_not_configured" }, { status: 501 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, revalidated: "all" });
}
