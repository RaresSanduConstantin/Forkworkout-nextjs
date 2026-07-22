import { describe, expect, it } from "vitest";

import {
  buildRecommendationReasons,
  historyConfidenceForCount,
} from "@/lib/smart-workout/explanations";

describe("recommendation explanations", () => {
  it("uses an honest fallback for a new recommended-mode user", () => {
    const result = buildRecommendationReasons({
      targetMode: "recommended",
      selectedPriorities: [],
      completedWorkoutCount: 0,
      readiness: "normal",
      soreMuscles: [],
      avoidMuscles: [],
      equipment: "gym",
    });
    expect(result.reasons).toEqual([
      "There is no workout history yet, so targets are based on your setup.",
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("only adds readiness, soreness, avoidance, and equipment reasons when applied", () => {
    const result = buildRecommendationReasons({
      targetMode: "manual",
      selectedPriorities: [],
      completedWorkoutCount: 4,
      readiness: "very-tired",
      soreMuscles: ["quads"],
      avoidMuscles: ["shoulders"],
      equipment: "home",
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "Uses the muscles you selected manually.",
        "Working-set volume was reduced because you selected very tired.",
        "Sore areas receive lower priority and volume.",
        "Areas marked Avoid today were excluded from direct work.",
        "Exercise choices fit your saved home equipment.",
      ])
    );
    expect(result.warnings).toHaveLength(1);
  });

  it("derives a recommended-target reason from a real priority component", () => {
    const result = buildRecommendationReasons({
      targetMode: "recommended",
      selectedPriorities: [
        {
          muscle: "lats",
          score: 40,
          blocked: false,
          reasons: ["Lower recent training volume."],
        },
      ],
      completedWorkoutCount: 5,
      readiness: "normal",
      soreMuscles: [],
      avoidMuscles: [],
      equipment: "gym",
    });
    expect(result.reasons[0]).toBe("Lats / upper back ranked higher because lower recent training volume.");
  });

  it("maps workout counts to stable confidence bands", () => {
    expect(historyConfidenceForCount(0)).toBe("none");
    expect(historyConfidenceForCount(2)).toBe("low");
    expect(historyConfidenceForCount(5)).toBe("medium");
    expect(historyConfidenceForCount(10)).toBe("high");
  });
});
