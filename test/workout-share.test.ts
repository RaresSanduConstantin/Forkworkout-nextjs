// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { decodeWorkout, encodeWorkout } from "@/lib/storage/share";
import type { Workout } from "@/lib/types";

describe("workout sharing", () => {
  it("round-trips remembered drop-set stages", () => {
    const workout: Workout = {
      id: "drop-workout",
      title: "Drop workout",
      exercises: [
        {
          name: "Curl",
          sets: [
            {
              reps: 5,
              value: "40",
              unit: "kg",
              type: "drop",
              dropStages: [
                { reps: 5, value: "30", unit: "kg" },
                { reps: 5, value: "20", unit: "kg" },
              ],
            },
          ],
        },
      ],
    };

    const decoded = decodeWorkout(encodeWorkout(workout) ?? "");

    expect(decoded?.workout.exercises[0].sets[0].dropStages).toEqual([
      expect.objectContaining({ reps: 5, value: "30", unit: "kg" }),
      expect.objectContaining({ reps: 5, value: "20", unit: "kg" }),
    ]);
  });
});
