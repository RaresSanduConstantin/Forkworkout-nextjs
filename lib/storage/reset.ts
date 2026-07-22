import { STORAGE_KEYS } from "./keys";
import { CURRENT_SCHEMA_VERSION } from "./migrations";
import { writeJson } from "./safe-storage";
import { clearActiveSession } from "./session-storage";

/**
 * Wipes all user-owned ForkWorkout data from this device. The current schema
 * marker is retained so the next app load does not mistake a deliberate reset
 * for an old installation and create a new auto-backup. Custom exercises are
 * wiped too unless `keepCustomExercises` is set. Irreversible.
 */
export function clearAllData(options?: { keepCustomExercises?: boolean }): void {
  if (typeof window === "undefined") return;
  try {
    const userDataKeys = [
      STORAGE_KEYS.workouts,
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
    ];
    for (const key of userDataKeys) window.localStorage.removeItem(key);
    if (!options?.keepCustomExercises) {
      window.localStorage.removeItem(STORAGE_KEYS.customExercises);
    }
  } catch {
    /* ignore storage access errors */
  }
  clearActiveSession();
  // Keep migration bookkeeping only; settings now fall back to defaults, which
  // includes `onboardingDone: false`.
  writeJson(STORAGE_KEYS.schemaVersion, CURRENT_SCHEMA_VERSION);
}
