import { describe, expect, it } from "vitest";

import {
  calculateWorkoutTimeBudget,
  isWithinTimeBudget,
  TIME_BUDGET_TOLERANCE,
} from "@/lib/smart-workout/time-budget";
import { estimateWorkoutSeconds } from "@/lib/workout";

describe("shared workout time budget", () => {
  const bilateral = {
    sets: [
      { value: "20", unit: "kg" as const, type: "warmup" },
      { value: "40", unit: "kg" as const },
      { value: "40", unit: "kg" as const },
    ],
  };

  it("uses the same total as the workout preview estimator", () => {
    const exercises = [bilateral];
    const budget = calculateWorkoutTimeBudget(exercises, "60");
    expect(budget.totalSeconds).toBe(estimateWorkoutSeconds(exercises, "60"));
    expect(budget.totalSeconds).toBe(
      budget.warmupSeconds +
        budget.workingSeconds +
        budget.restSeconds +
        budget.transitionSeconds
    );
  });

  it("accounts for unilateral work taking both sides", () => {
    const normal = calculateWorkoutTimeBudget([bilateral], "60");
    const unilateral = calculateWorkoutTimeBudget([{ ...bilateral, unilateral: true }], "60");
    expect(unilateral.workingSeconds).toBe(normal.workingSeconds * 2);
    expect(unilateral.totalSeconds).toBeGreaterThan(normal.totalSeconds);
  });

  it("enforces the documented ten-percent upper tolerance", () => {
    expect(TIME_BUDGET_TOLERANCE).toBe(0.1);
    expect(isWithinTimeBudget(990, 15)).toBe(true);
    expect(isWithinTimeBudget(991, 15)).toBe(false);
  });
});
