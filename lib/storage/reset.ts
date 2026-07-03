import { STORAGE_KEYS } from "./keys";
import { clearActiveSession } from "./session-storage";

/**
 * Wipes ForkWorkout data from this device: saved workouts, completed-workout
 * history, body metrics, and any in-progress session. Custom exercises are wiped
 * too unless `keepCustomExercises` is set. Irreversible.
 */
export function clearAllData(options?: { keepCustomExercises?: boolean }): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.workouts);
    window.localStorage.removeItem(STORAGE_KEYS.completedWorkouts);
    window.localStorage.removeItem(STORAGE_KEYS.bodyMetrics);
    window.localStorage.removeItem(STORAGE_KEYS.autoBackup);
    window.localStorage.removeItem(STORAGE_KEYS.schemaVersion);
    if (!options?.keepCustomExercises) {
      window.localStorage.removeItem(STORAGE_KEYS.customExercises);
    }
  } catch {
    /* ignore storage access errors */
  }
  clearActiveSession();
}
