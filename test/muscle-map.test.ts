import { describe, it, expect } from "vitest";

import {
  TARGET_TO_SDK,
  SDK_TO_TARGET,
  SELECTABLE_MUSCLES,
  muscleScores,
  muscleHighlights,
  HEAT_COLOR,
} from "@/lib/muscle-map";
import { MUSCLE_TARGETS, type LibraryExercise } from "@/lib/exercises";

describe("target <-> SDK slug mapping", () => {
  it("every muscle target has at least one SDK slug", () => {
    for (const t of MUSCLE_TARGETS) {
      expect(TARGET_TO_SDK[t.key]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("SDK_TO_TARGET is a correct inverse of TARGET_TO_SDK", () => {
    for (const [key, slugs] of Object.entries(TARGET_TO_SDK)) {
      for (const slug of slugs) expect(SDK_TO_TARGET[slug]).toBe(key);
    }
  });

  it("lets custom exercises target abs and obliques independently", () => {
    const values = SELECTABLE_MUSCLES.map((muscle) => muscle.value);
    expect(values).toContain("abdominals");
    expect(values).toContain("obliques");
  });
});

describe("muscleScores / muscleHighlights", () => {
  const library: LibraryExercise[] = [
    {
      name: "Bench",
      force: null,
      level: "beginner",
      mechanic: "compound",
      equipment: "barbell",
      primaryMuscles: ["chest"],
      secondaryMuscles: ["triceps"],
      instructions: [],
      category: "strength",
    },
  ];

  it("counts completed working sets and excludes warm-ups", () => {
    const scores = muscleScores(
      [
        {
          name: "Bench",
          sets: [
            { status: "done", type: "warmup" },
            { status: "done" },
            { status: "done" },
            { status: "pending" },
          ],
        },
      ],
      library
    );
    expect(scores["chest"]).toBe(2); // two done working sets
    expect(scores["triceps"]).toBeCloseTo(0.8); // secondary weight 0.4 * 2
  });

  it("ignores exercises unknown to the library", () => {
    const scores = muscleScores([{ name: "Mystery", sets: [{ status: "done" }] }], library);
    expect(Object.keys(scores)).toHaveLength(0);
  });

  it("maps oblique exercise volume to the oblique body region", () => {
    const scores = muscleScores(
      [{ name: "Side bend", sets: [{ status: "done" }] }],
      [
        {
          ...library[0],
          name: "Side bend",
          primaryMuscles: ["obliques"],
          secondaryMuscles: ["abdominals"],
        },
      ]
    );
    expect(scores.obliques).toBe(1);
    expect(scores.abs).toBeCloseTo(0.4);
  });

  it("highlights use the heat color and ramp opacity with volume", () => {
    const hs = muscleHighlights({ chest: 4 });
    expect(hs[0].color).toBe(HEAT_COLOR);
    expect(hs[0].opacity).toBeCloseTo(1);
    const faint = muscleHighlights({ chest: 1 });
    expect(faint[0].opacity).toBeLessThan(1);
    expect(faint[0].opacity).toBeGreaterThan(0);
  });
});
