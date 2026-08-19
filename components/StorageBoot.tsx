"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { applyExternalStorageChange } from "@/lib/storage/safe-storage";
import { initializeBrowserStorage } from "@/lib/storage/storage-engine";
import { runMigrations } from "@/lib/storage/migrations";

const StorageReadyContext = React.createContext(false);

/** Initializes local persistence once while allowing public pages to SSR. */
export function StorageBoot({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const initialize = async () => {
      await initializeBrowserStorage();
      // Run data-shape migrations only after the authoritative source is in
      // memory, so future migrations update IndexedDB rather than a stale
      // LocalStorage fallback.
      runMigrations();
      if (active) setReady(true);
    };

    void initialize().catch(() => {
      // Never leave the UI permanently gated in restricted browser modes.
      if (active) setReady(true);
    });
    window.addEventListener("storage", applyExternalStorageChange);
    return () => {
      active = false;
      window.removeEventListener("storage", applyExternalStorageChange);
    };
  }, []);

  return <StorageReadyContext.Provider value={ready}>{children}</StorageReadyContext.Provider>;
}

export function useStorageReady(): boolean {
  return React.useContext(StorageReadyContext);
}

/** Prevents data-reading routes from mounting before IndexedDB hydration. */
export function StorageGate({ children }: { children: React.ReactNode }) {
  const ready = useStorageReady();
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6" role="status">
        <div className="text-center">
          <Loader2 className="mx-auto size-7 animate-spin text-primary" aria-hidden />
          <p className="mt-3 text-sm font-medium">Loading your workout data…</p>
        </div>
      </div>
    );
  }
  return children;
}
