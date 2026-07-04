// Shared access to the bundled exercise library (public/json/exercises.json):
// a cached loader, muscle-group taxonomy, equipment/experience mapping, and
// recommendation helpers. Used by the exercise combobox, the info dialog, and
// the workout generator. User-added ("custom") exercises are merged in.

import type { SetUnit } from "@/lib/types";
import { getCustomExercises } from "@/lib/storage/custom-exercises";

export type LibraryExercise = {
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  // Present only on user-added exercises.
  custom?: boolean;
  defaultUnit?: SetUnit;
  videoUrl?: string;
};

// ---- Cached loader -------------------------------------------------------

let cache: LibraryExercise[] | null = null;
let inflight: Promise<LibraryExercise[]> | null = null;

/** Bundled exercises + custom ones (custom wins on a name clash). */
function withCustom(bundled: LibraryExercise[]): LibraryExercise[] {
  const custom = getCustomExercises();
  if (custom.length === 0) return bundled;
  const customNames = new Set(custom.map((c) => c.name.toLowerCase()));
  const customAsLibrary: LibraryExercise[] = custom.map((c) => ({
    name: c.name,
    force: null,
    level: c.level,
    mechanic: c.mechanic,
    equipment: c.equipment,
    primaryMuscles: c.primaryMuscles,
    secondaryMuscles: c.secondaryMuscles,
    instructions: c.instructions,
    category: c.category,
    custom: true,
    defaultUnit: c.defaultUnit,
    videoUrl: c.videoUrl,
  }));
  return [...bundled.filter((e) => !customNames.has(e.name.toLowerCase())), ...customAsLibrary];
}

export function getCachedLibrary(): LibraryExercise[] {
  return withCustom(cache ?? []);
}

export function loadExerciseLibrary(): Promise<LibraryExercise[]> {
  if (cache) return Promise.resolve(withCustom(cache));
  if (!inflight) {
    inflight = fetch("/json/exercises.json")
      .then((r) => r.json())
      .then((d) => {
        cache = (d.exercises || []) as LibraryExercise[];
        return withCustom(cache);
      })
      .catch(() => {
        cache = [];
        return withCustom(cache);
      });
  }
  return inflight;
}

/** The default measurement unit for an exercise (custom only), or null. */
export function getExerciseDefaultUnit(name: string): SetUnit | null {
  const target = name.trim().toLowerCase();
  const hit = getCustomExercises().find((e) => e.name.toLowerCase() === target);
  return hit ? hit.defaultUnit : null;
}

// ---- Muscle groups -------------------------------------------------------

export const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

const MUSCLE_TO_GROUP: Record<string, MuscleGroup> = {
  chest: "Chest",
  lats: "Back",
  "middle back": "Back",
  "lower back": "Back",
  traps: "Back",
  quadriceps: "Legs",
  hamstrings: "Legs",
  glutes: "Legs",
  calves: "Legs",
  adductors: "Legs",
  abductors: "Legs",
  shoulders: "Shoulders",
  neck: "Shoulders",
  biceps: "Arms",
  triceps: "Arms",
  forearms: "Arms",
  abdominals: "Core",
  // Group labels themselves (custom exercises store their muscle groups here);
  // "chest" and "shoulders" already map above.
  back: "Back",
  legs: "Legs",
  arms: "Arms",
  core: "Core",
};

export function groupForMuscle(muscle: string): MuscleGroup | null {
  return MUSCLE_TO_GROUP[muscle.trim().toLowerCase()] ?? null;
}

export function groupsForExercise(ex: LibraryExercise): MuscleGroup[] {
  const set = new Set<MuscleGroup>();
  for (const m of ex.primaryMuscles) {
    const g = groupForMuscle(m);
    if (g) set.add(g);
  }
  return [...set];
}

/** Muscle groups for an exercise identified by name (case-insensitive). */
export function groupsForExerciseName(
  library: LibraryExercise[],
  name: string
): MuscleGroup[] {
  const ex = library.find((e) => e.name.toLowerCase() === name.trim().toLowerCase());
  return ex ? groupsForExercise(ex) : [];
}

// ---- Equipment & experience ---------------------------------------------

export type EquipmentAccess = "gym" | "home" | "none";

export const EQUIPMENT_OPTIONS: { value: EquipmentAccess; label: string }[] = [
  { value: "gym", label: "Full gym" },
  { value: "home", label: "Home equipment" },
  { value: "none", label: "No equipment" },
];

const HOME_EQUIPMENT = new Set([
  "dumbbell",
  "kettlebells",
  "bands",
  "exercise ball",
  "medicine ball",
  "foam roll",
  "e-z curl bar",
]);

export function matchesEquipment(ex: LibraryExercise, access: EquipmentAccess): boolean {
  const eq = (ex.equipment ?? "body only").toLowerCase();
  if (access === "gym") return true;
  if (access === "none") return eq === "body only";
  return eq === "body only" || HOME_EQUIPMENT.has(eq);
}

export type Experience = "beginner" | "intermediate" | "advanced";

export const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export function allowsLevel(exLevel: string, exp: Experience): boolean {
  if (exp === "beginner") return exLevel === "beginner";
  if (exp === "intermediate") return exLevel === "beginner" || exLevel === "intermediate";
  return true; // advanced: includes expert
}

// ---- Goal ----------------------------------------------------------------

export type Goal = "strength" | "muscle" | "fatloss" | "fitness";

export const GOAL_OPTIONS: { value: Goal; label: string; hint: string }[] = [
  { value: "muscle", label: "Build muscle", hint: "Moderate reps, hypertrophy" },
  { value: "strength", label: "Get stronger", hint: "Heavy, low reps, long rest" },
  { value: "fatloss", label: "Lose fat", hint: "Higher reps, short rest" },
  { value: "fitness", label: "General fitness", hint: "Balanced" },
];

// ---- Recommendation ------------------------------------------------------

/**
 * Splits the library into exercises that hit any of the target muscle groups
 * (recommended) and the rest, preserving each side's original order. Strength
 * exercises are lightly preferred within the recommended set.
 */
export function partitionByGroups(
  library: LibraryExercise[],
  targetGroups: MuscleGroup[]
): { recommended: LibraryExercise[]; rest: LibraryExercise[] } {
  if (targetGroups.length === 0) return { recommended: [], rest: library };
  const targets = new Set(targetGroups);
  const recommended: LibraryExercise[] = [];
  const rest: LibraryExercise[] = [];
  for (const ex of library) {
    const hit = groupsForExercise(ex).some((g) => targets.has(g));
    (hit ? recommended : rest).push(ex);
  }
  recommended.sort(
    (a, b) => (b.category === "strength" ? 1 : 0) - (a.category === "strength" ? 1 : 0)
  );
  return { recommended, rest };
}
