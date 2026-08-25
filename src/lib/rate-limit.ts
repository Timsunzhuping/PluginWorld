/**
 * 公开 API 限流（P0 最小实现：进程内滑动窗口，按 IP）。
 * 生产规模化时替换为 Upstash Redis（方案 Phase 3 §9），接口保持不变。
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
  // 防止 map 无限增长
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
