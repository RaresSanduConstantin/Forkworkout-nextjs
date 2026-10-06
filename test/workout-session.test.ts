import { describe, expect, it } from "vitest";

import {
  arrangeSupersetExercises,
  getNextPendingSessionSet,
  getSessionSetSequence,
  isSameSupersetRound,
} from "@/lib/workout-session";
import type { SessionExercise, SetStatus } from "@/lib/types";

function exercise(
  name: string,
  statuses: SetStatus[],
  superset?: string
): SessionExercise {
  return {
    id: name,
    name,
    superset,
    sets: statuses.map((status, index) => ({
      id: `${name}-${index}`,
      reps: 10,
      value: "20",
      unit: "kg",
      status,
    })),
  };
}

describe("live workout superset ordering", () => {
  it("moves scattered group members next to the first member", () => {
    const exercises = [
      exercise("Bench", ["pending"], "A"),
      exercise("Row", ["pending"]),
      exercise("Fly", ["pending"], "A"),
      exercise("Curl", ["pending"]),
    ];

    expect(arrangeSupersetExercises(exercises).map((item) => item.name)).toEqual([
      "Bench",
      "Fly",
      "Row",
      "Curl",
    ]);
  });

  it("preserves member order and leaves single-member groups in place", () => {
    const exercises = [
      exercise("Solo", ["pending"], "B"),
      exercise("Bench", ["pending"], "A"),
      exercise("Row", ["pending"]),
      exercise("Fly", ["pending"], "A"),
    ];

    expect(arrangeSupersetExercises(exercises).map((item) => item.name)).toEqual([
      "Solo",
      "Bench",
      "Fly",
      "Row",
    ]);
  });
});

describe("live workout superset progression", () => {
  it("builds a round-robin set sequence for supersets", () => {
    const exercises = [
      exercise("Bench", ["pending", "pending", "pending"], "A"),
      exercise("Fly", ["pending", "pending", "pending"], "A"),
      exercise("Curl", ["pending", "pending"]),
    ];

    expect(getSessionSetSequence(exercises)).toEqual([
      { exerciseIndex: 0, setIndex: 0 },
      { exerciseIndex: 1, setIndex: 0 },
      { exerciseIndex: 0, setIndex: 1 },
      { exerciseIndex: 1, setIndex: 1 },
      { exerciseIndex: 0, setIndex: 2 },
      { exerciseIndex: 1, setIndex: 2 },
      { exerciseIndex: 2, setIndex: 0 },
      { exerciseIndex: 2, setIndex: 1 },
    ]);
  });

  it("moves to the partner set, then returns to the first exercise's next set", () => {
    const afterBench = [
      exercise("Bench", ["pending", "pending"], "A"),
      exercise("Fly", ["pending", "pending"], "A"),
    ];
    const flySetOne = getNextPendingSessionSet(afterBench, {
      exerciseIndex: 0,
      setIndex: 0,
    });
    expect(flySetOne).toEqual({ exerciseIndex: 1, setIndex: 0 });
    expect(
      isSameSupersetRound(afterBench, { exerciseIndex: 0, setIndex: 0 }, flySetOne)
    ).toBe(true);

    const afterFly = [
      exercise("Bench", ["done", "pending"], "A"),
      exercise("Fly", ["pending", "pending"], "A"),
    ];
    const benchSetTwo = getNextPendingSessionSet(afterFly, {
      exerciseIndex: 1,
      setIndex: 0,
    });
    expect(benchSetTwo).toEqual({ exerciseIndex: 0, setIndex: 1 });
    expect(
      isSameSupersetRound(afterFly, { exerciseIndex: 1, setIndex: 0 }, benchSetTwo)
    ).toBe(false);
  });

  it("handles unequal set counts and continues to the next exercise", () => {
    const exercises = [
      exercise("Bench", ["done", "done", "pending"], "A"),
      exercise("Fly", ["done", "done"], "A"),
      exercise("Curl", ["pending"]),
    ];

    expect(
      getNextPendingSessionSet(exercises, { exerciseIndex: 0, setIndex: 2 })
    ).toEqual({ exerciseIndex: 2, setIndex: 0 });
  });

  it("finishes a manually focused superset before returning to earlier work", () => {
    const exercises = [
      exercise("Squat", ["pending"]),
      exercise("Bench", ["pending", "pending"], "A"),
      exercise("Fly", ["pending", "pending"], "A"),
    ];

    expect(
      getNextPendingSessionSet(exercises, { exerciseIndex: 1, setIndex: 0 })
    ).toEqual({ exerciseIndex: 2, setIndex: 0 });
  });
});
