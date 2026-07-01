import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky bottom action bar for thumb-reachable primary actions on mobile.
 * Pair with `<PageContainer hasBottomBar />` so content isn't obscured.
 */
export function BottomActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur",
        "pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3">
        {children}
      </div>
    </div>
  );
}
