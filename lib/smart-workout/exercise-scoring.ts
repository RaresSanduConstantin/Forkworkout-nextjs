import { getExerciseStableId, type Experience, type LibraryExercise } from "@/lib/exercises";
import type { ExercisePreference } from "@/lib/storage/exercise-preferences";
import type { WorkoutStrategy } from "./types";
import {
  checkExerciseEligibility,
  type ExerciseEligibilityContext,
} from "./exercise-eligibility";

export type ExerciseScore = {
  exerciseId: string;
  score: number;
  reasons: string[];
  excluded: boolean;
  exclusionReason?: string;
};

export type ExerciseScoringContext = ExerciseEligibilityContext & {
  targetLibraryMuscles: Set<string>;
  soreLibraryMuscles: Set<string>;
  preference?: ExercisePreference;
  strategy: WorkoutStrategy;
  experience: Experience;
  hasProgression: boolean;
  recentlyPerformed?: boolean;
};

/** Pure, explainable exercise scoring used by every generated strategy. */
export function scoreExercise(
  exercise: LibraryExercise,
  context: ExerciseScoringContext
): ExerciseScore {
  const exerciseId = getExerciseStableId(exercise);
  const eligibility = checkExerciseEligibility(exercise, context);
  if (!eligibility.allowed) {
    return {
      exerciseId,
      score: Number.NEGATIVE_INFINITY,
      reasons: [],
      excluded: true,
      exclusionReason: eligibility.reason,
    };
  }

  let score = 0;
  const reasons: string[] = [];
  const primaryHits = exercise.primaryMuscles.filter((muscle) =>
    context.targetLibraryMuscles.has(muscle.toLowerCase())
  ).length;
  if (primaryHits > 0) {
    score += Math.min(primaryHits, 2) * 4;
    reasons.push("Direct target-muscle match.");
  } else {
    score += 1;
    reasons.push("Secondary target-muscle match.");
  }

  if (exercise.category === "strength") score += 1;
  if (exercise.mechanic === "compound") {
    score += context.strategy === "low-fatigue" ? -5 : 3;
    reasons.push(
      context.strategy === "low-fatigue"
        ? "Compound movement carries a low-fatigue penalty."
        : "Useful compound movement."
    );
  }

  if (context.preference?.level === "prefer") {
    score += 8;
    reasons.push("Marked as preferred.");
  }
  if (context.hasProgression) {
    score += context.strategy === "progressive" ? 7 : 2;
    reasons.push("Has a local load suggestion.");
  }
  if (context.recentlyPerformed) {
    score -= context.strategy === "progressive" ? 1 : 3;
    reasons.push("Performed recently.");
  }

  const sorePrimary = exercise.primaryMuscles.some((muscle) =>
    context.soreLibraryMuscles.has(muscle.toLowerCase())
  );
  const soreSecondary = (exercise.secondaryMuscles ?? []).some((muscle) =>
    context.soreLibraryMuscles.has(muscle.toLowerCase())
  );
  if (sorePrimary || soreSecondary) {
    score -= sorePrimary ? 4 : 2;
    reasons.push("Works an area marked sore today.");
  }

  if (context.experience === "beginner" && exercise.level === "beginner") score += 2;
  if (context.strategy === "low-fatigue") {
    const equipment = (exercise.equipment ?? "body only").toLowerCase();
    if (["machine", "cable", "dumbbell", "body only", "none"].includes(equipment)) {
      score += 4;
      reasons.push("Stable setup fits a low-fatigue session.");
    }
  }

  return { exerciseId, score, reasons, excluded: false };
}
