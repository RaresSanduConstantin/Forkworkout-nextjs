export type NutritionGoalPlan = {
  id: "gentle" | "goal" | "focused" | "maintain";
  label: string;
  description: string;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  estimatedWeeks: number | null;
  limited: boolean;
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
 * Produces conservative calorie and macro starting points for a chosen weight
 * timeline. Estimates are bounded so an aggressive date cannot create an
 * extreme deficit or surplus; the UI identifies when that bound was applied.
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
      },
    ];
  }

  const requestedDailyAdjustment = (weightChangeKg * 7_700) / (timeframeWeeks * 7);
  const choices = [
    { id: "gentle" as const, label: "Gentle", factor: 0.75, lossLimit: -350, gainLimit: 250 },
    { id: "goal" as const, label: "Goal pace", factor: 1, lossLimit: -550, gainLimit: 400 },
    { id: "focused" as const, label: "Focused", factor: 1.25, lossLimit: -750, gainLimit: 500 },
  ];

  return choices.map(({ id, label, factor, lossLimit, gainLimit }) => {
    const rawAdjustment = requestedDailyAdjustment * factor;
    const boundedAdjustment = clamp(rawAdjustment, lossLimit, gainLimit);
    const rawCalories = tdee + boundedAdjustment;
    const caloriesKcal = roundToTen(clamp(rawCalories, Math.max(1_200, bmr), 6_000));
    const effectiveAdjustment = caloriesKcal - tdee;
    const estimatedWeeks =
      effectiveAdjustment !== 0 && Math.sign(effectiveAdjustment) === Math.sign(weightChangeKg)
        ? Math.max(1, Math.ceil(Math.abs((weightChangeKg * 7_700) / (effectiveAdjustment * 7))))
        : null;
    const limited =
      Math.abs(rawAdjustment - boundedAdjustment) > 1 ||
      Math.abs(rawCalories - caloriesKcal) > 15;

    return {
      id,
      label,
      description: estimatedWeeks
        ? `About ${estimatedWeeks} ${estimatedWeeks === 1 ? "week" : "weeks"}`
        : "Starting estimate",
      caloriesKcal,
      ...macrosForCalories(caloriesKcal, currentWeightKg, goalWeightKg),
      estimatedWeeks,
      limited,
    };
  });
}
