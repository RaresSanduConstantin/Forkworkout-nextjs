import type { ActiveSession } from "@/lib/types";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

/** Returns the saved active session, or null if none / corrupted. */
export function getActiveSession(): ActiveSession | null {
  const raw = readJson<ActiveSession | null>(STORAGE_KEYS.activeSession, null);
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
  return writeJson(STORAGE_KEYS.activeSession, session);
}

/** Clears the active session (on finish or discard). */
export function clearActiveSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.activeSession);
    return true;
  } catch {
    return false;
  }
}
