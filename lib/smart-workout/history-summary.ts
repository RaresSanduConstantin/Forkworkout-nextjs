import {
  MUSCLE_TARGETS,
  type LibraryExercise,
  type MuscleTargetKey,
} from "@/lib/exercises";
import type { CompletedWorkout } from "@/lib/types";
import { currentWeekDayKeys, toDayKey } from "@/lib/date/day-key";

export const SECONDARY_MUSCLE_SET_MULTIPLIER = 0.5;

export type MuscleTrainingStatus = {
  muscle: MuscleTargetKey;
  completedSetsThisWeek: number;
  completedSetsLast7Days: number;
  lastTrainedAt?: string;
  hoursSinceLastTrained?: number;
  recentWorkoutCount: number;
};

function exerciseKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function targetsForLibraryMuscles(muscles: string[]): Set<MuscleTargetKey> {
  const normalized = new Set(muscles.map((muscle) => muscle.toLowerCase()));
  return new Set(
    MUSCLE_TARGETS.filter((target) =>
      target.lib.some((muscle) => normalized.has(muscle.toLowerCase()))
    ).map((target) => target.key)
  );
}

/**
 * Pure local-history aggregation. Only completed, non-warm-up sets count.
 * Primary muscles receive one set; secondary muscles receive half a set.
 * Exact duplicate exercise snapshots inside one workout are ignored.
 */
export function summarizeMuscleTraining(
  history: CompletedWorkout[],
  library: LibraryExercise[],
  now: Date = new Date()
): MuscleTrainingStatus[] {
  const output = new Map<MuscleTargetKey, MuscleTrainingStatus>(
    MUSCLE_TARGETS.map((target) => [
      target.key,
      {
        muscle: target.key,
        completedSetsThisWeek: 0,
        completedSetsLast7Days: 0,
        recentWorkoutCount: 0,
      },
    ])
  );
  const libraryByName = new Map(library.map((exercise) => [exerciseKey(exercise.name), exercise]));
  const weekKeys = currentWeekDayKeys(now);
  const nowMs = now.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  for (const workout of history) {
    const workoutMs = Date.parse(workout.date);
    if (!Number.isFinite(workoutMs) || workoutMs > nowMs + 5 * 60 * 1000) continue;
    const dayKey = workout.dayKey ?? toDayKey(new Date(workoutMs));
    const withinSevenDays = nowMs - workoutMs <= sevenDaysMs;
    const withinThisWeek = weekKeys.has(dayKey);
    const workoutContributions = new Map<MuscleTargetKey, number>();
    const seenSnapshots = new Set<string>();

    for (const completedExercise of workout.exercises ?? []) {
      if (!completedExercise?.name || !Array.isArray(completedExercise.sets)) continue;
      const signature = `${exerciseKey(completedExercise.name)}:${JSON.stringify(completedExercise.sets)}`;
      if (seenSnapshots.has(signature)) continue;
      seenSnapshots.add(signature);

      const exercise = libraryByName.get(exerciseKey(completedExercise.name));
      if (!exercise) continue;
      const completedWorkingSets = completedExercise.sets.filter(
        (set) => set?.status === "done" && set.type !== "warmup"
      ).length;
      if (completedWorkingSets === 0) continue;

      const primaryTargets = targetsForLibraryMuscles(exercise.primaryMuscles ?? []);
      const secondaryTargets = targetsForLibraryMuscles(exercise.secondaryMuscles ?? []);
      for (const muscle of primaryTargets) {
        workoutContributions.set(
          muscle,
          (workoutContributions.get(muscle) ?? 0) + completedWorkingSets
        );
      }
      for (const muscle of secondaryTargets) {
        if (primaryTargets.has(muscle)) continue;
        workoutContributions.set(
          muscle,
          (workoutContributions.get(muscle) ?? 0) +
            completedWorkingSets * SECONDARY_MUSCLE_SET_MULTIPLIER
        );
      }
    }

    for (const [muscle, sets] of workoutContributions) {
      if (sets <= 0) continue;
      const status = output.get(muscle)!;
      if (withinSevenDays) {
        status.completedSetsLast7Days += sets;
        status.recentWorkoutCount += 1;
      }
      if (withinThisWeek) status.completedSetsThisWeek += sets;
      if (!status.lastTrainedAt || workoutMs > Date.parse(status.lastTrainedAt)) {
        status.lastTrainedAt = workout.date;
      }
    }
  }

  return MUSCLE_TARGETS.map((target) => {
    const status = output.get(target.key)!;
    if (!status.lastTrainedAt) return status;
    return {
      ...status,
      hoursSinceLastTrained: Math.max(
        0,
        Math.round(((nowMs - Date.parse(status.lastTrainedAt)) / (60 * 60 * 1000)) * 10) / 10
      ),
    };
  });
}
