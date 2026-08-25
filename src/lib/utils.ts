import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 2400000 → "2.4M"，brand: 数据用 mono 字体呈现，不夸张修饰 */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return trimZero((n / 1_000_000).toFixed(1)) + "M";
  if (n >= 1_000) return trimZero((n / 1_000).toFixed(1)) + "K";
  return String(n);
}

function trimZero(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** 插件卡片字母头像：取名字前两个有效字符，如 TypeFlow → "Ty" */
export function avatarText(name: string): string {
  const clean = name.replace(/^@[^/]+\//, "").replace(/[^a-zA-Z0-9一-龥]/g, "");
  const s = clean.slice(0, 2) || "??";
  return s[0].toUpperCase() + (s[1] ?? "").toLowerCase();
}
