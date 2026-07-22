import { describe, expect, it } from "vitest";

import type { LibraryExercise } from "@/lib/exercises";
import { getExerciseStableId } from "@/lib/exercises";
import { checkExerciseEligibility } from "@/lib/smart-workout/exercise-eligibility";
import { scoreExercise } from "@/lib/smart-workout/exercise-scoring";

const exercise: LibraryExercise = {
  name: "Bench Press",
  force: "push",
  level: "beginner",
  mechanic: "compound",
  equipment: "barbell",
  primaryMuscles: ["chest"],
  secondaryMuscles: ["triceps"],
  instructions: [],
  category: "strength",
};

const eligibilityContext = {
  equipment: "gym" as const,
  experience: "intermediate" as const,
  targetLibraryMuscles: new Set(["chest"]),
  avoidLibraryMuscles: new Set<string>(),
};

describe("exercise eligibility", () => {
  it("allows a valid direct target match", () => {
    expect(checkExerciseEligibility(exercise, eligibilityContext)).toEqual({ allowed: true });
  });

  it("excludes unavailable equipment before scoring", () => {
    expect(
      checkExerciseEligibility(exercise, { ...eligibilityContext, equipment: "none" })
    ).toEqual({ allowed: false, reason: "Required equipment is unavailable." });
  });

  it("excludes preferences and muscles marked Avoid today", () => {
    expect(
      checkExerciseEligibility(exercise, {
        ...eligibilityContext,
        preference: {
          exerciseId: getExerciseStableId(exercise),
          level: "avoid",
          updatedAt: "2026-07-22T10:00:00.000Z",
        },
      }).reason
    ).toContain("preferences");
    expect(
      checkExerciseEligibility(exercise, {
        ...eligibilityContext,
        avoidLibraryMuscles: new Set(["chest"]),
      }).reason
    ).toContain("Avoid today");
  });
});

describe("explainable exercise scoring", () => {
  const context = {
    ...eligibilityContext,
    soreLibraryMuscles: new Set<string>(),
    strategy: "balanced" as const,
    hasProgression: false,
  };

  it("returns negative infinity and a reason for excluded exercises", () => {
    const result = scoreExercise(exercise, { ...context, equipment: "none" });
    expect(result.excluded).toBe(true);
    expect(result.score).toBe(Number.NEGATIVE_INFINITY);
    expect(result.exclusionReason).toBe("Required equipment is unavailable.");
  });

  it("explains preference, progression, repetition, and soreness adjustments", () => {
    const result = scoreExercise(exercise, {
      ...context,
      strategy: "progressive",
      hasProgression: true,
      recentlyPerformed: true,
      soreLibraryMuscles: new Set(["chest"]),
      preference: {
        exerciseId: getExerciseStableId(exercise),
        level: "prefer",
        updatedAt: "2026-07-22T10:00:00.000Z",
      },
    });
    expect(result.excluded).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "Marked as preferred.",
        "Has a local load suggestion.",
        "Performed recently.",
        "Works an area marked sore today.",
      ])
    );
  });

  it("penalizes demanding compounds for low-fatigue scoring", () => {
    const balanced = scoreExercise(exercise, context);
    const lowFatigue = scoreExercise(exercise, { ...context, strategy: "low-fatigue" });
    expect(lowFatigue.score).toBeLessThan(balanced.score);
    expect(lowFatigue.reasons).toContain("Compound movement carries a low-fatigue penalty.");
  });
});
