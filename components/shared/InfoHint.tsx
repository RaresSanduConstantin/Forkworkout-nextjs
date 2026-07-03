"use client";

import * as React from "react";
import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * A small, tap-friendly info button that explains a term in a popover. Popover
 * (not hover tooltip) so it works on touch devices.
 */
export function InfoHint({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${title}?`}
          className="shrink-0 text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 text-sm">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-muted-foreground">{children}</p>
      </PopoverContent>
    </Popover>
  );
}
