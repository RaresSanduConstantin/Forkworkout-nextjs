"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getActiveSession,
  clearActiveSession,
} from "@/lib/storage/session-storage";
import { ROUTES } from "@/lib/routes";
import type { ActiveSession } from "@/lib/types";

/**
 * Global "workout in progress" bar. Shows a fixed banner with Resume / Delete
 * whenever an active session exists and the user isn't already on the live
 * session screen. Re-checks on navigation and cross-tab storage changes.
 */
export function ActiveSessionBanner() {
  const pathname = usePathname();
  const [session, setSession] = React.useState<ActiveSession | null>(null);

  const refresh = React.useCallback(() => setSession(getActiveSession()), []);

  React.useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [refresh, pathname]);

  // Hide on the live session screen (you're already there).
  const onSessionScreen = pathname?.startsWith("/start-workout");
  if (!session || onSessionScreen) return null;

  const handleDelete = () => {
    clearActiveSession();
    setSession(null);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
