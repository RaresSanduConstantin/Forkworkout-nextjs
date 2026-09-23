import type { NutritionTargets } from "@/lib/nutrition/types";

export type NutritionGoalPlan = {
  id: "gentle" | "goal" | "focused" | "timeline" | "maintain";
  label: string;
  description: string;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  estimatedWeeks: number | null;
  limited: boolean;
  caution: boolean;
};

type NutritionGoalPlanInput = {
  bmr: number;
  tdee: number;
  currentWeightKg: number;
  goalWeightKg: number;
  timeframeWeeks: number;
};

const round = (value: number) => Math.round(value);
const roundToTen = (value: number) => Math.round(value / 10) * 10;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function resolveNutritionTargetsForDay(
  targets: NutritionTargets | null,
  isTrainingDay: boolean
): NutritionTargets | null {
  if (!targets || !isTrainingDay || !targets.trainingDay) return targets;
  return {
    ...targets,
    ...targets.trainingDay,
  };
}

function macrosForCalories(
  caloriesKcal: number,
  currentWeightKg: number,
  goalWeightKg: number
) {
  const referenceWeight = goalWeightKg < currentWeightKg
    ? goalWeightKg
    : currentWeightKg;
  const proteinG = round(Math.min(referenceWeight * 1.8, (caloriesKcal * 0.35) / 4));
  const fatG = round((caloriesKcal * 0.25) / 9);
  const carbsG = round(Math.max(0, (caloriesKcal - proteinG * 4 - fatG * 9) / 4));
  return { proteinG, carbsG, fatG };
}

/**
 * Produces three stable calorie and macro starting points plus one plan based
 * on the user's chosen timeline. Estimates are bounded so an aggressive date
 * cannot create an extreme deficit or surplus; the UI identifies when that
 * bound was applied.
 */
export function nutritionGoalPlans({
  bmr,
  tdee,
  currentWeightKg,
  goalWeightKg,
  timeframeWeeks,
}: NutritionGoalPlanInput): NutritionGoalPlan[] {
  if (
    ![bmr, tdee, currentWeightKg, goalWeightKg, timeframeWeeks].every(
      (value) => Number.isFinite(value) && value > 0
    )
  ) {
    return [];
  }

  const weightChangeKg = goalWeightKg - currentWeightKg;
  if (Math.abs(weightChangeKg) < 0.1) {
    const caloriesKcal = roundToTen(tdee);
    return [
      {
        id: "maintain",
        label: "Maintain",
        description: "Keep your current weight",
        caloriesKcal,
        ...macrosForCalories(caloriesKcal, currentWeightKg, goalWeightKg),
        estimatedWeeks: null,
        limited: false,
        caution: false,
      },
    ];
  }

  const isWeightLoss = weightChangeKg < 0;
  const requestedDailyAdjustment = (weightChangeKg * 7_700) / (timeframeWeeks * 7);
  const choices: Array<{
    id: "gentle" | "goal" | "focused" | "timeline";
    label: string;
    adjustment: number;
    description?: string;
  }> = [
    {
      id: "gentle",
      label: "Gentle",
      adjustment: isWeightLoss ? -250 : 200,
    },
    {
      id: "goal",
      label: "Recommended",
      adjustment: isWeightLoss ? -500 : 350,
    },
    {
      id: "focused",
      label: "Focused",
      adjustment: isWeightLoss ? -750 : 500,
    },
    {
      id: "timeline",
      label: `Your ${timeframeWeeks}-week goal`,
      adjustment: requestedDailyAdjustment,
      description: `Based on the ${timeframeWeeks}-week timeframe you selected`,
    },
  ];

  return choices.map(({ id, label, adjustment, description }) => {
    const isTimeline = id === "timeline";
    const boundedAdjustment = isTimeline
      ? adjustment
      : clamp(adjustment, -750, 500);
    const rawCalories = tdee + boundedAdjustment;
    const calorieFloor = isTimeline ? 1_200 : Math.max(1_200, bmr);
    const caloriesKcal = roundToTen(clamp(rawCalories, calorieFloor, 6_000));
    const effectiveAdjustment = caloriesKcal - tdee;
    const estimatedWeeks =
      effectiveAdjustment !== 0 && Math.sign(effectiveAdjustment) === Math.sign(weightChangeKg)
        ? Math.max(1, Math.ceil(Math.abs((weightChangeKg * 7_700) / (effectiveAdjustment * 7))))
        : null;
    const limited = Math.abs(rawCalories - caloriesKcal) > 15;
    const caution = isTimeline && (adjustment < -750 || adjustment > 500);

    return {
      id,
      label,
      description: description ?? (estimatedWeeks
        ? `About ${estimatedWeeks} ${estimatedWeeks === 1 ? "week" : "weeks"}`
        : "Starting estimate"),
      caloriesKcal,
      ...macrosForCalories(caloriesKcal, currentWeightKg, goalWeightKg),
      estimatedWeeks,
      limited,
      caution,
    };
  });
}
