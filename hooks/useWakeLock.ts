"use client";

import { useEffect } from "react";

/**
 * Keeps the screen awake (via the Screen Wake Lock API) while `enabled` is true,
 * e.g. during a workout or while watching a video, so a phone doesn't dim/lock.
 *
 * Wake locks are automatically released when the tab is hidden, so we re-acquire
 * on visibility change. Gracefully no-ops where the API is unsupported (older
 * iOS Safari, etc.).
 */
export function useWakeLock(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        /* denied, not visible, or unsupported — ignore */
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        request();
      }
    };

    request();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}
