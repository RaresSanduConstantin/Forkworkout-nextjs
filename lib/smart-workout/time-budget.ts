import type { SetUnit } from "@/lib/types";
import { estimateExerciseSeconds } from "@/lib/workout";

export const TIME_BUDGET_TOLERANCE = 0.1;

export type WorkoutTimeBudget = {
  totalSeconds: number;
  warmupSeconds: number;
  workingSeconds: number;
  restSeconds: number;
  transitionSeconds: number;
};

type TimedExercise = {
  sets: { unit?: SetUnit; value: string; type?: string }[];
  rest?: string;
  unilateral?: boolean;
};

/** Breakdown uses the same per-exercise estimator as previews and generation. */
export function calculateWorkoutTimeBudget(
  exercises: TimedExercise[],
  workoutRest?: string
): WorkoutTimeBudget {
  let totalSeconds = 0;
  let warmupSeconds = 0;
  let workingSeconds = 0;
  let restSeconds = 0;
  const transitionSeconds = exercises.length * 20;

  for (const exercise of exercises) {
    const estimate = estimateExerciseSeconds(exercise, workoutRest);
    totalSeconds += estimate.totalSeconds;
    restSeconds += estimate.restSeconds;
    warmupSeconds += estimate.warmupSeconds;
    workingSeconds += estimate.workingSeconds;
  }
  return { totalSeconds, warmupSeconds, workingSeconds, restSeconds, transitionSeconds };
}

export function isWithinTimeBudget(
  estimatedSeconds: number,
  requestedMinutes: number,
  tolerance = TIME_BUDGET_TOLERANCE
): boolean {
  if (!Number.isFinite(estimatedSeconds) || !Number.isFinite(requestedMinutes) || requestedMinutes <= 0) {
    return false;
  }
  return estimatedSeconds <= requestedMinutes * 60 * (1 + tolerance);
}
