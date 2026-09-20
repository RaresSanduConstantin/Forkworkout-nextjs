import { STORAGE_KEYS, STORAGE_RESET_KEY, THEME_STORAGE_KEY } from "./keys";
import {
  browserIndexedDbStorage,
  deleteIndexedDbMirror,
} from "./indexeddb-mirror";
import { CURRENT_SCHEMA_VERSION } from "./migrations";
import { runtimeStorageCache } from "./runtime-cache";
import { removeJson, writeJson } from "./safe-storage";
import { clearActiveSession } from "./session-storage";

/**
 * Wipes all user-owned ForkWorkout data from this device. The current schema
 * marker is retained so the next app load does not mistake a deliberate reset
 * for an old installation and create a new auto-backup. Custom exercises are
 * wiped too unless `keepCustomExercises` is set. Irreversible.
 */
export async function clearAllData(options?: { keepCustomExercises?: boolean }): Promise<void> {
  if (typeof window === "undefined") return;
  let keptCustomExercises: string | null = null;
  if (options?.keepCustomExercises) {
    try {
      keptCustomExercises = runtimeStorageCache.isReady()
        ? runtimeStorageCache.get(STORAGE_KEYS.customExercises)
        : window.localStorage.getItem(STORAGE_KEYS.customExercises);
    } catch {
      // Continue deleting all other data when LocalStorage is restricted.
    }
  }
  const userDataKeys = [
    STORAGE_KEYS.workouts,
    STORAGE_KEYS.programs,
    STORAGE_KEYS.completedWorkouts,
    STORAGE_KEYS.bodyMetrics,
    STORAGE_KEYS.exercisePreferences,
    STORAGE_KEYS.performanceFeedback,
    STORAGE_KEYS.dailyTrainingState,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.bodyProfile,
    STORAGE_KEYS.homeEquipment,
    STORAGE_KEYS.gdrive,
    STORAGE_KEYS.autoBackup,
    STORAGE_KEYS.nutritionEntries,
    STORAGE_KEYS.nutritionTargets,
    STORAGE_KEYS.nutritionDayAdjustments,
    STORAGE_KEYS.customNutritionFoods,
    STORAGE_KEYS.nutritionFoodPreferences,
    STORAGE_KEYS.nutritionSavedMeals,
    STORAGE_KEYS.nutritionBarcodeProducts,
  ];
  for (const key of userDataKeys) removeJson(key);
  if (!options?.keepCustomExercises) {
    removeJson(STORAGE_KEYS.customExercises);
  }
  removeJson(THEME_STORAGE_KEY);
  clearActiveSession();
  // Keep migration bookkeeping only; settings now fall back to defaults, which
  // includes `onboardingDone: false`.
  writeJson(STORAGE_KEYS.schemaVersion, CURRENT_SCHEMA_VERSION);
  try {
    window.localStorage.setItem(STORAGE_RESET_KEY, new Date().toISOString());
  } catch {
    // The direct IndexedDB deletion still prevents recovery in this tab.
  }
  // Queue this after all mirrored deletions. The database itself and its
  // migration metadata are removed, not merely emptied.
  await deleteIndexedDbMirror();
  // Keeping custom exercises is an explicit partial reset. Recreate only that
  // retained record after the old database and metadata are gone, and wait for
  // it so the reset cannot race a subsequent import.
  if (keptCustomExercises !== null) {
    try {
      await browserIndexedDbStorage.set(
        STORAGE_KEYS.customExercises,
        keptCustomExercises,
        runtimeStorageCache.getRevision()
      );
    } catch {
      // The LocalStorage fallback still contains the retained exercises.
    }
  }
}
