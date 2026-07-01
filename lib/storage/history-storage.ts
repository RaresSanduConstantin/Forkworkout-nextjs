import type { CompletedWorkout } from "@/lib/types";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";
import { toDayKey } from "@/lib/date/day-key";

/**
 * Normalizes a completed-workout entry, bridging the two legacy shapes:
 * - session entries: { workoutId, title, date }
 * - P90X entries:    { workoutId, workoutName, date }
 * Older entries without a `dayKey` get one derived from their ISO `date`.
 */
function normalizeCompleted(raw: unknown): CompletedWorkout | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const date = typeof c.date === "string" ? c.date : null;
  if (!date) return null;

  const title =
    typeof c.title === "string"
      ? c.title
      : typeof c.workoutName === "string"
      ? c.workoutName
      : "Workout";

  let dayKey = typeof c.dayKey === "string" ? c.dayKey : undefined;
  if (!dayKey) {
    const parsed = new Date(date);
    dayKey = Number.isNaN(parsed.getTime()) ? undefined : toDayKey(parsed);
  }

  return {
    workoutId: typeof c.workoutId === "string" ? c.workoutId : String(c.workoutId ?? ""),
    title,
    date,
    dayKey,
    volume: typeof c.volume === "number" && c.volume > 0 ? c.volume : undefined,
  };
}

/** Reads all completed workouts, normalizing legacy shapes and skipping junk. */
export function getCompletedWorkouts(): CompletedWorkout[] {
  const raw = readJson<unknown[]>(STORAGE_KEYS.completedWorkouts, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeCompleted)
    .filter((c): c is CompletedWorkout => c !== null);
}

/** Appends a completed-workout entry (with a local day key) and persists it. */
export function addCompletedWorkout(entry: {
  workoutId: string;
  title: string;
  date?: string;
  volume?: number;
}): boolean {
  const now = entry.date ? new Date(entry.date) : new Date();
  const completed: CompletedWorkout = {
    workoutId: entry.workoutId,
    title: entry.title,
    date: now.toISOString(),
    dayKey: toDayKey(now),
    volume: entry.volume && entry.volume > 0 ? Math.round(entry.volume) : undefined,
  };
  const existing = getCompletedWorkouts();
  existing.push(completed);
  return writeJson(STORAGE_KEYS.completedWorkouts, existing);
}

/** Returns the set of local day keys that have at least one completed workout. */
export function getCompletedDayKeys(): string[] {
  const keys = new Set<string>();
  for (const c of getCompletedWorkouts()) {
    if (c.dayKey) keys.add(c.dayKey);
  }
  return [...keys];
}

/**
 * Removes a single completed-workout entry (matched by its ISO `date`, which is
 * unique per completion). Removes only the first match.
 */
export function deleteCompletedWorkout(date: string): boolean {
  const all = getCompletedWorkouts();
  const idx = all.findIndex((c) => c.date === date);
  if (idx === -1) return false;
  all.splice(idx, 1);
  return writeJson(STORAGE_KEYS.completedWorkouts, all);
}
