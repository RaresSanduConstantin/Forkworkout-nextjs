import { describe, expect, it } from "vitest";

import type { LibraryExercise } from "@/lib/exercises";
import type { CompletedWorkout } from "@/lib/types";
import type { ExercisePerformanceFeedback } from "@/lib/storage/performance-feedback";
import {
  equipmentWeightIncrementKg,
  getProgressionDecision,
} from "@/lib/smart-workout/progression";
import { getExerciseStableId } from "@/lib/exercises";

const exercise: LibraryExercise = {
  name: "Dumbbell Press",
  force: "push",
  level: "beginner",
  mechanic: "compound",
  equipment: "dumbbell",
  primaryMuscles: ["chest"],
  secondaryMuscles: ["triceps"],
  instructions: [],
  category: "strength",
};

const history: CompletedWorkout[] = [
  {
    workoutId: "workout-1",
    title: "Push",
    date: "2026-07-20T10:00:00.000Z",
    exercises: [
      {
        name: exercise.name,
        sets: [
          { reps: 8, value: "20", unit: "kg", status: "done" },
          { reps: 8, value: "20", unit: "kg", status: "done" },
        ],
      },
    ],
  },
];

function rating(
  difficulty: ExercisePerformanceFeedback["difficulty"],
  completedWorkingSets = 3,
  plannedWorkingSets = 3
): ExercisePerformanceFeedback {
  return {
    workoutId: "workout-1",
    exerciseId: getExerciseStableId(exercise),
    exerciseName: exercise.name,
    completedAt: "2026-07-20T10:00:00.000Z",
    difficulty,
    completedWorkingSets,
    plannedWorkingSets,
    topWeightKg: 20,
    completedReps: [8, 8, 8].slice(0, completedWorkingSets),
  };
}

describe("feedback-aware progression", () => {
  it("preserves the legacy history fallback when feedback is missing", () => {
    expect(getProgressionDecision(exercise, [], history)).toEqual(
      expect.objectContaining({ weightKg: 22.5, source: "history" })
    );
  });

  it("increases by one equipment increment only after easy completed work", () => {
    expect(equipmentWeightIncrementKg(exercise)).toBe(2);
    expect(getProgressionDecision(exercise, [rating("easy")], history).weightKg).toBe(22);
    expect(getProgressionDecision(exercise, [rating("easy", 2, 3)], history).weightKg).toBe(20);
  });

  it("keeps the load after good or hard feedback", () => {
    expect(getProgressionDecision(exercise, [rating("good")], history).weightKg).toBe(20);
    expect(getProgressionDecision(exercise, [rating("hard")], history).weightKg).toBe(20);
  });

  it("reduces only when a failed session missed substantial volume", () => {
    expect(getProgressionDecision(exercise, [rating("failed", 2, 3)], history).weightKg).toBe(18);
    expect(getProgressionDecision(exercise, [rating("failed", 3, 3)], history).weightKg).toBe(20);
  });

  it("never increases painful feedback", () => {
    const decision = getProgressionDecision(exercise, [rating("painful")], history);
    expect(decision.weightKg).toBe(20);
    expect(decision.reason).toContain("blocks");
    expect(Number.isFinite(decision.weightKg)).toBe(true);
  });

  it("never emits invalid weights from malformed numeric input", () => {
    const malformed = { ...rating("easy"), topWeightKg: Number.POSITIVE_INFINITY };
    const decision = getProgressionDecision(exercise, [malformed], []);
    expect(decision.weightKg).toBeNull();
  });
});
