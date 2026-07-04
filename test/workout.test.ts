import { describe, it, expect } from "vitest";

import { estimateWorkoutSeconds } from "@/lib/workout";

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
