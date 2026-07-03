// Muscle-group training analytics derived from completed-workout history.
// Counts completed working sets per muscle group over a time window, using the
// exercise library's muscle taxonomy. An exercise counts toward every group it
// targets. Nothing new is persisted.

import type { CompletedWorkout, SetStatus, SetType } from "./types";
import {
  MUSCLE_GROUPS,
  groupsForExerciseName,
  type LibraryExercise,
  type MuscleGroup,
} from "./exercises";

export type MuscleGroupCount = { group: MuscleGroup; sets: number };

/**
 * Completed working sets (warm-ups excluded) per muscle group for a set of
 * exercises with per-set status. Shared by history (windowed) and the live
 * session heatmap.
 */
export function muscleGroupCountsFromExercises(
  exercises: { name: string; sets: { status?: SetStatus; type?: SetType }[] }[],
  library: LibraryExercise[]
): MuscleGroupCount[] {
  const counts = new Map<MuscleGroup, number>(MUSCLE_GROUPS.map((g) => [g, 0]));
  for (const ex of exercises) {
    const doneSets = ex.sets.filter(
      (s) => s.status === "done" && s.type !== "warmup"
    ).length;
    if (doneSets === 0) continue;
    for (const g of groupsForExerciseName(library, ex.name)) {
      counts.set(g, (counts.get(g) ?? 0) + doneSets);
    }
  }
  return MUSCLE_GROUPS.map((group) => ({ group, sets: counts.get(group) ?? 0 }));
}

/**
 * Completed working sets (warm-ups excluded) per muscle group within the last
 * `days` days. Returns one entry per group (in the canonical group order).
 */
export function muscleGroupSetCounts(
  history: CompletedWorkout[],
  library: LibraryExercise[],
  days: number
): MuscleGroupCount[] {
  return muscleGroupCountsFromExercises(collectWindowExercises(history, days), library);
}

/** Flattened exercises from all workouts within the last `days` days. */
export function collectWindowExercises(
  history: CompletedWorkout[],
  days: number
): { name: string; sets: { status?: SetStatus; type?: SetType }[] }[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const exercises: { name: string; sets: { status?: SetStatus; type?: SetType }[] }[] = [];
  for (const w of history) {
    const t = new Date(w.date).getTime();
    if (!Number.isFinite(t) || t < cutoff) continue;
    if (w.exercises) exercises.push(...w.exercises);
  }
  return exercises;
}

/** Total sets across all groups (for headline / empty-state checks). */
export function totalSets(counts: MuscleGroupCount[]): number {
  return counts.reduce((sum, c) => sum + c.sets, 0);
}

/**
 * Per-group intensity in [0, 1], scaled to the busiest group so the heatmap and
 * bars share a consistent scale. All-zero input yields all zeros.
 */
export function muscleIntensities(
  counts: MuscleGroupCount[]
): Record<MuscleGroup, number> {
  const max = counts.reduce((m, c) => Math.max(m, c.sets), 0);
  const out = {} as Record<MuscleGroup, number>;
  for (const c of counts) out[c.group] = max > 0 ? c.sets / max : 0;
  return out;
}
