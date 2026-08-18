// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  getCompletedWorkouts,
  saveCompletedWorkouts,
  updateCompletedWorkout,
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

  it("updates one entry by its original timestamp and refreshes its local day", () => {
    const originalDate = "2026-08-06T10:00:00.000Z";
    expect(
      saveCompletedWorkouts([
        { workoutId: "push", title: "Push", date: originalDate, durationSec: 36000 },
        {
          workoutId: "pull",
          title: "Pull",
          date: "2026-08-05T10:00:00.000Z",
          durationSec: 2400,
        },
      ])
    ).toBe(true);

    const editedDate = "2026-08-07T18:30:00.000Z";
    expect(
      updateCompletedWorkout(originalDate, {
        workoutId: "push",
        title: "Push corrected",
        date: editedDate,
        dayKey: "1999-01-01",
        durationSec: 2700,
      })
    ).toBe(true);

    const entries = getCompletedWorkouts();
    expect(entries).toHaveLength(2);
    expect(entries.find((entry) => entry.workoutId === "push")).toEqual(
      expect.objectContaining({
        title: "Push corrected",
        date: editedDate,
        durationSec: 2700,
      })
    );
    expect(entries.find((entry) => entry.workoutId === "push")?.dayKey).not.toBe(
      "1999-01-01"
    );
    expect(entries.find((entry) => entry.workoutId === "pull")?.durationSec).toBe(2400);
  });

  it("does not update when the original timestamp is missing", () => {
    expect(
      updateCompletedWorkout("missing", {
        workoutId: "push",
        title: "Push",
        date: "2026-08-07T18:30:00.000Z",
      })
    ).toBe(false);
  });
});
