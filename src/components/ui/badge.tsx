import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] leading-5 tracking-wide",
  {
    variants: {
      variant: {
        default: "border-line bg-white text-charcoal",
        volt: "border-transparent bg-volt-tint text-volt-deep",
        ink: "border-transparent bg-ink text-paper",
        signal: "border-transparent bg-signal/10 text-signal",
        outline: "border-line bg-transparent text-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
