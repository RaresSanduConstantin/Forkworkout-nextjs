import { describe, it, expect } from "vitest";

import type { CompletedWorkout } from "@/lib/types";
import {
  estimateOneRepMax,
  getExerciseHistory,
  getLastPerformance,
  getExercisePR,
  suggestNextWeight,
  getTypicalDurationSec,
} from "@/lib/history-stats";

function session(date: string, name: string, sets: CompletedWorkout["exercises"][number]["sets"]): CompletedWorkout {
  return { date, title: "W", exercises: [{ name, sets }] } as CompletedWorkout;
}

// Two bench sessions (60kg then 62.5kg) plus a warm-up + a skipped set to ignore.
const history: CompletedWorkout[] = [
  session("2026-01-01T10:00:00.000Z", "Bench Press", [
    { reps: 10, value: "20", unit: "kg", status: "done", type: "warmup" },
    { reps: 8, value: "60", unit: "kg", status: "done" },
    { reps: 8, value: "60", unit: "kg", status: "done" },
    { reps: 8, value: "70", unit: "kg", status: "skipped" },
  ]),
  session("2026-01-05T10:00:00.000Z", "Bench Press", [
    { reps: 8, value: "62.5", unit: "kg", status: "done" },
  ]),
];

describe("estimateOneRepMax (Epley)", () => {
  it("returns the weight at 1 rep and scales with reps", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(60, 8)).toBeCloseTo(76); // 60 * (1 + 8/30)
    expect(estimateOneRepMax(0, 8)).toBe(0);
  });
});

describe("per-exercise history", () => {
  it("summarizes sessions oldest→newest, ignoring warm-ups and non-done sets", () => {
    const stats = getExerciseHistory("Bench Press", history);
    expect(stats).toHaveLength(2);
    expect(stats[0].topWeightKg).toBe(60); // skipped 70kg is excluded
    expect(stats[1].topWeightKg).toBe(62.5);
    expect(stats[0].date < stats[1].date).toBe(true);
  });

  it("matches names case/whitespace-insensitively", () => {
    expect(getLastPerformance("  bench   press ", history)?.topWeightKg).toBe(62.5);
  });

  it("PR reflects the best set across all sessions", () => {
    const pr = getExercisePR("Bench Press", history);
    expect(pr?.maxWeightKg).toBe(62.5);
    expect(pr?.kind).toBe("kg");
  });
});

describe("suggestNextWeight (progressive overload)", () => {
  it("suggests +2.5kg over the last top weight for kg lifts", () => {
    expect(suggestNextWeight("Bench Press", history)).toBe(65);
  });

  it("returns null when there is no kg history", () => {
    const bwHistory: CompletedWorkout[] = [
      session("2026-01-01T10:00:00.000Z", "Push-Up", [
        { reps: 20, value: "BW", unit: "bw", status: "done" },
      ]),
    ];
    expect(suggestNextWeight("Push-Up", bwHistory)).toBeNull();
    expect(suggestNextWeight("Unknown", history)).toBeNull();
  });
});

describe("getTypicalDurationSec", () => {
  const withDur = (id: string, date: string, durationSec?: number): CompletedWorkout =>
    ({ workoutId: id, title: "W", date, durationSec, exercises: [] } as CompletedWorkout);

  it("averages recent completed durations for the workout", () => {
    const h = [
      withDur("push", "2026-01-01T10:00:00.000Z", 2400), // 40m
      withDur("push", "2026-01-08T10:00:00.000Z", 3000), // 50m
      withDur("leg", "2026-01-05T10:00:00.000Z", 9999), // different workout, ignored
    ];
    expect(getTypicalDurationSec("push", h)).toBe(2700); // avg of 2400 & 3000
  });

  it("ignores sessions with no/zero duration", () => {
    const h = [
      withDur("push", "2026-01-01T10:00:00.000Z", 2400),
      withDur("push", "2026-01-02T10:00:00.000Z", 0),
      withDur("push", "2026-01-03T10:00:00.000Z", undefined),
    ];
    expect(getTypicalDurationSec("push", h)).toBe(2400);
  });

  it("only samples the most recent N sessions", () => {
    const h = [
      withDur("push", "2026-01-01T10:00:00.000Z", 6000), // oldest, excluded when N=2
      withDur("push", "2026-01-02T10:00:00.000Z", 2400),
      withDur("push", "2026-01-03T10:00:00.000Z", 3000),
    ];
    expect(getTypicalDurationSec("push", h, 2)).toBe(2700); // two newest only
  });

  it("returns null when the workout was never completed", () => {
    expect(getTypicalDurationSec("push", [])).toBeNull();
  });
});
