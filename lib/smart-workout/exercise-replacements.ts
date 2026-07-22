import {
  getExerciseStableId,
  type LibraryExercise,
} from "@/lib/exercises";
import type { ExercisePreference } from "@/lib/storage/exercise-preferences";
import { scoreExercise } from "./exercise-scoring";

export type ExerciseReplacementSuggestion = {
  exercise: LibraryExercise;
  score: number;
  reasons: string[];
};

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/** Custom exercises remain selectable even when old entries lack enough muscle
 * metadata for Smart Wizard scoring. Avoided and already-used entries stay out. */
export function availableCustomReplacements({
  library,
  currentName,
  preferences = [],
  excludedNames = [],
}: {
  library: LibraryExercise[];
  currentName: string;
  preferences?: ExercisePreference[];
  excludedNames?: string[];
}): LibraryExercise[] {
  const excluded = new Set([
    normalizeName(currentName),
    ...excludedNames.map(normalizeName),
  ]);
  const preferencesById = new Map(
    preferences.map((preference) => [preference.exerciseId, preference])
  );

  return library
    .filter((exercise) => {
      if (!exercise.custom || excluded.has(normalizeName(exercise.name))) return false;
      return preferencesById.get(getExerciseStableId(exercise))?.level !== "avoid";
    })
    .sort((a, b) => {
      const aPreferred = preferencesById.get(getExerciseStableId(a))?.level === "prefer";
      const bPreferred = preferencesById.get(getExerciseStableId(b))?.level === "prefer";
      return Number(bPreferred) - Number(aPreferred) || a.name.localeCompare(b.name);
    });
}

/**
 * Ranks alternatives that train the current exercise's muscles. This uses the
 * same eligibility and preference weighting as Smart Wizard, while remaining
 * deliberately permissive about equipment/experience because those choices
 * are not stored on ordinary manually-created workouts.
 */
export function recommendExerciseReplacements({
  library,
  currentName,
  preferences = [],
  excludedNames = [],
  limit = 8,
}: {
  library: LibraryExercise[];
  currentName: string;
  preferences?: ExercisePreference[];
  excludedNames?: string[];
  limit?: number;
}): ExerciseReplacementSuggestion[] {
  const currentKey = normalizeName(currentName);
  const current = library.find((exercise) => normalizeName(exercise.name) === currentKey);
  if (!current) return [];

  const targetMuscles = new Set(
    (current.primaryMuscles.length > 0
      ? current.primaryMuscles
      : current.secondaryMuscles ?? []
    ).map((muscle) => muscle.toLowerCase())
  );
  if (targetMuscles.size === 0) return [];

  const excluded = new Set([currentKey, ...excludedNames.map(normalizeName)]);
  const preferencesById = new Map(
    preferences.map((preference) => [preference.exerciseId, preference])
  );

  return library
    .filter((exercise) => !excluded.has(normalizeName(exercise.name)))
    .map((exercise) => {
      const result = scoreExercise(exercise, {
        equipment: "gym",
        experience: "advanced",
        targetLibraryMuscles: targetMuscles,
        avoidLibraryMuscles: new Set<string>(),
        soreLibraryMuscles: new Set<string>(),
        preference: preferencesById.get(getExerciseStableId(exercise)),
        strategy: "balanced",
        hasProgression: false,
      });
      const sameEquipment =
        (exercise.equipment ?? "body only").toLowerCase() ===
        (current.equipment ?? "body only").toLowerCase();
      return {
        exercise,
        score: result.score + (sameEquipment ? 1 : 0),
        reasons: [
          ...result.reasons,
          ...(sameEquipment ? ["Uses the same equipment."] : []),
        ],
        excluded: result.excluded,
      };
    })
    .filter((suggestion) => !suggestion.excluded)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.exercise.name.localeCompare(b.exercise.name)
    )
    .slice(0, Math.max(0, limit))
    .map(({ exercise, score, reasons }) => ({ exercise, score, reasons }));
}
