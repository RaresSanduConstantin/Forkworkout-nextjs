import { describe, it, expect } from "vitest";

import {
  estimateWorkoutSeconds,
  getSetStages,
  setTopWeightKg,
  setTotalReps,
  setTotalVolumeKg,
} from "@/lib/workout";
import { workoutSchema } from "@/schema/workoutSchema";

describe("drop-set stages", () => {
  const dropSet = {
    reps: 5,
    value: "40",
    unit: "kg" as const,
    type: "drop" as const,
    dropStages: [
      { reps: 5, value: "30", unit: "kg" as const },
      { reps: 5, value: "20", unit: "kg" as const },
    ],
  };

  it("treats a drop chain as one set with multiple performance stages", () => {
    expect(getSetStages(dropSet)).toHaveLength(3);
    expect(setTotalReps(dropSet)).toBe(15);
    expect(setTotalVolumeKg(dropSet)).toBe(450);
    expect(setTopWeightKg(dropSet)).toBe(40);
  });

  it("ignores stored drop stages when the set is no longer a drop set", () => {
    expect(setTotalReps({ ...dropSet, type: "working" })).toBe(5);
    expect(setTotalVolumeKg({ ...dropSet, type: "working" })).toBe(200);
  });

  it("keeps drop stages when a remembered workout passes through the edit form", () => {
    const parsed = workoutSchema.parse({
      title: "Drop workout",
      exercises: [{ id: "curl", name: "Curl", sets: [dropSet] }],
    });

    expect(parsed.exercises[0].sets[0].dropStages).toEqual(dropSet.dropStages);
  });
});

describe("estimateWorkoutSeconds", () => {
  it("sums per-set work, rest between sets, and per-exercise overhead", () => {
    // 2 weighted sets: 50s each work + 1 rest gap of 60s + 20s overhead = 180.
    const secs = estimateWorkoutSeconds(
      [{ sets: [{ value: "20", unit: "kg" }, { value: "20", unit: "kg" }] }],
      "60"
    );
    expect(secs).toBe(180);
  });

  it("uses a time set's own duration for its work portion", () => {
    // Single 30s set: 30s work + no rest gap + 20s overhead = 50.
    const secs = estimateWorkoutSeconds([{ sets: [{ value: "30s", unit: "time" }] }], "60");
    expect(secs).toBe(50);
  });

  it("enforces a minimum rest between sets", () => {
    // rest of 5s is clamped up to the 30s floor: 2*50 + 1*30 + 20 = 150.
    const secs = estimateWorkoutSeconds(
      [{ sets: [{ value: "20", unit: "kg" }, { value: "20", unit: "kg" }] }],
      "5"
    );
    expect(secs).toBe(150);
  });
});
