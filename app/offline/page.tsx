"use client";

import { WifiOff, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { honkFont } from "@/lib/honkFont";

/**
 * Offline fallback shown by the service worker when a page hasn't been cached
 * yet and there's no network. The rest of the app (already-visited pages, your
 * local data) keeps working offline.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <WifiOff className="size-8" />
      </div>
      <h1 className="text-3xl font-bold">{honkFont("You're offline")}</h1>
      <p className="max-w-sm text-muted-foreground">
        This page hasn&apos;t been saved for offline use yet. Your workouts and data live on this
        device, so pages you&apos;ve already opened still work — reconnect to load new ones.
      </p>
      <Button className="gap-2" onClick={() => window.location.reload()}>
        <RefreshCw className="size-4" />
        Try again
      </Button>
    </main>
  );
}
