import { describe, expect, it } from "vitest";

import type { LibraryExercise } from "@/lib/exercises";
import type { CompletedWorkout } from "@/lib/types";
import {
  collectCurrentWeekExercises,
  muscleGroupSetCountsThisWeek,
} from "@/lib/muscle-stats";

const library: LibraryExercise[] = [
  {
    name: "Bench Press",
    force: "push",
    level: "beginner",
    mechanic: "compound",
    equipment: "barbell",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps"],
    instructions: [],
    category: "strength",
  },
];

const workout = (date: string, dayKey?: string): CompletedWorkout => ({
  workoutId: date,
  title: "Push",
  date,
  dayKey,
  exercises: [
    {
      name: "Bench Press",
      sets: [{ reps: 8, value: "60", unit: "kg", status: "done" }],
    },
  ],
});

describe("current-week muscle stats", () => {
  it("uses the same Monday–Sunday boundary as workout goals", () => {
    const history = [
      workout("2026-07-17T10:00:00.000Z", "2026-07-17"), // previous Friday
      workout("2026-07-20T10:00:00.000Z", "2026-07-20"), // this Monday
    ];
    const now = new Date(2026, 6, 22, 12); // Wednesday

    expect(collectCurrentWeekExercises(history, now)).toHaveLength(1);
    expect(
      muscleGroupSetCountsThisWeek(history, library, now).find(
        (entry) => entry.group === "Chest"
      )?.sets
    ).toBe(1);
  });

  it("derives a local day key for legacy entries that do not have one", () => {
    const now = new Date(2026, 6, 22, 12);
    expect(
      collectCurrentWeekExercises([workout("2026-07-21T10:00:00.000Z")], now)
    ).toHaveLength(1);
  });
});
