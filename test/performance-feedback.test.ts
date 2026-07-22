// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { STORAGE_KEYS } from "@/lib/storage/keys";
import { clearAllData } from "@/lib/storage/reset";
import {
  addPerformanceFeedback,
  getLatestExerciseFeedback,
  getPerformanceFeedback,
} from "@/lib/storage/performance-feedback";

beforeEach(() => localStorage.clear());

const feedback = {
  workoutId: "workout-1",
  exerciseId: "builtin:bench-press:123",
  exerciseName: "Bench Press",
  completedAt: "2026-07-20T10:00:00.000Z",
  difficulty: "good" as const,
  completedWorkingSets: 3,
  plannedWorkingSets: 3,
  topWeightKg: 60,
  completedReps: [8, 8, 8],
};

describe("performance feedback storage", () => {
  it("round-trips valid feedback in a versioned envelope", () => {
    expect(addPerformanceFeedback(feedback)).toBe(true);
    expect(getPerformanceFeedback()).toEqual([feedback]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.performanceFeedback) ?? "{}")).toEqual(
      expect.objectContaining({ version: 1, data: expect.any(Array) })
    );
  });

  it("selects the newest feedback by date", () => {
    addPerformanceFeedback(feedback);
    addPerformanceFeedback({
      ...feedback,
      workoutId: "workout-2",
      completedAt: "2026-07-21T10:00:00.000Z",
      difficulty: "hard",
    });
    expect(getLatestExerciseFeedback(feedback.exerciseId)?.difficulty).toBe("hard");
  });

  it("ignores corrupt and invalid stored values", () => {
    localStorage.setItem(STORAGE_KEYS.performanceFeedback, "broken");
    expect(getPerformanceFeedback()).toEqual([]);
    localStorage.setItem(
      STORAGE_KEYS.performanceFeedback,
      JSON.stringify({ version: 1, data: [{ ...feedback, difficulty: "impossible" }] })
    );
    expect(getPerformanceFeedback()).toEqual([]);
  });

  it("is removed by the application data reset", () => {
    addPerformanceFeedback(feedback);
    clearAllData({ keepCustomExercises: true });
    expect(getPerformanceFeedback()).toEqual([]);
  });
});
