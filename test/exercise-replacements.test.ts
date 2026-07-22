import { describe, expect, it } from "vitest";

import type { LibraryExercise } from "@/lib/exercises";
import {
  availableCustomReplacements,
  recommendExerciseReplacements,
} from "@/lib/smart-workout/exercise-replacements";

function exercise(
  id: string,
  name: string,
  primaryMuscles: string[],
  secondaryMuscles: string[] = [],
  equipment: string | null = "dumbbell"
): LibraryExercise {
  return {
    id,
    name,
    primaryMuscles,
    secondaryMuscles,
    equipment,
    level: "beginner",
    force: null,
    mechanic: "isolation",
    instructions: [],
    category: "strength",
  };
}

describe("exercise replacement recommendations", () => {
  const current = exercise("current", "Current press", ["chest"]);
  const direct = exercise("direct", "Direct press", ["chest"]);
  const preferred = exercise("preferred", "Preferred fly", ["chest"]);
  const secondary = exercise("secondary", "Secondary chest move", ["triceps"], ["chest"]);
  const unrelated = exercise("unrelated", "Leg curl", ["hamstrings"]);

  it("only recommends alternatives that train the same muscles", () => {
    const names = recommendExerciseReplacements({
      library: [current, direct, secondary, unrelated],
      currentName: current.name,
    }).map((item) => item.exercise.name);

    expect(names).toContain("Direct press");
    expect(names).toContain("Secondary chest move");
    expect(names).not.toContain("Current press");
    expect(names).not.toContain("Leg curl");
  });

  it("ranks preferred exercises first and excludes avoided exercises", () => {
    const suggestions = recommendExerciseReplacements({
      library: [current, direct, preferred, secondary],
      currentName: current.name,
      preferences: [
        {
          exerciseId: "preferred",
          level: "prefer",
          updatedAt: "2026-07-22T00:00:00.000Z",
        },
        {
          exerciseId: "direct",
          level: "avoid",
          updatedAt: "2026-07-22T00:00:00.000Z",
        },
      ],
    });

    expect(suggestions[0].exercise.name).toBe("Preferred fly");
    expect(suggestions.map((item) => item.exercise.name)).not.toContain("Direct press");
  });

  it("does not suggest exercises already used in the workout", () => {
    const suggestions = recommendExerciseReplacements({
      library: [current, direct, preferred],
      currentName: current.name,
      excludedNames: [preferred.name],
    });

    expect(suggestions.map((item) => item.exercise.name)).toEqual(["Direct press"]);
  });

  it("keeps custom exercises available when they lack scoring metadata", () => {
    const custom = {
      ...exercise("custom", "My custom movement", [], [], null),
      custom: true,
      category: "stretching",
    };

    expect(
      availableCustomReplacements({
        library: [current, custom],
        currentName: current.name,
      }).map((item) => item.name)
    ).toEqual(["My custom movement"]);
  });

  it("honors wizard equipment constraints when replacing an avoided option", () => {
    const weighted = exercise("weighted", "Weighted press", ["chest"], [], "barbell");
    const bodyweight = exercise("bodyweight", "Bodyweight press", ["chest"], [], null);

    const suggestions = recommendExerciseReplacements({
      library: [current, weighted, bodyweight],
      currentName: current.name,
      scoringContext: { equipment: "none", experience: "beginner" },
    });

    expect(suggestions.map((item) => item.exercise.name)).toEqual(["Bodyweight press"]);
  });
});
