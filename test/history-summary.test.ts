import { describe, expect, it } from "vitest";

import type { LibraryExercise } from "@/lib/exercises";
import type { CompletedWorkout } from "@/lib/types";
import {
  SECONDARY_MUSCLE_SET_MULTIPLIER,
  summarizeMuscleTraining,
} from "@/lib/smart-workout/history-summary";

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
  {
    name: "Squat",
    force: "push",
    level: "beginner",
    mechanic: "compound",
    equipment: "barbell",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes"],
    instructions: [],
    category: "strength",
  },
];

const benchSets = [
  { reps: 10, value: "20", unit: "kg" as const, status: "done" as const, type: "warmup" as const },
  { reps: 8, value: "60", unit: "kg" as const, status: "done" as const },
  { reps: 8, value: "60", unit: "kg" as const, status: "done" as const },
  { reps: 8, value: "60", unit: "kg" as const, status: "skipped" as const },
];

describe("local muscle training summary", () => {
  it("returns zeroed status for every muscle when history is empty", () => {
    const summary = summarizeMuscleTraining([], library, new Date(2026, 6, 22, 12));
    expect(summary.length).toBeGreaterThan(10);
    expect(summary.every((status) => status.completedSetsLast7Days === 0)).toBe(true);
    expect(summary.every((status) => status.lastTrainedAt === undefined)).toBe(true);
  });

  it("counts only completed working sets and weights secondary work", () => {
    const history: CompletedWorkout[] = [
      {
        workoutId: "push",
        title: "Push",
        date: "2026-07-20T10:00:00.000Z",
        dayKey: "2026-07-20",
        exercises: [
          { name: "Bench Press", sets: benchSets },
          // Exact malformed duplicate: it must not double the result.
          { name: "Bench Press", sets: benchSets },
        ],
      },
    ];
    const summary = summarizeMuscleTraining(history, library, new Date("2026-07-22T10:00:00.000Z"));
    const chest = summary.find((status) => status.muscle === "chest")!;
    const triceps = summary.find((status) => status.muscle === "triceps")!;

    expect(chest.completedSetsLast7Days).toBe(2);
    expect(chest.completedSetsThisWeek).toBe(2);
    expect(chest.recentWorkoutCount).toBe(1);
    expect(chest.hoursSinceLastTrained).toBe(48);
    expect(triceps.completedSetsLast7Days).toBe(2 * SECONDARY_MUSCLE_SET_MULTIPLIER);
  });

  it("separates calendar-week and rolling-seven-day totals", () => {
    const history: CompletedWorkout[] = [
      {
        workoutId: "legs",
        title: "Legs",
        date: "2026-07-17T10:00:00.000Z",
        dayKey: "2026-07-17",
        exercises: [
          {
            name: "Squat",
            sets: [{ reps: 8, value: "60", unit: "kg", status: "done" }],
          },
        ],
      },
    ];
    // Wednesday: Friday is within seven days but outside the Monday-starting week.
    const quads = summarizeMuscleTraining(
      history,
      library,
      new Date("2026-07-22T10:00:00.000Z")
    ).find((status) => status.muscle === "quads")!;
    expect(quads.completedSetsLast7Days).toBe(1);
    expect(quads.completedSetsThisWeek).toBe(0);
  });

  it("ignores invalid dates and unknown exercises without throwing", () => {
    const history = [
      { workoutId: "bad", title: "Bad", date: "not-a-date", exercises: [] },
      {
        workoutId: "unknown",
        title: "Unknown",
        date: "2026-07-21T10:00:00.000Z",
        exercises: [{ name: "Missing", sets: benchSets }],
      },
    ] as CompletedWorkout[];
    expect(() =>
      summarizeMuscleTraining(history, library, new Date("2026-07-22T10:00:00.000Z"))
    ).not.toThrow();
    expect(
      summarizeMuscleTraining(history, library, new Date("2026-07-22T10:00:00.000Z")).every(
        (status) => status.completedSetsLast7Days === 0
      )
    ).toBe(true);
  });
});
