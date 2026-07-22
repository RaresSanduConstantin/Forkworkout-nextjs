import type { LibraryExercise } from "@/lib/exercises";

export type MovementPattern =
  | "horizontal-push"
  | "vertical-push"
  | "horizontal-pull"
  | "vertical-pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "carry"
  | "calf"
  | "elbow-flexion"
  | "elbow-extension"
  | "shoulder-isolation"
  | "core-flexion"
  | "core-extension"
  | "core-stability"
  | "rotation"
  | "cardio";

// Reviewed exact-name compatibility metadata for common bundled exercises.
// This is deliberately not a runtime name-classification heuristic.
const REVIEWED_PATTERNS: Record<string, MovementPattern> = {
  "barbell bench press - medium grip": "horizontal-push",
  "bench press - powerlifting": "horizontal-push",
  "dumbbell bench press": "horizontal-push",
  "machine bench press": "horizontal-push",
  "push-up wide": "horizontal-push",
  "barbell shoulder press": "vertical-push",
  "dumbbell shoulder press": "vertical-push",
  "chin-up": "vertical-pull",
  "band assisted pull-up": "vertical-pull",
  "bent over barbell row": "horizontal-pull",
  "one-arm dumbbell row": "horizontal-pull",
  "inverted row": "horizontal-pull",
  "barbell squat": "squat",
  "barbell deadlift": "hinge",
  "barbell lunge": "lunge",
  "dumbbell lunges": "lunge",
  "dumbbell bicep curl": "elbow-flexion",
  "triceps pushdown": "elbow-extension",
  crunches: "core-flexion",
  "russian twist": "rotation",
};

export const MOVEMENT_PATTERN_LIMITS = {
  balanced: 2,
  progressive: 2,
  "low-fatigue": 1,
} as const;

export function getMovementPattern(
  exercise: Pick<LibraryExercise, "name" | "movementPattern">
): MovementPattern | undefined {
  return exercise.movementPattern ?? REVIEWED_PATTERNS[exercise.name.trim().toLowerCase()];
}
