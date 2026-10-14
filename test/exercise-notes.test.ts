// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getExerciseNote, getExerciseNotes, MAX_EXERCISE_NOTE_LENGTH,
  mergeExerciseNotes, setExerciseNote,
} from "@/lib/storage/exercise-notes";
import { getExerciseStableIdByName } from "@/lib/exercises";
import { addCustomExercise, upsertCustomExercise } from "@/lib/storage/custom-exercises";
import { STORAGE_KEYS, MIRRORED_LOCAL_STORAGE_KEYS, STORAGE_REVISION_KEY } from "@/lib/storage/keys";
import { buildExport, mergeImport } from "@/lib/storage/transfer";
import { clearAllData } from "@/lib/storage/reset";
import { runtimeStorageCache } from "@/lib/storage/runtime-cache";
import { IndexedDbLocalStorageMirror } from "@/lib/storage/indexeddb-mirror";
import { initializeStorageEngine } from "@/lib/storage/storage-engine";
import { restoreMigrationSafetyBackup } from "@/lib/storage/migrations";

beforeEach(() => {
  localStorage.clear();
  runtimeStorageCache.reset();
});
afterEach(() => {
  runtimeStorageCache.reset();
  vi.restoreAllMocks();
});

describe("persistent exercise notes", () => {
  it("reuses notes by stable exercise identity independently of workout/session IDs", () => {
    const id = getExerciseStableIdByName([], "Leg Press");
    expect(setExerciseNote(id, "  Seat: 4\nBackrest: 2  ")?.text).toBe("Seat: 4\nBackrest: 2");
    expect(getExerciseNote(getExerciseStableIdByName([], " leg press "))).toBe("Seat: 4\nBackrest: 2");
    expect(getExerciseNote(getExerciseStableIdByName([], "Chest Press"))).toBe("");
    expect(MIRRORED_LOCAL_STORAGE_KEYS).toContain(STORAGE_KEYS.exerciseNotes);
    expect(JSON.parse(localStorage.getItem(STORAGE_REVISION_KEY)!)).toEqual(
      expect.objectContaining({ changes: expect.objectContaining({
        [STORAGE_KEYS.exerciseNotes]: expect.objectContaining({ deleted: false }),
      }) })
    );
  });

  it("keeps custom exercise notes after a library rename", () => {
    const exercise = addCustomExercise({ name: "Gym leg press", defaultUnit: "kg" })!;
    setExerciseNote(getExerciseStableIdByName([], exercise.name), "Seat 3");
    upsertCustomExercise(exercise.name, { name: "Technogym leg press", defaultUnit: "kg" });
    expect(getExerciseNote(getExerciseStableIdByName([], "Technogym leg press"))).toBe("Seat 3");
  });

  it("tolerates empty, corrupt, unsupported and malformed records", () => {
    for (const raw of ["not-json", "null", "[]", '{"version":2,"data":[]}', '{"version":1,"data":{}}']) {
      localStorage.setItem(STORAGE_KEYS.exerciseNotes, raw);
      expect(getExerciseNotes()).toEqual([]);
    }
    localStorage.setItem(STORAGE_KEYS.exerciseNotes, JSON.stringify({ version: 1, data: [
      null, { exerciseId: "", text: "x", updatedAt: "2026-10-01" },
      { exerciseId: "bad", text: 42, updatedAt: "2026-10-01" },
      { exerciseId: "bad", text: "x", updatedAt: "invalid" },
      { exerciseId: "leg", text: "Seat 2", updatedAt: "2026-10-01" },
      { exerciseId: "leg", text: "Seat 4", updatedAt: "2026-10-02" },
    ] }));
    expect(getExerciseNotes()).toEqual([{ exerciseId: "leg", text: "Seat 4", updatedAt: "2026-10-02" }]);
    expect(setExerciseNote("", "x")).toBeNull();
    expect(setExerciseNote("leg", "x".repeat(MAX_EXERCISE_NOTE_LENGTH + 1))).toBeNull();
    expect(getExerciseNote("leg")).toBe("Seat 4");
  });

  it("includes notes in backups, restores them and tolerates older backups", () => {
    setExerciseNote("leg", "Seat 4");
    const bundle = buildExport();
    localStorage.clear();
    mergeImport(JSON.stringify(bundle));
    expect(getExerciseNote("leg")).toBe("Seat 4");
    mergeImport(JSON.stringify({ workouts: [], completedWorkouts: [] }));
    expect(getExerciseNote("leg")).toBe("Seat 4");
  });

  it("validates imported records before merging and preserves newer edits/clears", () => {
    setExerciseNote("leg", "Seat 4");
    const backup = buildExport();
    setExerciseNote("leg", "  ");
    mergeImport(JSON.stringify(backup));
    expect(getExerciseNote("leg")).toBe("");
    mergeExerciseNotes([
      { exerciseId: "leg", text: "Seat 9", updatedAt: "2026-01-01" },
      { exerciseId: "leg", text: null, updatedAt: "2099-01-01" },
    ]);
    expect(getExerciseNote("leg")).toBe("");
  });

  it("restores notes from migration safety snapshots", () => {
    setExerciseNote("leg", "Seat 4");
    const bundle = buildExport();
    setExerciseNote("leg", "Seat 2");
    localStorage.setItem(STORAGE_KEYS.autoBackup, JSON.stringify({
      fromVersion: 0, savedAt: new Date().toISOString(), bundle,
    }));
    expect(restoreMigrationSafetyBackup()).toBe(true);
    expect(getExerciseNote("leg")).toBe("Seat 4");
  });

  it("reloads notes from primary IndexedDB when the LocalStorage copy is missing", async () => {
    setExerciseNote("leg", "Seat 4");
    const factory = new IDBFactory();
    const primary = new IndexedDbLocalStorageMirror(() => factory, "exercise-notes-primary-test");
    await primary.syncFromStorage(localStorage, undefined, "primary");
    localStorage.clear();
    await initializeStorageEngine({ storage: localStorage, database: primary });
    expect(getExerciseNote("leg")).toBe("Seat 4");
    expect(localStorage.getItem(STORAGE_KEYS.exerciseNotes)).toContain("Seat 4");
    await primary.deleteDatabase();
  });

  it("reports a failed save without claiming success", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
    expect(setExerciseNote("leg", "Seat 4")).toBeNull();
  });

  it("removes notes during the app's full data reset", async () => {
    setExerciseNote("leg", "Seat 4");
    await clearAllData({ keepCustomExercises: true });
    expect(getExerciseNotes()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS.exerciseNotes)).toBeNull();
  });
});
