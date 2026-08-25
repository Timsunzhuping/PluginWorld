import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** 品牌按钮：Ink 主按钮 / Volt CTA（文字只允许 Ink）/ 线框次级，无阴影 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium transition-colors whitespace-nowrap cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt-dark",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper hover:bg-charcoal",
        volt: "bg-volt text-ink hover:bg-[#b3e600]",
        outline: "border border-line bg-white text-ink hover:border-ink",
        ghost: "text-charcoal hover:bg-line/50",
      },
      size: {
        default: "h-10 px-5 text-sm",
        sm: "h-8 px-3.5 text-[13px]",
        lg: "h-12 px-7 text-[15px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export { Button, buttonVariants };
