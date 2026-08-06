// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  getCompletedWorkouts,
  saveCompletedWorkouts,
} from "@/lib/storage/history-storage";

beforeEach(() => localStorage.clear());

describe("completed history storage", () => {
  it("preserves PR-only exclusions without removing the completed set", () => {
    expect(
      saveCompletedWorkouts([
        {
          workoutId: "push",
          title: "Push",
          date: "2026-08-06T10:00:00.000Z",
          exercises: [
            {
              name: "Bench Press",
              sets: [
                {
                  reps: 8,
                  value: "65",
                  unit: "kg",
                  status: "done",
                  excludeFromPR: true,
                },
              ],
            },
          ],
        },
      ])
    ).toBe(true);

    expect(getCompletedWorkouts()[0].exercises?.[0].sets[0]).toEqual(
      expect.objectContaining({
        value: "65",
        status: "done",
        excludeFromPR: true,
      })
    );
  });
});
