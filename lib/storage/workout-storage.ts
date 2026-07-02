import type { Workout } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { normalizeUnitValue } from "@/lib/workout";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

/**
 * Normalizes an unknown value into a valid Workout, dropping anything malformed.
 * Returns null when the entry cannot be salvaged into a usable workout.
 */
function normalizeWorkout(raw: unknown): Workout | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Record<string, unknown>;
  if (typeof w.id !== "string" || w.id.length === 0) return null;

  const exercises = Array.isArray(w.exercises) ? w.exercises : [];
  return {
    id: w.id,
    title: typeof w.title === "string" ? w.title : "",
    rest: typeof w.rest === "string" ? w.rest : undefined,
    createdAt: typeof w.createdAt === "string" ? w.createdAt : undefined,
    updatedAt: typeof w.updatedAt === "string" ? w.updatedAt : undefined,
    exercises: exercises.map((ex) => {
      const e = (ex ?? {}) as Record<string, unknown>;
      const sets = Array.isArray(e.sets) ? e.sets : [];
      return {
        id: typeof e.id === "string" ? e.id : uuidv4(),
        name: typeof e.name === "string" ? e.name : "",
        rest: typeof e.rest === "string" ? e.rest : undefined,
        sets: sets.map((s) => {
          const set = (s ?? {}) as Record<string, unknown>;
          const reps =
            typeof set.reps === "number"
              ? set.reps
              : Number.parseInt(String(set.reps), 10) || 0;
          const rawValue =
            typeof set.value === "string" ? set.value : String(set.value ?? "");
          const { unit, value } = normalizeUnitValue(
            rawValue,
            typeof set.unit === "string" ? set.unit : undefined
          );
          return {
            id: typeof set.id === "string" ? set.id : uuidv4(),
            reps,
            value,
            unit,
          };
        }),
      };
    }),
  };
}

/** Reads all saved workouts, tolerating empty/corrupted storage. */
export function getWorkouts(): Workout[] {
  const raw = readJson<unknown[]>(STORAGE_KEYS.workouts, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeWorkout)
    .filter((w): w is Workout => w !== null);
}

/** Reads a single workout by id, or null if not found. */
export function getWorkoutById(id: string): Workout | null {
  return getWorkouts().find((w) => w.id === id) ?? null;
}

/** Persists the full workouts list. Returns false if storage failed. */
export function saveWorkouts(workouts: Workout[]): boolean {
  return writeJson(STORAGE_KEYS.workouts, workouts);
}

/** Inserts or updates a workout by id and persists the result. */
export function upsertWorkout(workout: Workout): boolean {
  const workouts = getWorkouts();
  const idx = workouts.findIndex((w) => w.id === workout.id);
  if (idx === -1) {
    workouts.push(workout);
  } else {
    workouts[idx] = workout;
  }
  return saveWorkouts(workouts);
}

/** Removes a workout by id and persists the result. */
export function deleteWorkout(id: string): boolean {
  return saveWorkouts(getWorkouts().filter((w) => w.id !== id));
}

/** Clones a workout (new ids, "Copy of …" title) and persists it. */
export function duplicateWorkout(id: string): Workout | null {
  const src = getWorkoutById(id);
  if (!src) return null;
  const now = new Date().toISOString();
  const copy: Workout = {
    ...src,
    id: uuidv4(),
    title: `Copy of ${src.title || "workout"}`.slice(0, 50),
    createdAt: now,
    updatedAt: now,
    exercises: src.exercises.map((ex) => ({
      ...ex,
      id: uuidv4(),
      sets: ex.sets.map((s) => ({ ...s, id: uuidv4() })),
    })),
  };
  return upsertWorkout(copy) ? copy : null;
}
