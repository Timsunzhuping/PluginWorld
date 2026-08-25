import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[8px] border border-line bg-white px-4 text-[15px] text-ink placeholder:text-faint focus-visible:outline-none focus-visible:border-ink transition-colors",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
