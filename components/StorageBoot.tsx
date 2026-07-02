"use client";

import * as React from "react";
import { runMigrations } from "@/lib/storage/migrations";

/**
 * Runs LocalStorage migrations once on app load. Renders nothing.
 */
export function StorageBoot() {
  React.useEffect(() => {
    runMigrations();
  }, []);
  return null;
}
