import { readSyncStatus } from "@/lib/sync-status";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(readSyncStatus(), { headers: { "Cache-Control": "no-store" } });
}
