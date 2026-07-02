// Versioned LocalStorage migrations with a one-time auto-backup.
//
// The app's persisted shapes are read through back-compat normalizers, so no
// destructive migration is needed today — the value here is the framework plus a
// safety snapshot taken the first time a user upgrades to a new schema version.
// Future breaking changes append a migration to MIGRATIONS.

import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";
import { saveWorkouts } from "./workout-storage";
import { buildExport, type ExportBundle } from "./transfer";

export const CURRENT_SCHEMA_VERSION = 1;

// MIGRATIONS[v] upgrades storage from version v to v+1. Empty for now.
const MIGRATIONS: (() => void)[] = [];

export type AutoBackup = {
  fromVersion: number;
  savedAt: string;
  bundle: ExportBundle;
};

export function getSchemaVersion(): number {
  const v = readJson<number>(STORAGE_KEYS.schemaVersion, 0);
  return typeof v === "number" && v >= 0 ? v : 0;
}

export function getAutoBackup(): AutoBackup | null {
  const b = readJson<AutoBackup | null>(STORAGE_KEYS.autoBackup, null);
  if (!b || typeof b !== "object" || !b.bundle || typeof b.bundle !== "object") return null;
  return b;
}

/** Whether the backup actually contains any user data worth restoring. */
export function autoBackupHasData(b: AutoBackup | null): boolean {
  if (!b) return false;
  const { workouts, completedWorkouts, bodyMetrics } = b.bundle;
  return (
    (Array.isArray(workouts) && workouts.length > 0) ||
    (Array.isArray(completedWorkouts) && completedWorkouts.length > 0) ||
    (Array.isArray(bodyMetrics) && bodyMetrics.length > 0)
  );
}

/**
 * Runs any pending migrations exactly once, taking a one-time snapshot of the
 * user's data before upgrading so a bad migration can be rolled back. Safe to
 * call on every app load (no-ops once the version is current).
 */
export function runMigrations(): void {
  if (typeof window === "undefined") return;
  const from = getSchemaVersion();
  if (from >= CURRENT_SCHEMA_VERSION) return;

  // Snapshot current data before touching anything (best-effort).
  try {
    const backup: AutoBackup = {
      fromVersion: from,
      savedAt: new Date().toISOString(),
      bundle: buildExport(),
    };
    writeJson(STORAGE_KEYS.autoBackup, backup);
  } catch {
    /* backup is best-effort; continue */
  }

  for (let v = from; v < CURRENT_SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (migrate) {
      try {
        migrate();
      } catch {
        /* reads are normalized regardless; don't block the app */
      }
    }
  }

  writeJson(STORAGE_KEYS.schemaVersion, CURRENT_SCHEMA_VERSION);
}

/** Restores the auto-backup, replacing current workouts / history / body data. */
export function restoreAutoBackup(): boolean {
  const b = getAutoBackup();
  if (!b) return false;
  saveWorkouts(Array.isArray(b.bundle.workouts) ? b.bundle.workouts : []);
  writeJson(
    STORAGE_KEYS.completedWorkouts,
    Array.isArray(b.bundle.completedWorkouts) ? b.bundle.completedWorkouts : []
  );
  writeJson(
    STORAGE_KEYS.bodyMetrics,
    Array.isArray(b.bundle.bodyMetrics) ? b.bundle.bodyMetrics : []
  );
  return true;
}
