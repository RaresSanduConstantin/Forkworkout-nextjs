"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Play, Timer, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  getActiveSession,
  clearActiveSession,
} from "@/lib/storage/session-storage";
import { ROUTES, isMainTabRoute } from "@/lib/routes";
import type { ActiveSession } from "@/lib/types";

/**
 * Global "workout in progress" bar. Shows a fixed banner with Resume / Delete
 * whenever an active session exists and the user isn't already on the live
 * session screen. Re-checks on navigation and cross-tab storage changes. If a
 * rest countdown is running it also shows the live remaining time.
 */
export function ActiveSessionBanner() {
  const pathname = usePathname();
  const [session, setSession] = React.useState<ActiveSession | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  const refresh = React.useCallback(() => setSession(getActiveSession()), []);

  React.useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [refresh, pathname]);

  // Remaining rest seconds (if a countdown is active and hasn't finished).
  const restEndsAt = session?.restTimer?.endsAt ?? null;
  const restRemaining =
    restEndsAt != null ? Math.max(0, Math.round((restEndsAt - now) / 1000)) : 0;

  // Tick once a second only while a rest countdown is actually running.
  React.useEffect(() => {
    if (restEndsAt == null || restEndsAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [restEndsAt]);

  // Hide on the live session screen (you're already there).
  const onSessionScreen = pathname?.startsWith("/start-workout");
  if (!session || onSessionScreen) return null;

  const handleDelete = () => {
    clearActiveSession();
    setSession(null);
  };

  const restLabel =
    restRemaining > 0
      ? `${Math.floor(restRemaining / 60)}:${String(restRemaining % 60).padStart(2, "0")}`
      : null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-50 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80",
        // Sit above the bottom tab bar on the main sections; flush otherwise.
        isMainTabRoute(pathname) ? "bottom-16" : "bottom-0"
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Dumbbell className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Workout in progress</p>
            <p className="truncate text-xs text-muted-foreground">
              {session.title || "Untitled workout"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {restLabel && (
            <span
              className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums text-primary"
              aria-label={`Resting, ${restRemaining} seconds left`}
            >
              <Timer className="size-3.5" />
              {restLabel}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="size-4" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link href={ROUTES.startWorkout(session.workoutId)}>
              <Play className="size-4" />
              Resume
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
