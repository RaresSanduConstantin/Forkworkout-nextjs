import { describe, expect, it } from "vitest";

import {
  nutritionGoalPlans,
  resolveNutritionTargetsForDay,
} from "@/lib/nutrition/target-plans";

describe("nutritionGoalPlans", () => {
  it("creates selectable calorie and macro estimates for a weight-loss timeline", () => {
    const plans = nutritionGoalPlans({
      bmr: 1_750,
      tdee: 2_500,
      currentWeightKg: 90,
      goalWeightKg: 84,
      timeframeWeeks: 12,
    });

    expect(plans.map((plan) => plan.id)).toEqual(["gentle", "goal", "focused"]);
    expect(plans[0].caloriesKcal).toBeGreaterThan(plans[1].caloriesKcal);
    expect(plans[1].caloriesKcal).toBeGreaterThan(plans[2].caloriesKcal);
    for (const plan of plans) {
      expect(plan.proteinG).toBeGreaterThan(0);
      expect(plan.carbsG).toBeGreaterThanOrEqual(0);
      expect(plan.fatG).toBeGreaterThan(0);
      expect(plan.estimatedWeeks).toBeGreaterThan(0);
    }
  });

  it("bounds an aggressive timeline instead of creating an extreme target", () => {
    const plans = nutritionGoalPlans({
      bmr: 1_800,
      tdee: 2_600,
      currentWeightKg: 110,
      goalWeightKg: 75,
      timeframeWeeks: 4,
    });

    expect(plans.every((plan) => plan.caloriesKcal >= 1_800)).toBe(true);
    expect(plans.some((plan) => plan.limited)).toBe(true);
    expect(new Set(plans.map((plan) => plan.caloriesKcal)).size).toBe(3);
  });

  it("returns a maintenance plan when current and goal weight match", () => {
    expect(
      nutritionGoalPlans({
        bmr: 1_600,
        tdee: 2_200,
        currentWeightKg: 75,
        goalWeightKg: 75,
        timeframeWeeks: 12,
      })
    ).toEqual([
      expect.objectContaining({ id: "maintain", caloriesKcal: 2_200 }),
    ]);
  });

  it("uses optional training-day calories and macros only on workout days", () => {
    const targets = {
      caloriesKcal: 2100,
      proteinG: 150,
      carbsG: 220,
      fatG: 70,
      fibreG: 30,
      sodiumMg: 2300,
      trainingDay: { caloriesKcal: 2350, proteinG: 160, carbsG: 275, fatG: 70 },
      updatedAt: "2026-09-23T00:00:00.000Z",
    };

    expect(resolveNutritionTargetsForDay(targets, false)?.caloriesKcal).toBe(2100);
    expect(resolveNutritionTargetsForDay(targets, true)).toEqual(
      expect.objectContaining({ caloriesKcal: 2350, carbsG: 275, fibreG: 30 })
    );
  });
});
