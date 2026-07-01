import { STORAGE_KEYS } from "./keys";
import { clearActiveSession } from "./session-storage";

/**
 * Wipes all ForkWorkout data from this device: saved workouts, completed-workout
 * history, and any in-progress session. Irreversible.
 */
export function clearAllData(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.workouts);
    window.localStorage.removeItem(STORAGE_KEYS.completedWorkouts);
  } catch {
    /* ignore storage access errors */
  }
  clearActiveSession();
}
