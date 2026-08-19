// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { IndexedDbLocalStorageMirror } from "@/lib/storage/indexeddb-mirror";
import { STORAGE_KEYS } from "@/lib/storage/keys";

let factory: IDBFactory;
let mirror: IndexedDbLocalStorageMirror;

beforeEach(() => {
  localStorage.clear();
  factory = new IDBFactory();
  mirror = new IndexedDbLocalStorageMirror(() => factory, "forkworkout-test");
});

describe("IndexedDB LocalStorage mirror", () => {
  it("does not create an empty database for a fresh or fully reset user", async () => {
    await expect(mirror.syncFromStorage(localStorage)).resolves.toEqual({
      state: "not-started",
      recordCount: 0,
    });
    expect((await factory.databases()).map((database) => database.name)).not.toContain(
      "forkworkout-test"
    );
  });

  it("copies existing managed values without touching LocalStorage", async () => {
    const workouts = JSON.stringify([{ id: "workout-1", title: "Push", exercises: [] }]);
    localStorage.setItem(STORAGE_KEYS.workouts, workouts);
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ weeklyGoal: 4 }));
    localStorage.setItem("unrelated-app-key", "leave-me-alone");

    const status = await mirror.syncFromStorage(localStorage);

    expect(status).toEqual(expect.objectContaining({ state: "ready", recordCount: 2 }));
    expect(await mirror.get(STORAGE_KEYS.workouts)).toBe(workouts);
    expect(await mirror.get(STORAGE_KEYS.settings)).toBe(
      JSON.stringify({ weeklyGoal: 4 })
    );
    expect(await mirror.get("unrelated-app-key")).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.workouts)).toBe(workouts);
  });

  it("removes stale mirrored keys during a later full sync", async () => {
    localStorage.setItem(STORAGE_KEYS.workouts, JSON.stringify([{ id: "old" }]));
    await mirror.syncFromStorage(localStorage);
    localStorage.removeItem(STORAGE_KEYS.workouts);
    localStorage.setItem(STORAGE_KEYS.bodyMetrics, JSON.stringify([{ id: "metric-1" }]));

    const status = await mirror.syncFromStorage(localStorage);

    expect(status).toEqual(expect.objectContaining({ state: "ready", recordCount: 1 }));
    expect(await mirror.get(STORAGE_KEYS.workouts)).toBeNull();
    expect(await mirror.get(STORAGE_KEYS.bodyMetrics)).toBe(
      JSON.stringify([{ id: "metric-1" }])
    );
  });

  it("serializes incremental writes and deletes after the initial copy", async () => {
    await mirror.syncFromStorage(localStorage);

    await mirror.set(STORAGE_KEYS.activeSession, "{\"workoutId\":\"one\"}");
    expect(await mirror.get(STORAGE_KEYS.activeSession)).toBe(
      "{\"workoutId\":\"one\"}"
    );

    await mirror.delete(STORAGE_KEYS.activeSession);
    expect(await mirror.get(STORAGE_KEYS.activeSession)).toBeNull();
    expect(await mirror.getStatus()).toEqual(
      expect.objectContaining({ state: "ready", recordCount: 0 })
    );
  });

  it("fails open when IndexedDB is unavailable", async () => {
    const unavailable = new IndexedDbLocalStorageMirror(() => undefined);
    localStorage.setItem(STORAGE_KEYS.workouts, "[]");

    await expect(unavailable.syncFromStorage(localStorage)).resolves.toEqual({
      state: "unavailable",
      recordCount: 0,
    });
    expect(localStorage.getItem(STORAGE_KEYS.workouts)).toBe("[]");
  });

  it("deletes the complete database and its metadata", async () => {
    localStorage.setItem(STORAGE_KEYS.workouts, JSON.stringify([{ id: "workout-1" }]));
    await mirror.syncFromStorage(localStorage);
    expect((await factory.databases()).map((database) => database.name)).toContain(
      "forkworkout-test"
    );

    await expect(mirror.deleteDatabase()).resolves.toBe(true);

    expect((await factory.databases()).map((database) => database.name)).not.toContain(
      "forkworkout-test"
    );
  });
});
