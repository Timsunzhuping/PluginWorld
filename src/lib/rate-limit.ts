/**
 * Public API rate limiting (P0 minimal implementation: in-process sliding window, per IP).
 * At production scale, swap in Upstash Redis (spec Phase 3 §9); the interface stays the same.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const buckets = new Map<string, number[]>();

export function rateLimit(ip: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const hits = buckets.get(ip)?.filter((t) => t > cutoff) ?? [];
  if (hits.length >= MAX_REQUESTS) {
    buckets.set(ip, hits);
    return { ok: false, remaining: 0 };
  }
  hits.push(now);
  buckets.set(ip, hits);
  // Keep the map from growing unbounded
  if (buckets.size > 10_000) {
    for (const [key, arr] of buckets) {
      if (arr.every((t) => t <= cutoff)) buckets.delete(key);
    }
  }
  return { ok: true, remaining: MAX_REQUESTS - hits.length };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}
