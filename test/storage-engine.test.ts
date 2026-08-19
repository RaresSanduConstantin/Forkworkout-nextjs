// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  browserIndexedDbStorage,
  IndexedDbLocalStorageMirror,
} from "@/lib/storage/indexeddb-mirror";
import { STORAGE_KEYS, STORAGE_RESET_KEY } from "@/lib/storage/keys";
import { runtimeStorageCache } from "@/lib/storage/runtime-cache";
import {
  flushStoragePersistence,
  readJson,
  writeJson,
} from "@/lib/storage/safe-storage";
import { initializeStorageEngine } from "@/lib/storage/storage-engine";
import { clearAllData } from "@/lib/storage/reset";
import { mergeImport } from "@/lib/storage/transfer";

let factory: IDBFactory;
let database: IndexedDbLocalStorageMirror;

beforeEach(() => {
  localStorage.clear();
  runtimeStorageCache.reset();
  factory = new IDBFactory();
  database = new IndexedDbLocalStorageMirror(() => factory, "forkworkout-engine-test");
});

describe("IndexedDB primary storage cutover", () => {
  it("migrates an existing LocalStorage user and marks IndexedDB primary", async () => {
    const workouts = [{ id: "workout-1", title: "Push", exercises: [] }];
    localStorage.setItem(STORAGE_KEYS.workouts, JSON.stringify(workouts));

    const result = await initializeStorageEngine({ storage: localStorage, database });

    expect(result).toEqual(
      expect.objectContaining({ mode: "indexeddb", source: "localstorage", recordCount: 1 })
    );
    expect(readJson(STORAGE_KEYS.workouts, [])).toEqual(workouts);
    expect(await database.getSnapshot()).toEqual(
      expect.objectContaining({ state: "ready", mode: "primary" })
    );
  });

  it("recovers from a pre-cutover mirror when LocalStorage is unexpectedly empty", async () => {
    const workouts = JSON.stringify([{ id: "workout-1", title: "Recovered" }]);
    localStorage.setItem(STORAGE_KEYS.workouts, workouts);
    await database.syncFromStorage(localStorage); // Old rollout: mirror mode.
    localStorage.clear();

    const result = await initializeStorageEngine({ storage: localStorage, database });

    expect(result).toEqual(
      expect.objectContaining({
        mode: "indexeddb",
        source: "indexeddb",
        recoveredFromIndexedDb: true,
      })
    );
    expect(readJson(STORAGE_KEYS.workouts, [])).toEqual([
      { id: "workout-1", title: "Recovered" },
    ]);
    expect(localStorage.getItem(STORAGE_KEYS.workouts)).toBe(workouts);
    expect((await database.getSnapshot()).mode).toBe("primary");
  });

  it("keeps IndexedDB authoritative after cutover when fallback data diverges", async () => {
    localStorage.setItem(
      STORAGE_KEYS.workouts,
      JSON.stringify([{ id: "workout-idb", title: "IndexedDB" }])
    );
    await database.syncFromStorage(localStorage, undefined, "primary");
    localStorage.setItem(
      STORAGE_KEYS.workouts,
      JSON.stringify([{ id: "workout-local", title: "Stale fallback" }])
    );

    await initializeStorageEngine({ storage: localStorage, database });

    expect(readJson<{ id: string }[]>(STORAGE_KEYS.workouts, [])[0].id).toBe(
      "workout-idb"
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.workouts) ?? "[]")[0].id).toBe(
      "workout-idb"
    );
  });

  it("repairs malformed primary records from a valid LocalStorage fallback", async () => {
    const fallback = JSON.stringify([{ id: "fallback-workout", title: "Recovered" }]);
    localStorage.setItem(STORAGE_KEYS.workouts, fallback);
    await database.syncFromStorage(localStorage, undefined, "primary");
    await database.set(STORAGE_KEYS.workouts, "{not-valid-json");

    await initializeStorageEngine({ storage: localStorage, database });

    expect(readJson<{ id: string }[]>(STORAGE_KEYS.workouts, [])[0].id).toBe(
      "fallback-workout"
    );
    expect(await database.get(STORAGE_KEYS.workouts)).toBe(fallback);
  });

  it("falls back to LocalStorage when IndexedDB is unavailable", async () => {
    const unavailable = new IndexedDbLocalStorageMirror(() => undefined);
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ weeklyGoal: 5 }));

    const result = await initializeStorageEngine({
      storage: localStorage,
      database: unavailable,
    });

    expect(result.mode).toBe("localstorage");
    expect(readJson(STORAGE_KEYS.settings, null)).toEqual({ weeklyGoal: 5 });
  });

  it("keeps saving to primary IndexedDB when the LocalStorage fallback is full", async () => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: factory });
    runtimeStorageCache.hydrate({}, "indexeddb");
    const localWrite = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });
    const settings = { weeklyGoal: 6 };

    expect(writeJson(STORAGE_KEYS.settings, settings)).toBe(true);
    expect(readJson(STORAGE_KEYS.settings, null)).toEqual(settings);
    expect(await browserIndexedDbStorage.get(STORAGE_KEYS.settings)).toBe(
      JSON.stringify(settings)
    );

    localWrite.mockRestore();
    await browserIndexedDbStorage.deleteDatabase();
  });

  it("durably restores a JSON backup immediately after deleting all data", async () => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: factory });
    runtimeStorageCache.hydrate({}, "indexeddb");

    await clearAllData();
    mergeImport(
      JSON.stringify({
        version: 1,
        exportedAt: "2026-08-19T10:00:00.000Z",
        workouts: [{ id: "restored-workout", title: "Restored", exercises: [] }],
        completedWorkouts: [],
        bodyMetrics: [],
        customExercises: [],
      })
    );

    expect(await flushStoragePersistence()).toBe(true);
    expect(localStorage.getItem(STORAGE_RESET_KEY)).toBeNull();
    expect(JSON.parse((await browserIndexedDbStorage.get(STORAGE_KEYS.workouts)) ?? "[]"))
      .toEqual([expect.objectContaining({ id: "restored-workout" })]);

    // Simulate losing the compatibility fallback and starting a fresh runtime:
    // the restored backup must still load from IndexedDB.
    localStorage.clear();
    runtimeStorageCache.reset();
    const result = await initializeStorageEngine({
      storage: localStorage,
      database: browserIndexedDbStorage,
    });

    expect(result).toEqual(
      expect.objectContaining({ source: "indexeddb", recoveredFromIndexedDb: true })
    );
    expect(readJson<{ id: string }[]>(STORAGE_KEYS.workouts, [])[0]?.id).toBe(
      "restored-workout"
    );
    await browserIndexedDbStorage.deleteDatabase();
  });

  it("does not resurrect a database older than an explicit reset tombstone", async () => {
    localStorage.setItem(
      STORAGE_KEYS.workouts,
      JSON.stringify([{ id: "old-workout", title: "Deleted" }])
    );
    await database.syncFromStorage(localStorage, undefined, "primary");
    localStorage.clear();
    localStorage.setItem(STORAGE_RESET_KEY, "2999-01-01T00:00:00.000Z");

    const result = await initializeStorageEngine({ storage: localStorage, database });

    expect(result).toEqual(expect.objectContaining({ source: "fresh", recordCount: 0 }));
    expect(readJson(STORAGE_KEYS.workouts, [])).toEqual([]);
    expect((await factory.databases()).map((entry) => entry.name)).not.toContain(
      "forkworkout-engine-test"
    );
  });
});
