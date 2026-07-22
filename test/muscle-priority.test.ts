import { describe, expect, it } from "vitest";

import type { MuscleTrainingStatus } from "@/lib/smart-workout/history-summary";
import {
  scoreMusclePriorities,
  selectRecommendedMuscles,
} from "@/lib/smart-workout/muscle-priority";

const status = (
  overrides: Partial<MuscleTrainingStatus> = {}
): MuscleTrainingStatus => ({
  muscle: "chest",
  completedSetsThisWeek: 0,
  completedSetsLast7Days: 0,
  recentWorkoutCount: 0,
  ...overrides,
});

const context = {
  experience: "intermediate" as const,
  goal: "muscle" as const,
  soreMuscles: [],
  avoidMuscles: [],
  manuallySelectedMuscles: [],
};

describe("muscle priority scoring", () => {
  it("gives a new user a useful positive priority and factual reasons", () => {
    const result = scoreMusclePriorities([status()], context)[0];
    expect(result.score).toBeGreaterThan(40);
    expect(result.reasons).toContain("No recent local training history.");
    expect(result.blocked).toBe(false);
  });

  it("lowers priority for recent high-volume training", () => {
    const high = scoreMusclePriorities([status()], context)[0];
    const low = scoreMusclePriorities(
      [status({ completedSetsLast7Days: 12, hoursSinceLastTrained: 8, recentWorkoutCount: 4 })],
      context
    )[0];
    expect(low.score).toBeLessThan(high.score);
    expect(low.reasons).toContain("Trained within the last day.");
    expect(low.reasons).toContain("Appeared in several recent workouts.");
  });

  it("applies soreness as a penalty rather than a block", () => {
    const result = scoreMusclePriorities(
      [status({ hoursSinceLastTrained: 72 })],
      { ...context, soreMuscles: ["chest"] }
    )[0];
    expect(result.blocked).toBe(false);
    expect(result.reasons).toContain("Marked sore today.");
  });

  it("blocks Avoid today muscles explicitly", () => {
    const result = scoreMusclePriorities(
      [status()],
      { ...context, avoidMuscles: ["chest"] }
    )[0];
    expect(result.blocked).toBe(true);
    expect(result.score).toBe(Number.NEGATIVE_INFINITY);
    expect(result.reasons).toEqual(["Avoided today."]);
  });

  it("boosts an explicit manual target", () => {
    const automatic = scoreMusclePriorities([status()], context)[0];
    const manual = scoreMusclePriorities(
      [status()],
      { ...context, manuallySelectedMuscles: ["chest"] }
    )[0];
    expect(manual.score).toBeGreaterThan(automatic.score);
    expect(manual.reasons).toContain("Selected as a target.");
  });

  it("selects high-priority recommended targets across different regions", () => {
    const priorities = scoreMusclePriorities(
      [
        status({ muscle: "chest" }),
        status({ muscle: "lats" }),
        status({ muscle: "lowerback" }),
        status({ muscle: "quads" }),
      ],
      context
    );
    const selected = selectRecommendedMuscles(priorities, 3);
    expect(selected).toHaveLength(3);
    expect(selected.map((item) => item.muscle)).toEqual(
      expect.arrayContaining(["quads", "lats", "chest"])
    );
    expect(selected.map((item) => item.muscle)).not.toContain("lowerback");
  });

  it("never recommends a blocked muscle", () => {
    const priorities = scoreMusclePriorities(
      [status({ muscle: "chest" }), status({ muscle: "quads" })],
      { ...context, avoidMuscles: ["chest"] }
    );
    expect(selectRecommendedMuscles(priorities, 2).map((item) => item.muscle)).toEqual(["quads"]);
  });
});
