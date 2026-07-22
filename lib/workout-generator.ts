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
  groupsForExercise,
  getExerciseStableId,
} from "./exercises";
import type { ExercisePreference } from "./storage/exercise-preferences";
import type { ReadinessLevel } from "./storage/daily-training-state";
import {
  checkExerciseEligibility,
  isBodyweightExercise,
} from "./smart-workout/exercise-eligibility";
import { scoreExercise } from "./smart-workout/exercise-scoring";
import {
  getStrategyDefinition,
  type WorkoutStrategy,
} from "./smart-workout/types";
import {
  getMovementPattern,
  MOVEMENT_PATTERN_LIMITS,
} from "./smart-workout/movement-patterns";
import { isWithinTimeBudget } from "./smart-workout/time-budget";

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
  /** When equipment is "home": the specific gear the user owns. Limits the pool
   * to body-only + allowed equipment, and caps suggested loads per equipment. */
  homeEquipment?: {
    /** Library `equipment` values allowed (besides body-only). */
    allowed: string[];
    /** Max kg per library `equipment` value (weighted gear only). */
    maxKg?: Record<string, number>;
    /** Whether a pull-up bar is available (gates bar-requiring bodyweight moves). */
    pullupBar?: boolean;
  };
  /** Local feedback keyed by stable library exercise id. */
  preferences?: ExercisePreference[];
  readiness?: ReadinessLevel;
  soreMuscles?: MuscleTargetKey[];
  avoidMuscles?: MuscleTargetKey[];
  strategy?: WorkoutStrategy;
  /** Normalized names from recent sessions, used as a small variety penalty. */
  recentExerciseNames?: string[];
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
  const strategy = opts.strategy ?? "balanced";
  const base = GOAL_SCHEME[goal];
  // Modulate volume by experience.
  const readinessModifier =
    opts.readiness === "great"
      ? 1
      : opts.readiness === "tired"
        ? -1
        : opts.readiness === "very-tired"
          ? -2
          : 0;
  const strategyModifier = strategy === "low-fatigue" ? -1 : 0;
  const sets = Math.max(
    1,
    base.sets +
      (opts.experience === "beginner" ? -1 : opts.experience === "advanced" ? 1 : 0) +
      readinessModifier +
      strategyModifier
  );
  const scheme = { ...base, sets };

  const primary = opts.muscleGroups ?? [];

  // Resolve fine-grained muscle targets: use explicit targets, else expand the
  // coarse groups into their constituent muscles.
  const requestedTargets: MuscleTargetKey[] =
    opts.targetMuscles && opts.targetMuscles.length > 0
      ? opts.targetMuscles
      : primary.flatMap((g) => targetsForGroup(g));
  const avoidTargets = new Set(opts.avoidMuscles ?? []);
  const targets = requestedTargets.filter((target) => !avoidTargets.has(target));
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
  const soreLib = libMusclesForTargets(opts.soreMuscles ?? []);
  const avoidLib = libMusclesForTargets(opts.avoidMuscles ?? []);
  const preferences = new Map(
    (opts.preferences ?? []).map((preference) => [preference.exerciseId, preference])
  );
  const preferenceFor = (ex: LibraryExercise) => preferences.get(getExerciseStableId(ex));
  const recentExerciseNames = new Set(
    (opts.recentExerciseNames ?? []).map((name) => name.toLowerCase().replace(/\s+/g, " ").trim())
  );
  const historyWeights = new Map<string, number | null>();
  const historyWeightFor = (exercise: LibraryExercise) => {
    if (!historyWeights.has(exercise.name)) {
      const value = opts.historyWeightKg?.(exercise.name) ?? null;
      historyWeights.set(
        exercise.name,
        typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null
      );
    }
    return historyWeights.get(exercise.name) ?? null;
  };
  const eligiblePool = library.filter((exercise) =>
    checkExerciseEligibility(exercise, {
      equipment: opts.equipment,
      experience: opts.experience,
      useWeights: opts.useWeights,
      targetLibraryMuscles: unionLib,
      avoidLibraryMuscles: avoidLib,
      preference: preferenceFor(exercise),
      homeEquipment: opts.homeEquipment,
    }).allowed
  );
  // Avoid major secondary contribution too when the remaining library still
  // has enough choices to compose a useful session.
  const withoutAvoidedSecondary = eligiblePool.filter(
    (exercise) =>
      !(exercise.secondaryMuscles ?? []).some((muscle) => avoidLib.has(muscle.toLowerCase()))
  );
  const pool = withoutAvoidedSecondary.length >= Math.min(3, eligiblePool.length)
    ? withoutAvoidedSecondary
    : eligiblePool;

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
      (a, b) => {
        const score = (exercise: LibraryExercise) =>
          scoreExercise(exercise, {
            equipment: opts.equipment,
            experience: opts.experience,
            useWeights: opts.useWeights,
            targetLibraryMuscles: lib,
            avoidLibraryMuscles: avoidLib,
            soreLibraryMuscles: soreLib,
            preference: preferenceFor(exercise),
            homeEquipment: opts.homeEquipment,
            strategy,
            hasProgression: historyWeightFor(exercise) !== null,
            recentlyPerformed: recentExerciseNames.has(
              exercise.name.toLowerCase().replace(/\s+/g, " ").trim()
            ),
          }).score;
        return score(b) - score(a) || a.name.localeCompare(b.name);
      }
    );
    if (strategy === "balanced" && seed > 0 && list.length > 1) {
      const preferred = list.filter((exercise) => preferenceFor(exercise)?.level === "prefer");
      const neutral = list.filter((exercise) => preferenceFor(exercise)?.level !== "prefer");
      const rotate = (items: LibraryExercise[], offset: number) => {
        if (items.length < 2) return items;
        const shift = offset % items.length;
        return [...items.slice(shift), ...items.slice(0, shift)];
      };
      // A preferred move leads two out of every three variants. The third lets
      // the wizard stay varied instead of repeating the same routine forever.
      if (preferred.length > 0 && seed % 3 !== 2) {
        byTarget.set(k, [...rotate(preferred, seed), ...rotate(neutral, seed)]);
      } else {
        byTarget.set(k, [...rotate(neutral, seed), ...rotate(preferred, seed)]);
      }
    } else {
      byTarget.set(k, list);
    }
  }

  // Round-robin over the selected muscles (each once per cycle).
  const order: MuscleTargetKey[] = [...targets];

  const weightCap = opts.homeEquipment?.maxKg;
  const buildExercise = (ex: LibraryExercise, withWarmup = false) => {
    const bodyweight = isBodyweightExercise(ex);
    const movementPattern = getMovementPattern(ex);
    const unit: SetUnit = bodyweight ? "bw" : "kg";
    let kg = bodyweight
      ? 0
      : (historyWeightFor(ex) ??
        suggestStartingWeightKg(ex, {
          experience: opts.experience,
          sex: opts.sex,
          bodyweightKg: opts.bodyweightKg,
        }));
    // Cap to the user's available load for this equipment (e.g. 8kg dumbbells).
    const cap = weightCap?.[(ex.equipment ?? "").toLowerCase()];
    if (!bodyweight && cap != null) kg = Math.max(2.5, Math.min(kg, cap));
    const weight = bodyweight ? "BW" : String(kg);
    const hitsSoreMuscle = [...(ex.primaryMuscles ?? []), ...(ex.secondaryMuscles ?? [])].some(
      (muscle) => soreLib.has(muscle.toLowerCase())
    );
    const workingSetCount = Math.max(1, scheme.sets - (hitsSoreMuscle ? 1 : 0));
    const working = Array.from({ length: workingSetCount }, () => ({
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
    return {
      id: uuidv4(),
      name: ex.name,
      sets,
      movementPattern,
      unilateral: ex.unilateral ?? movementPattern === "lunge",
    };
  };

  // Greedily add best-first per target while enforcing the documented 10%
  // upper time tolerance and movement-pattern limits.
  const targetSec = opts.minutes * 60;
  const chosen: LibraryExercise[] = [];
  const used = new Set<string>();
  const patternCounts = new Map<string, number>();
  const patternLimit = MOVEMENT_PATTERN_LIMITS[strategy];
  const minimumExercises = opts.minutes <= 15 ? 2 : 3;
  const canUsePattern = (exercise: LibraryExercise) => {
    const pattern = getMovementPattern(exercise);
    return !pattern || (patternCounts.get(pattern) ?? 0) < patternLimit;
  };
  const addPattern = (exercise: LibraryExercise) => {
    const pattern = getMovementPattern(exercise);
    if (pattern) patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
  };
  let guard = 0;
  while (chosen.length < 12 && order.length > 0 && guard < order.length * 40) {
    const k = order[guard % order.length];
    guard++;
    const next = (byTarget.get(k) || []).find(
      (exercise) => !used.has(exercise.name) && canUsePattern(exercise)
    );
    if (!next) continue;
    used.add(next.name);
    const candidate = [...chosen, next];
    const estimate = estimateWorkoutSeconds(candidate.map((exercise) => buildExercise(exercise)), scheme.rest);
    if (!isWithinTimeBudget(estimate, opts.minutes) && chosen.length >= minimumExercises) {
      continue;
    }
    chosen.push(next);
    addPattern(next);
    if (chosen.length >= minimumExercises && estimate >= targetSec * 0.9) {
      break;
    }
  }
  if (chosen.length < minimumExercises) {
    for (const ex of pool) {
      if (chosen.length >= minimumExercises) break;
      if (used.has(ex.name) || !canUsePattern(ex)) continue;
      const candidate = [...chosen, ex];
      const estimate = estimateWorkoutSeconds(candidate.map((exercise) => buildExercise(exercise)), scheme.rest);
      if (!isWithinTimeBudget(estimate, opts.minutes) && chosen.length > 0) continue;
      chosen.push(ex);
      used.add(ex.name);
      addPattern(ex);
    }
  }

  // Final order: compounds before isolations (a natural session flow).
  chosen.sort(
    (a, b) => (b.mechanic === "compound" ? 1 : 0) - (a.mechanic === "compound" ? 1 : 0)
  );

  const warmupGoal = (goal === "strength" || goal === "muscle") && strategy !== "low-fatigue";
  const strategyDefinition = getStrategyDefinition(strategy);
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: titleFor(groups, goal),
    rest: scheme.rest,
    createdAt: now,
    updatedAt: now,
    strategy,
    recommendationSummary: strategyDefinition.description,
    exercises: chosen.map((ex, i) => buildExercise(ex, warmupGoal && i === 0)),
  };
}
