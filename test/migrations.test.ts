// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getMigrationSafetyBackup,
  MIGRATION_BACKUP_RETENTION_DAYS,
  migrationSafetyBackupHasData,
} from "@/lib/storage/migrations";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { runtimeStorageCache } from "@/lib/storage/runtime-cache";

function storeSnapshot(savedAt: string, workouts: unknown[] = [{ id: "workout-1" }]) {
  localStorage.setItem(
    STORAGE_KEYS.autoBackup,
    JSON.stringify({
      fromVersion: 0,
      savedAt,
      bundle: {
        version: 1,
        exportedAt: savedAt,
        workouts,
        completedWorkouts: [],
        bodyMetrics: [],
        customExercises: [],
      },
    })
  );
}

beforeEach(() => {
  localStorage.clear();
  runtimeStorageCache.reset();
});

afterEach(() => {
  runtimeStorageCache.reset();
  localStorage.clear();
});

describe("migration safety snapshots", () => {
  it("keeps a recent snapshot available for recovery", () => {
    const savedAt = Date.UTC(2026, 7, 1);
    storeSnapshot(new Date(savedAt).toISOString());

    const snapshot = getMigrationSafetyBackup(
      savedAt + (MIGRATION_BACKUP_RETENTION_DAYS - 1) * 24 * 60 * 60 * 1000
    );

    expect(snapshot?.savedAt).toBe("2026-08-01T00:00:00.000Z");
    expect(migrationSafetyBackupHasData(snapshot)).toBe(true);
  });

  it("removes a snapshot after the 30-day recovery window", () => {
    const savedAt = Date.UTC(2026, 7, 1);
    storeSnapshot(new Date(savedAt).toISOString());

    const snapshot = getMigrationSafetyBackup(
      savedAt + (MIGRATION_BACKUP_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000
    );

    expect(snapshot).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.autoBackup)).toBeNull();
  });

  it("does not present an empty snapshot as recoverable user data", () => {
    const savedAt = Date.UTC(2026, 7, 1);
    storeSnapshot(new Date(savedAt).toISOString(), []);

    expect(migrationSafetyBackupHasData(getMigrationSafetyBackup(savedAt))).toBe(false);
  });
});
