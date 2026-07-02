import type { SetUnit, Workout } from "./types";
import { v4 as uuidv4 } from "uuid";
import { estimateWorkoutSeconds } from "./workout";
import {
  type LibraryExercise,
  type MuscleGroup,
  type EquipmentAccess,
  type Experience,
  matchesEquipment,
  allowsLevel,
  groupsForExercise,
} from "./exercises";

export type GeneratorOptions = {
  muscleGroups: MuscleGroup[];
  secondaryGroups?: MuscleGroup[];
  equipment: EquipmentAccess;
  experience: Experience;
  minutes: number;
};

// Sets/reps/rest scheme per experience. Reps increase with level; a rough
// starting weight (kg) is scaled by experience and compound vs isolation.
const SCHEME: Record<
  Experience,
  { sets: number; reps: number; rest: string; compoundKg: number; isolationKg: number }
> = {
  beginner: { sets: 3, reps: 8, rest: "60", compoundKg: 20, isolationKg: 6 },
  intermediate: { sets: 3, reps: 10, rest: "75", compoundKg: 35, isolationKg: 10 },
  advanced: { sets: 4, reps: 12, rest: "90", compoundKg: 50, isolationKg: 12 },
};

/** Rough starting weight (kg) for a non-bodyweight exercise, as a string. */
function startingWeight(ex: LibraryExercise, experience: Experience): string {
  const scheme = SCHEME[experience];
  const kg = ex.mechanic === "compound" ? scheme.compoundKg : scheme.isolationKg;
  return String(kg);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function titleFor(groups: MuscleGroup[]): string {
  if (groups.length === 0) return "Custom Workout";
  if (groups.length >= 4) return "Full Body Workout";
  return `${groups.join(" & ")} Workout`;
}

/**
 * Builds a workout from the exercise library: filter by equipment + experience,
 * spread exercises across the chosen muscle groups (primary weighted heavier
 * than secondary), and size the routine so its estimated time (via the shared
 * `estimateWorkoutSeconds`) matches the chosen time budget. Fully editable after.
 */
export function generateWorkout(
  library: LibraryExercise[],
  opts: GeneratorOptions
): Workout {
  const scheme = SCHEME[opts.experience];
  const primary = opts.muscleGroups;
  const secondary = (opts.secondaryGroups ?? []).filter((g) => !primary.includes(g));
  const allGroups = [...primary, ...secondary];
  const groupSet = new Set(allGroups);

  const pool = library.filter(
    (ex) =>
      matchesEquipment(ex, opts.equipment) &&
      allowsLevel(ex.level, opts.experience) &&
      ["strength", "plyometrics", "cardio", "powerlifting", "olympic weightlifting"].includes(
        ex.category
      ) &&
      groupsForExercise(ex).some((g) => groupSet.has(g))
  );

  // Bucket candidates by muscle group and shuffle for variety.
  const byGroup = new Map<MuscleGroup, LibraryExercise[]>();
  for (const g of allGroups) byGroup.set(g, []);
  for (const ex of pool) {
    for (const g of groupsForExercise(ex)) {
      if (byGroup.has(g)) byGroup.get(g)!.push(ex);
    }
  }
  for (const list of byGroup.values()) shuffle(list);

  // Weighted round-robin order: each primary group appears twice per cycle,
  // each secondary group once, so primary muscles get more exercises.
  const order: MuscleGroup[] = [];
  for (const g of primary) order.push(g, g);
  for (const g of secondary) order.push(g);
  if (order.length === 0) order.push(...byGroup.keys());

  const buildExercise = (ex: LibraryExercise) => {
    const bodyweight = !ex.equipment || ex.equipment === "body only";
    const unit: SetUnit = bodyweight ? "bw" : "kg";
    return {
      id: uuidv4(),
      name: ex.name,
      sets: Array.from({ length: scheme.sets }, () => ({
        id: uuidv4(),
        reps: scheme.reps,
        value: bodyweight ? "BW" : startingWeight(ex, opts.experience),
        unit,
      })),
    };
  };

  // Greedily add exercises (round-robin, weighted) until the estimated time
  // reaches the budget, so a "30 min" pick estimates ~30 min. Cap at 10.
  const targetSec = opts.minutes * 60;
  const chosen: LibraryExercise[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (chosen.length < 10 && guard < order.length * 30) {
    const g = order[guard % order.length];
    guard++;
    const next = (byGroup.get(g) || []).find((ex) => !used.has(ex.name));
    if (!next) continue;
    chosen.push(next);
    used.add(next.name);
    if (chosen.length >= 3) {
      const est = estimateWorkoutSeconds(chosen.map(buildExercise), scheme.rest);
      if (est >= targetSec) break;
    }
  }
  // Fallback: ensure at least 3 exercises even if groups were sparse.
  if (chosen.length < 3) {
    for (const ex of shuffle([...pool])) {
      if (chosen.length >= 3) break;
      if (!used.has(ex.name)) {
        chosen.push(ex);
        used.add(ex.name);
      }
    }
  }

  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: titleFor(primary),
    rest: scheme.rest,
    createdAt: now,
    updatedAt: now,
    exercises: chosen.map(buildExercise),
  };
}
