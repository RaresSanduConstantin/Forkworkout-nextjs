import type { NutritionEntry, NutritionNutrients } from "./types";
import type { CompletedWorkout } from "@/lib/types";
import { toDayKey } from "@/lib/date/day-key";

export const EMPTY_NUTRIENTS: NutritionNutrients = {
  caloriesKcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
};

const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function sumNutrients(
  values: Array<Pick<NutritionEntry, "nutrients"> | NutritionNutrients>
): NutritionNutrients {
  const total = values.reduce<NutritionNutrients>(
    (sum, value) => {
      const nutrients: NutritionNutrients = Object.prototype.hasOwnProperty.call(
        value,
        "nutrients"
      )
        ? (value as Pick<NutritionEntry, "nutrients">).nutrients
        : (value as NutritionNutrients);
      sum.caloriesKcal += nutrients.caloriesKcal;
      sum.proteinG += nutrients.proteinG;
      sum.carbsG += nutrients.carbsG;
      sum.fatG += nutrients.fatG;
      if (nutrients.fibreG !== undefined) {
        sum.fibreG = (sum.fibreG ?? 0) + nutrients.fibreG;
      }
      if (nutrients.sugarG !== undefined) {
        sum.sugarG = (sum.sugarG ?? 0) + nutrients.sugarG;
      }
      if (nutrients.sodiumMg !== undefined) {
        sum.sodiumMg = (sum.sodiumMg ?? 0) + nutrients.sodiumMg;
      }
      return sum;
    },
    { ...EMPTY_NUTRIENTS }
  );
  return {
    caloriesKcal: round(total.caloriesKcal),
    proteinG: round(total.proteinG),
    carbsG: round(total.carbsG),
    fatG: round(total.fatG),
    fibreG: total.fibreG === undefined ? undefined : round(total.fibreG),
    sugarG: total.sugarG === undefined ? undefined : round(total.sugarG),
    sodiumMg: total.sodiumMg === undefined ? undefined : round(total.sodiumMg, 0),
  };
}

export function nutrientProgress(consumed: number, target?: number): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.max(0, (consumed / target) * 100));
}

/** User-recorded workout calories for one local calendar day. */
export function workoutCaloriesForDay(
  workouts: CompletedWorkout[],
  dayKey: string
): number {
  return workouts.reduce((sum, workout) => {
    const parsed = new Date(workout.date);
    const workoutDay =
      workout.dayKey ?? (Number.isFinite(parsed.getTime()) ? toDayKey(parsed) : "");
    return workoutDay === dayKey ? sum + (workout.calories ?? 0) : sum;
  }, 0);
}

export function nutrientsForQuantity(
  perBasis: NutritionNutrients,
  quantity: number,
  basisAmount = 100
): NutritionNutrients {
  if (!Number.isFinite(quantity) || quantity < 0 || basisAmount <= 0) {
    return { ...EMPTY_NUTRIENTS };
  }
  const factor = quantity / basisAmount;
  const optional = (value: number | undefined, digits: number) =>
    value === undefined ? undefined : round(value * factor, digits);
  return {
    caloriesKcal: round(perBasis.caloriesKcal * factor),
    proteinG: round(perBasis.proteinG * factor),
    carbsG: round(perBasis.carbsG * factor),
    fatG: round(perBasis.fatG * factor),
    fibreG: optional(perBasis.fibreG, 1),
    sugarG: optional(perBasis.sugarG, 1),
    sodiumMg: optional(perBasis.sodiumMg, 0),
  };
}
