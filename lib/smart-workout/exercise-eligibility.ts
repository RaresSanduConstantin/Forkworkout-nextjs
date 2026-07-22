import {
  allowsLevel,
  matchesEquipment,
  type EquipmentAccess,
  type Experience,
  type LibraryExercise,
} from "@/lib/exercises";
import type { ExercisePreference } from "@/lib/storage/exercise-preferences";

export type ExerciseEligibilityContext = {
  equipment: EquipmentAccess;
  experience: Experience;
  useWeights?: boolean;
  targetLibraryMuscles: Set<string>;
  avoidLibraryMuscles: Set<string>;
  preference?: ExercisePreference;
  homeEquipment?: {
    allowed: string[];
    maxKg?: Record<string, number>;
    pullupBar?: boolean;
  };
};

export type ExerciseEligibility = {
  allowed: boolean;
  reason?: string;
};

const SUPPORTED_CATEGORIES = new Set([
  "strength",
  "plyometrics",
  "cardio",
  "powerlifting",
  "olympic weightlifting",
]);
const PULLUP_BAR_RE = /pull-?up|chin-?up|muscle-?up|hanging|toes to bar|front lever/i;

export function isBodyweightExercise(exercise: LibraryExercise): boolean {
  const equipment = (exercise.equipment ?? "body only").toLowerCase();
  return equipment === "body only" || equipment === "none";
}

function equipmentAllowed(
  exercise: LibraryExercise,
  context: ExerciseEligibilityContext
): boolean {
  if (context.equipment !== "home" || !context.homeEquipment) {
    return matchesEquipment(exercise, context.equipment);
  }
  const allowed = new Set(context.homeEquipment.allowed.map((item) => item.toLowerCase()));
  const equipment = (exercise.equipment ?? "body only").toLowerCase();
  if (!isBodyweightExercise(exercise) && !allowed.has(equipment)) return false;
  if (!context.homeEquipment.pullupBar && PULLUP_BAR_RE.test(exercise.name)) return false;
  return true;
}

/** Eligibility always runs before scoring and returns one factual exclusion reason. */
export function checkExerciseEligibility(
  exercise: LibraryExercise,
  context: ExerciseEligibilityContext
): ExerciseEligibility {
  if (!exercise.name?.trim() || !Array.isArray(exercise.primaryMuscles)) {
    return { allowed: false, reason: "Exercise metadata is incomplete." };
  }
  if (!equipmentAllowed(exercise, context)) {
    return { allowed: false, reason: "Required equipment is unavailable." };
  }
  if (!allowsLevel(exercise.level, context.experience)) {
    return { allowed: false, reason: "Not suitable for the selected experience level." };
  }
  if (context.useWeights === false && !isBodyweightExercise(exercise)) {
    return { allowed: false, reason: "Weighted exercises are disabled." };
  }
  if (!SUPPORTED_CATEGORIES.has(exercise.category)) {
    return { allowed: false, reason: "Exercise category is not supported by the generator." };
  }
  if (context.preference?.level === "avoid") {
    return { allowed: false, reason: "Avoided in exercise preferences." };
  }
  if (
    exercise.primaryMuscles.some((muscle) =>
      context.avoidLibraryMuscles.has(muscle.toLowerCase())
    )
  ) {
    return { allowed: false, reason: "Directly trains a muscle marked Avoid today." };
  }
  const targetMatch = [...exercise.primaryMuscles, ...(exercise.secondaryMuscles ?? [])].some(
    (muscle) => context.targetLibraryMuscles.has(muscle.toLowerCase())
  );
  if (!targetMatch) return { allowed: false, reason: "Does not train a requested muscle." };
  return { allowed: true };
}
