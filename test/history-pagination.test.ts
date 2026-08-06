import { describe, expect, it } from "vitest";

import type { CompletedWorkout } from "@/lib/types";
import { paginateHistory } from "@/lib/history-pagination";

const entry = (day: number): CompletedWorkout => ({
  workoutId: `workout-${day}`,
  title: `Workout ${day}`,
  date: `2026-07-${String(day).padStart(2, "0")}T10:00:00.000Z`,
});

describe("recent activity pagination", () => {
  const history = Array.from({ length: 25 }, (_, index) => entry(index + 1));

  it("shows newest workouts first in bounded pages", () => {
    const first = paginateHistory(history, 1, 10);
    const second = paginateHistory(history, 2, 10);

    expect(first.entries.map((item) => item.workoutId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `workout-${25 - index}`)
    );
    expect(first).toMatchObject({ page: 1, totalPages: 3, rangeStart: 1, rangeEnd: 10 });
    expect(second).toMatchObject({ page: 2, rangeStart: 11, rangeEnd: 20 });
  });

  it("clamps invalid and out-of-range page requests", () => {
    expect(paginateHistory(history, 0, 10).page).toBe(1);
    const last = paginateHistory(history, 99, 10);
    expect(last.page).toBe(3);
    expect(last.entries).toHaveLength(5);
    expect(last.rangeEnd).toBe(25);
  });

  it("returns an empty first page for empty history", () => {
    expect(paginateHistory([], 1, 10)).toMatchObject({
      entries: [],
      page: 1,
      totalPages: 1,
      totalEntries: 0,
      rangeStart: 0,
      rangeEnd: 0,
    });
  });
});
