import type { SetType, SetUnit, Workout } from "./types";
import { v4 as uuidv4 } from "uuid";
import { estimateWorkoutSeconds } from "./workout";
import {
  type LibraryExercise,
  type MuscleGroup,
  type MuscleTargetKey,
  type EquipmentAccess,
  type Experience,
  type Goal,
  TARGET_BY_KEY,
  targetsForGroup,
  libMusclesForTargets,
  matchesEquipment,
  allowsLevel,
  groupsForExercise,
} from "./exercises";

export type Sex = "male" | "female" | "unspecified";

export type GeneratorOptions = {
  /** Fine-grained muscle targets (preferred). */
  targetMuscles?: MuscleTargetKey[];
  /** Coarse groups — expanded to their muscles when targetMuscles is absent. */
  muscleGroups?: MuscleGroup[];
  secondaryGroups?: MuscleGroup[];
  equipment: EquipmentAccess;
  experience: Experience;
  minutes: number;
  goal?: Goal;
  /** Only bodyweight exercises when false. */
  useWeights?: boolean;
  /** For calibrating suggested starting weights. */
  sex?: Sex;
  bodyweightKg?: number;
  /** Real weight (kg) from history for an exercise, if known — preferred over the heuristic. */
  historyWeightKg?: (name: string) => number | null;
};

// Sets / reps / rest per goal. Volume is later modulated by experience & time.
const GOAL_SCHEME: Record<Goal, { sets: number; reps: number; rest: string }> = {
  strength: { sets: 4, reps: 5, rest: "150" },
  muscle: { sets: 3, reps: 10, rest: "75" },
  fatloss: { sets: 3, reps: 15, rest: "40" },
  fitness: { sets: 3, reps: 12, rest: "60" },
};

// --- Starting-weight calibration -----------------------------------------

/** Rough load as a fraction of bodyweight, by dominant muscle group + mechanic. */
function bodyweightFraction(ex: LibraryExercise): number {
  const g = groupsForExercise(ex);
  const compound = ex.mechanic === "compound";
  const has = (m: MuscleGroup) => g.includes(m);
  if (has("Legs")) return compound ? 0.6 : 0.15;
  if (has("Back")) return compound ? 0.45 : 0.12;
  if (has("Chest")) return compound ? 0.45 : 0.12;
  if (has("Shoulders")) return compound ? 0.25 : 0.08;
  if (has("Arms")) return 0.1;
  if (has("Core")) return 0.05;
  return compound ? 0.35 : 0.1;
}

/**
 * A conservative, editable starting weight (kg). Scales a bodyweight-relative
 * base by experience and sex. Prefer real history over this when available.
 */
export function suggestStartingWeightKg(
  ex: LibraryExercise,
  opts: { experience: Experience; sex?: Sex; bodyweightKg?: number }
): number {
  const bw =
    opts.bodyweightKg && opts.bodyweightKg > 0
      ? opts.bodyweightKg
      : opts.sex === "female"
      ? 65
      : 78;
  const expF =
    opts.experience === "beginner" ? 0.7 : opts.experience === "advanced" ? 1.3 : 1.0;
  const sexF = opts.sex === "female" ? 0.65 : opts.sex === "male" ? 1.0 : 0.8;
  const raw = bw * bodyweightFraction(ex) * expF * sexF;
  return Math.max(2.5, Math.round(raw / 2.5) * 2.5);
}

// --- Selection scoring -----------------------------------------------------

function isBodyweight(ex: LibraryExercise): boolean {
  return !ex.equipment || ex.equipment.toLowerCase() === "body only";
}

function scoreExercise(
  ex: LibraryExercise,
  targetLib: Set<string>,
  experience: Experience
): number {
  let s = 0;
  if (ex.mechanic === "compound") s += 3;
  if (ex.category === "strength") s += 1;
  // Reward exercises whose PRIMARY work is the target muscle (precision).
  const primHits = (ex.primaryMuscles ?? []).filter((m) => targetLib.has(m.toLowerCase())).length;
  s += Math.min(primHits, 2) * 2;
  if (experience === "beginner") {
    const eq = (ex.equipment ?? "body only").toLowerCase();
    if (["body only", "dumbbell", "machine", "cable", "kettlebells"].includes(eq)) s += 1;
    if (ex.level === "beginner") s += 1;
  }
  return s;
}

function titleFor(groups: MuscleGroup[], goal?: Goal): string {
  const g =
    groups.length === 0
      ? "Custom"
      : groups.length >= 4
      ? "Full Body"
      : groups.join(" & ");
  const suffix =
    goal === "strength"
      ? "Strength"
      : goal === "fatloss"
      ? "Burn"
      : goal === "muscle"
      ? "Workout"
      : "Workout";
  return `${g} ${suffix}`;
}

/**
 * Builds a workout from the library with a deterministic, quality-ordered
 * selection (compound-first, primary muscles favoured, balanced across groups),
 * goal-based set/rep/rest, and calibrated starting weights (history preferred).
 * Fully editable after. An optional `seed` shifts choices to create variants.
 */
export function generateWorkout(
  library: LibraryExercise[],
  opts: GeneratorOptions,
  seed = 0
): Workout {
  const goal: Goal = opts.goal ?? "fitness";
  const base = GOAL_SCHEME[goal];
  // Modulate volume by experience.
  const sets = Math.max(
    2,
    base.sets + (opts.experience === "beginner" ? -1 : opts.experience === "advanced" ? 1 : 0)
  );
  const scheme = { ...base, sets };

  const primary = opts.muscleGroups ?? [];

  // Resolve fine-grained muscle targets: use explicit targets, else expand the
  // coarse groups into their constituent muscles.
  const targets: MuscleTargetKey[] =
    opts.targetMuscles && opts.targetMuscles.length > 0
      ? opts.targetMuscles
      : primary.flatMap((g) => targetsForGroup(g));
  const groups = [
    ...new Set(
      targets
        .map((k) => TARGET_BY_KEY.get(k)?.group)
        .filter((g): g is MuscleGroup => Boolean(g))
    ),
  ];

  // Per-target library-muscle sets + the union for pool filtering.
  const targetLib = new Map<MuscleTargetKey, Set<string>>();
  for (const k of targets) targetLib.set(k, libMusclesForTargets([k]));
  const unionLib = libMusclesForTargets(targets);
  const primaryHit = (ex: LibraryExercise) =>
    (ex.primaryMuscles ?? []).some((m) => unionLib.has(m.toLowerCase()));
  const secondaryHit = (ex: LibraryExercise) =>
    (ex.secondaryMuscles ?? []).some((m) => unionLib.has(m.toLowerCase()));

  const pool = library.filter(
    (ex) =>
      matchesEquipment(ex, opts.equipment) &&
      allowsLevel(ex.level, opts.experience) &&
      (opts.useWeights === false ? isBodyweight(ex) : true) &&
      ["strength", "plyometrics", "cardio", "powerlifting", "olympic weightlifting"].includes(
        ex.category
      ) &&
      (primaryHit(ex) || secondaryHit(ex))
  );

  // Bucket by target, ordered best-first (score desc). Prefer exercises that hit
  // the target as a PRIMARY muscle; fall back to secondary only if none exist.
  // `seed` rotates each list so variants pick different-but-still-good choices.
  const byTarget = new Map<MuscleTargetKey, LibraryExercise[]>();
  for (const k of targets) {
    const lib = targetLib.get(k)!;
    const prim = pool.filter((ex) =>
      (ex.primaryMuscles ?? []).some((m) => lib.has(m.toLowerCase()))
    );
    const list =
      prim.length > 0
        ? prim
        : pool.filter((ex) => (ex.secondaryMuscles ?? []).some((m) => lib.has(m.toLowerCase())));
    list.sort(
      (a, b) =>
        scoreExercise(b, lib, opts.experience) - scoreExercise(a, lib, opts.experience) ||
        a.name.localeCompare(b.name)
    );
    if (seed > 0 && list.length > 1) {
      const shift = seed % list.length;
      byTarget.set(k, [...list.slice(shift), ...list.slice(0, shift)]);
    } else {
      byTarget.set(k, list);
    }
  }

  // Round-robin over the selected muscles (each once per cycle).
  const order: MuscleTargetKey[] = [...targets];

  const buildExercise = (ex: LibraryExercise, withWarmup = false) => {
    const bodyweight = isBodyweight(ex);
    const unit: SetUnit = bodyweight ? "bw" : "kg";
    const weight = bodyweight
      ? "BW"
      : String(
          opts.historyWeightKg?.(ex.name) ??
            suggestStartingWeightKg(ex, {
              experience: opts.experience,
              sex: opts.sex,
              bodyweightKg: opts.bodyweightKg,
            })
        );
    const working = Array.from({ length: scheme.sets }, () => ({
      id: uuidv4(),
      reps: scheme.reps,
      value: weight,
      unit,
    }));
    const sets =
      withWarmup && !bodyweight
        ? [
            {
              id: uuidv4(),
              reps: Math.min(12, scheme.reps + 4),
              value: String(Math.max(2.5, Math.round((Number(weight) * 0.5) / 2.5) * 2.5)),
              unit,
              type: "warmup" as SetType,
            },
            ...working,
          ]
        : working;
    return { id: uuidv4(), name: ex.name, sets };
  };

  // Greedily add best-first per target until the estimated time meets the budget.
  const targetSec = opts.minutes * 60;
  const chosen: LibraryExercise[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (chosen.length < 10 && order.length > 0 && guard < order.length * 30) {
    const k = order[guard % order.length];
    guard++;
    const next = (byTarget.get(k) || []).find((ex) => !used.has(ex.name));
    if (!next) continue;
    chosen.push(next);
    used.add(next.name);
    if (chosen.length >= 3) {
      const est = estimateWorkoutSeconds(chosen.map((e) => buildExercise(e)), scheme.rest);
      if (est >= targetSec) break;
    }
  }
  if (chosen.length < 3) {
    for (const ex of pool) {
      if (chosen.length >= 3) break;
      if (!used.has(ex.name)) {
        chosen.push(ex);
        used.add(ex.name);
      }
    }
  }

  // Final order: compounds before isolations (a natural session flow).
  chosen.sort(
    (a, b) => (b.mechanic === "compound" ? 1 : 0) - (a.mechanic === "compound" ? 1 : 0)
  );

  const warmupGoal = goal === "strength" || goal === "muscle";
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: titleFor(groups, goal),
    rest: scheme.rest,
    createdAt: now,
    updatedAt: now,
    exercises: chosen.map((ex, i) => buildExercise(ex, warmupGoal && i === 0)),
  };
}
