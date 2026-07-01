import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Mobile-first page wrapper: constrains width, adds responsive padding, and
 * reserves bottom space so sticky action bars never cover content.
 */
export function PageContainer({
  className,
  children,
  hasBottomBar = false,
}: {
  className?: string;
  children: React.ReactNode;
  hasBottomBar?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-xl px-4 py-6 min-h-dvh",
        hasBottomBar && "pb-28",
        className
      )}
    >
      {children}
    </div>
  );
}
