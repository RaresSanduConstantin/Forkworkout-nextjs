// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getStorageDiagnostics } from "@/lib/storage/diagnostics";
import { browserIndexedDbStorage } from "@/lib/storage/indexeddb-mirror";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { runtimeStorageCache } from "@/lib/storage/runtime-cache";
import { writeJson } from "@/lib/storage/safe-storage";

beforeEach(() => {
  localStorage.clear();
  runtimeStorageCache.reset();
  Object.defineProperty(window, "indexedDB", {
    configurable: true,
    value: new IDBFactory(),
  });
  runtimeStorageCache.hydrate({}, "indexeddb");
});

afterEach(async () => {
  await browserIndexedDbStorage.deleteDatabase();
  runtimeStorageCache.reset();
  localStorage.clear();
});

describe("storage diagnostics", () => {
  it("reports the active source, durable save, size, backup, and revision", async () => {
    writeJson(STORAGE_KEYS.workouts, [
      { id: "workout-1", title: "Push", exercises: [] },
    ]);
    writeJson(STORAGE_KEYS.gdrive, {
      lastSyncAt: "2026-08-19T12:00:00.000Z",
    });
    writeJson(STORAGE_KEYS.autoBackup, {
      fromVersion: 0,
      savedAt: new Date().toISOString(),
      bundle: {
        version: 1,
        exportedAt: new Date().toISOString(),
        workouts: [{ id: "migration-workout" }],
        completedWorkouts: [],
        bodyMetrics: [],
        customExercises: [],
      },
    });

    const diagnostics = await getStorageDiagnostics();

    expect(diagnostics).toEqual(
      expect.objectContaining({
        source: "indexeddb",
        databaseState: "ready",
        lastBackupAt: "2026-08-19T12:00:00.000Z",
        lastBackupSource: "Google Drive",
        migrationSafetySnapshotAt: expect.any(String),
        recordCount: 3,
      })
    );
    expect(diagnostics.lastSavedAt).toBeTruthy();
    expect(diagnostics.approximateBytes).toBeGreaterThan(0);
    expect(diagnostics.revision).toBeGreaterThan(0);
  });
});
