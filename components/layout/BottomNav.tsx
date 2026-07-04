"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, CalendarDays, Scale, ListChecks } from "lucide-react";

import { cn } from "@/lib/utils";
import { ROUTES, isMainTabRoute } from "@/lib/routes";

const TABS = [
  { href: ROUTES.dashboard, label: "Workouts", icon: Dumbbell },
  { href: ROUTES.history, label: "History", icon: CalendarDays },
  { href: ROUTES.body, label: "Body", icon: Scale },
  { href: ROUTES.exercises, label: "Exercises", icon: ListChecks },
];

/**
 * Fixed mobile-first bottom tab bar for the four main sections. Renders only on
 * those routes (hidden on the landing page, builder, live session and offline).
 */
export function BottomNav() {
  const pathname = usePathname();
  if (!isMainTabRoute(pathname)) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-xl items-stretch justify-around">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("size-5", active && "fill-primary/10")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
