// @vitest-environment jsdom
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { getBodyMetrics } from "@/lib/storage/body-storage";
import { getCustomExercises } from "@/lib/storage/custom-exercises";
import { getDailyTrainingStates } from "@/lib/storage/daily-training-state";
import { getExercisePreferences } from "@/lib/storage/exercise-preferences";
import { getCompletedWorkouts } from "@/lib/storage/history-storage";
import {
  browserIndexedDbStorage,
  IndexedDbLocalStorageMirror,
} from "@/lib/storage/indexeddb-mirror";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { getPerformanceFeedback } from "@/lib/storage/performance-feedback";
import { getProgramState } from "@/lib/storage/program-storage";
import { runtimeStorageCache } from "@/lib/storage/runtime-cache";
import { initializeStorageEngine } from "@/lib/storage/storage-engine";
import { clearAllData } from "@/lib/storage/reset";
import { flushStoragePersistence } from "@/lib/storage/safe-storage";
import { buildExport, mergeImport, type ExportBundle } from "@/lib/storage/transfer";
import { getWorkouts } from "@/lib/storage/workout-storage";

const privateFixtureDirectory = path.join(process.cwd(), "test/fixtures/private");
const privateFixturePath = existsSync(privateFixtureDirectory)
  ? readdirSync(privateFixtureDirectory)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .at(-1)
  : undefined;
const fixture = privateFixturePath
  ? (JSON.parse(
      readFileSync(path.join(privateFixtureDirectory, privateFixturePath), "utf8")
    ) as ExportBundle)
  : null;
const privateDescribe = fixture ? describe : describe.skip;

function seedLocalStorage(bundle: ExportBundle): void {
  localStorage.setItem(STORAGE_KEYS.workouts, JSON.stringify(bundle.workouts ?? []));
  localStorage.setItem(
    STORAGE_KEYS.programs,
    JSON.stringify({
      version: 1,
      programs: bundle.programs ?? [],
      activeProgramId: bundle.activeProgramId,
      progressByProgramId: bundle.programProgress,
    })
  );
  localStorage.setItem(
    STORAGE_KEYS.completedWorkouts,
    JSON.stringify(bundle.completedWorkouts ?? [])
  );
  localStorage.setItem(STORAGE_KEYS.bodyMetrics, JSON.stringify(bundle.bodyMetrics ?? []));
  localStorage.setItem(
    STORAGE_KEYS.customExercises,
    JSON.stringify(bundle.customExercises ?? [])
  );
  localStorage.setItem(
    STORAGE_KEYS.exercisePreferences,
    JSON.stringify({ version: 1, data: bundle.exercisePreferences ?? [] })
  );
  localStorage.setItem(
    STORAGE_KEYS.performanceFeedback,
    JSON.stringify({ version: 1, data: bundle.performanceFeedback ?? [] })
  );
  localStorage.setItem(
    STORAGE_KEYS.dailyTrainingState,
    JSON.stringify({ version: 1, data: bundle.dailyTrainingStates ?? [] })
  );
  if (bundle.bodyProfile) {
    localStorage.setItem(STORAGE_KEYS.bodyProfile, JSON.stringify(bundle.bodyProfile));
  }
  if (bundle.settings) {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(bundle.settings));
  }
  if (bundle.homeEquipment) {
    localStorage.setItem(STORAGE_KEYS.homeEquipment, JSON.stringify(bundle.homeEquipment));
  }
  localStorage.setItem(STORAGE_KEYS.schemaVersion, JSON.stringify(bundle.version));
}

beforeEach(() => {
  localStorage.clear();
  runtimeStorageCache.reset();
});

privateDescribe("private current-data regression fixture", () => {
  it("has a valid, internally consistent export structure", () => {
    const bundle = fixture!;
    const workoutIds = new Set(bundle.workouts.map((workout) => workout.id));
    const programIds = new Set((bundle.programs ?? []).map((program) => program.id));
    const completionDates = bundle.completedWorkouts.map((entry) => entry.date);

    expect(bundle.version).toBe(1);
    expect(Number.isFinite(Date.parse(bundle.exportedAt))).toBe(true);
    expect(workoutIds.size).toBe(bundle.workouts.length);
    expect(programIds.size).toBe((bundle.programs ?? []).length);
    expect(new Set(completionDates).size).toBe(completionDates.length);
    expect(completionDates.every((date) => Number.isFinite(Date.parse(date)))).toBe(true);
    expect(
      (bundle.programs ?? []).every((program) =>
        program.workoutIds.every((workoutId) => workoutIds.has(workoutId))
      )
    ).toBe(true);
  });

  it("survives all LocalStorage normalizers and a new export", () => {
    const bundle = fixture!;
    seedLocalStorage(bundle);

    expect(getWorkouts()).toHaveLength(bundle.workouts.length);
    expect(getProgramState().programs).toHaveLength((bundle.programs ?? []).length);
    expect(getCompletedWorkouts()).toHaveLength(bundle.completedWorkouts.length);
    expect(getBodyMetrics()).toHaveLength(bundle.bodyMetrics.length);
    expect(getCustomExercises()).toHaveLength(bundle.customExercises.length);
    expect(getExercisePreferences(0)).toHaveLength(bundle.exercisePreferences?.length ?? 0);
    expect(getPerformanceFeedback()).toHaveLength(bundle.performanceFeedback?.length ?? 0);
    expect(getDailyTrainingStates()).toHaveLength(bundle.dailyTrainingStates?.length ?? 0);

    const exportedAgain = buildExport();
    expect(exportedAgain.workouts).toHaveLength(bundle.workouts.length);
    expect(exportedAgain.completedWorkouts).toHaveLength(bundle.completedWorkouts.length);
    expect(exportedAgain.bodyMetrics).toHaveLength(bundle.bodyMetrics.length);
    expect(exportedAgain.customExercises).toHaveLength(bundle.customExercises.length);
  });

  it("merges every supported collection into an empty installation", () => {
    const bundle = fixture!;
    const result = mergeImport(JSON.stringify(bundle));

    expect(result.workoutsAdded).toBe(bundle.workouts.length);
    expect(result.programsAdded).toBe(bundle.programs?.length ?? 0);
    expect(result.historyAdded).toBe(bundle.completedWorkouts.length);
    expect(result.bodyAdded).toBe(bundle.bodyMetrics.length);
    expect(result.exercisesAdded).toBe(bundle.customExercises.length);
    expect(getExercisePreferences(0)).toHaveLength(bundle.exercisePreferences?.length ?? 0);
    expect(getPerformanceFeedback()).toHaveLength(bundle.performanceFeedback?.length ?? 0);
    expect(getDailyTrainingStates()).toHaveLength(bundle.dailyTrainingStates?.length ?? 0);
  });

  it("migrates to IndexedDB and recovers after LocalStorage disappears", async () => {
    const bundle = fixture!;
    seedLocalStorage(bundle);
    const factory = new IDBFactory();
    const database = new IndexedDbLocalStorageMirror(
      () => factory,
      "forkworkout-private-regression"
    );

    const cutover = await initializeStorageEngine({ storage: localStorage, database });
    expect(cutover).toEqual(
      expect.objectContaining({ mode: "indexeddb", source: "localstorage" })
    );

    localStorage.clear();
    runtimeStorageCache.reset();
    const recovery = await initializeStorageEngine({ storage: localStorage, database });

    expect(recovery).toEqual(
      expect.objectContaining({
        mode: "indexeddb",
        source: "indexeddb",
        recoveredFromIndexedDb: true,
      })
    );
    expect(getWorkouts()).toHaveLength(bundle.workouts.length);
    expect(getCompletedWorkouts()).toHaveLength(bundle.completedWorkouts.length);
    expect(getBodyMetrics()).toHaveLength(bundle.bodyMetrics.length);
    expect(getCustomExercises()).toHaveLength(bundle.customExercises.length);
    await database.deleteDatabase();
  });

  it("survives delete, JSON restore, and an IndexedDB-only restart", async () => {
    const bundle = fixture!;
    const factory = new IDBFactory();
    Object.defineProperty(window, "indexedDB", { configurable: true, value: factory });
    runtimeStorageCache.hydrate({}, "indexeddb");

    await clearAllData();
    const result = mergeImport(JSON.stringify(bundle), { restoreSettings: true });
    expect(result.workoutsAdded).toBe(bundle.workouts.length);
    expect(result.historyAdded).toBe(bundle.completedWorkouts.length);
    expect(await flushStoragePersistence()).toBe(true);

    localStorage.clear();
    runtimeStorageCache.reset();
    const recovery = await initializeStorageEngine({
      storage: localStorage,
      database: browserIndexedDbStorage,
    });

    expect(recovery.source).toBe("indexeddb");
    expect(getWorkouts()).toHaveLength(bundle.workouts.length);
    expect(getProgramState().programs).toHaveLength(bundle.programs?.length ?? 0);
    expect(getCompletedWorkouts()).toHaveLength(bundle.completedWorkouts.length);
    expect(getBodyMetrics()).toHaveLength(bundle.bodyMetrics.length);
    expect(getCustomExercises()).toHaveLength(bundle.customExercises.length);
    expect(getExercisePreferences(0)).toHaveLength(bundle.exercisePreferences?.length ?? 0);
    expect(getPerformanceFeedback()).toHaveLength(bundle.performanceFeedback?.length ?? 0);
    expect(getDailyTrainingStates()).toHaveLength(bundle.dailyTrainingStates?.length ?? 0);
    const recoveredBundle = buildExport();
    expect(JSON.stringify(recoveredBundle.settings) === JSON.stringify(bundle.settings)).toBe(true);
    expect(
      JSON.stringify(recoveredBundle.bodyProfile) === JSON.stringify(bundle.bodyProfile)
    ).toBe(true);
    expect(
      JSON.stringify(recoveredBundle.homeEquipment) === JSON.stringify(bundle.homeEquipment)
    ).toBe(true);
    expect(recoveredBundle.activeProgramId).toBe(bundle.activeProgramId);
    expect(
      JSON.stringify(recoveredBundle.programProgress) === JSON.stringify(bundle.programProgress)
    ).toBe(true);
    await browserIndexedDbStorage.deleteDatabase();
  });
});
