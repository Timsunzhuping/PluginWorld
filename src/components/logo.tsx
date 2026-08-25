import { cn } from "@/lib/utils";

/**
 * PluginWorld logo · mark = a port with a plug connecting; volt green is the live current.
 * viewBox 0 0 96 96, from brand visual system V1.0.
 */
export function LogoMark({
  size = 28,
  onDark = false,
  className,
}: {
  size?: number;
  onDark?: boolean;
  className?: string;
}) {
  const ring = onDark ? "#f7f6f3" : "#16161a";
  const prongBase = onDark ? "#16161a" : "#ffffff";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={className}
      aria-hidden="true"
    >
      <circle cx="48" cy="48" r="34" fill="none" stroke={ring} strokeWidth="9" />
      <rect x="42" y="2" width="12" height="28" rx="5" fill={prongBase} />
      <rect x="42" y="6" width="12" height="24" rx="5" fill="#c6ff00" />
      <circle cx="48" cy="48" r="8" fill={ring} />
    </svg>
  );
}

export function LogoLockup({
  onDark = false,
  size = 28,
  className,
}: {
  onDark?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} onDark={onDark} />
      <span
        className={cn(
          "font-semibold tracking-tight leading-none",
          onDark ? "text-paper" : "text-ink",
        )}
        style={{ fontSize: size * 0.68 }}
      >
        PluginWorld
      </span>
    </span>
  );
}
