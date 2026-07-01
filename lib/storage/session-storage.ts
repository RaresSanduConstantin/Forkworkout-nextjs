import type { ActiveSession } from "@/lib/types";
import { readJson, writeJson } from "./safe-storage";

// Namespaced key for the in-progress session (new data, so it can be namespaced
// without affecting the legacy `workouts` / `completedWorkouts` keys).
const ACTIVE_SESSION_KEY = "forkworkout:active-session";

/** Returns the saved active session, or null if none / corrupted. */
export function getActiveSession(): ActiveSession | null {
  const raw = readJson<ActiveSession | null>(ACTIVE_SESSION_KEY, null);
  if (!raw || typeof raw !== "object" || typeof raw.workoutId !== "string") {
    return null;
  }
  if (!Array.isArray(raw.exercises)) return null;
  return raw;
}

/** Returns the active session only if it belongs to the given workout id. */
export function getActiveSessionFor(workoutId: string): ActiveSession | null {
  const session = getActiveSession();
  return session && session.workoutId === workoutId ? session : null;
}

/** Persists the active session so progress survives a refresh. */
export function saveActiveSession(session: ActiveSession): boolean {
  return writeJson(ACTIVE_SESSION_KEY, session);
}

/** Clears the active session (on finish or discard). */
export function clearActiveSession(): boolean {
  return writeJson(ACTIVE_SESSION_KEY, null);
}
