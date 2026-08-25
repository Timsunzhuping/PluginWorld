import { NextResponse } from "next/server";
import { getStats } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** GET /api/v1/stats */
export async function GET(req: Request) {
  const { ok } = rateLimit(clientIp(req));
  if (!ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const stats = await getStats();
  return NextResponse.json(
    {
      total_indexed: stats.totalIndexed,
      by_ecosystem: stats.byEcosystem,
      source_totals: stats.sourceTotals,
      categories: stats.categories,
      last_synced_at: stats.lastSyncedAt,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
