import type { Experience } from "@/lib/exercises";

/** Centralized planning heuristics. These are product rules, not recovery claims. */
export const MUSCLE_PRIORITY_CONFIG = {
  baseScore: 20,
  targetSetsLast7Days: {
    beginner: 6,
    intermediate: 10,
    advanced: 14,
  } satisfies Record<Experience, number>,
  pointsPerMissingSet: 2,
  neverTrainedBonus: 15,
  hours96Bonus: 12,
  hours48Bonus: 6,
  trainedWithin24Penalty: 12,
  sorenessPenalty: 12,
  manualTargetBonus: 20,
  frequentWorkoutThreshold: 2,
  pointsPerExtraRecentWorkout: 6,
} as const;
