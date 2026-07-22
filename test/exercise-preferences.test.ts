// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { STORAGE_KEYS } from "@/lib/storage/keys";
import {
  getExercisePreference,
  getExercisePreferences,
  setExercisePreference,
} from "@/lib/storage/exercise-preferences";
import { clearAllData } from "@/lib/storage/reset";

beforeEach(() => localStorage.clear());

describe("exercise preference storage", () => {
  it("survives a storage round trip in a versioned envelope", () => {
    expect(
      setExercisePreference({
        exerciseId: "builtin:bench-press:123",
        exerciseName: "Bench Press",
        level: "prefer",
      })
    ).toBe(true);

    expect(getExercisePreference("builtin:bench-press:123")).toEqual(
      expect.objectContaining({
        exerciseName: "Bench Press",
        level: "prefer",
      })
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.exercisePreferences) ?? "{}")).toEqual(
      expect.objectContaining({ version: 1, data: expect.any(Array) })
    );
  });

  it("resets an exercise to neutral by removing its stored preference", () => {
    setExercisePreference({ exerciseId: "one", level: "avoid", reason: "dislike" });
    setExercisePreference({ exerciseId: "one", level: "neutral" });
    expect(getExercisePreferences()).toEqual([]);
  });

  it("ignores expired temporary avoids", () => {
    setExercisePreference({
      exerciseId: "one",
      level: "avoid",
      reason: "temporary",
      expiresAt: "2025-01-08T00:00:00.000Z",
    });
    expect(getExercisePreferences(Date.parse("2025-01-07T00:00:00.000Z"))).toHaveLength(1);
    expect(getExercisePreferences(Date.parse("2025-01-09T00:00:00.000Z"))).toEqual([]);
  });

  it("falls back safely for corrupt and invalid stored data", () => {
    localStorage.setItem(STORAGE_KEYS.exercisePreferences, "not-json");
    expect(getExercisePreferences()).toEqual([]);

    localStorage.setItem(
      STORAGE_KEYS.exercisePreferences,
      JSON.stringify({ version: 999, data: [{ exerciseId: "", level: "maybe" }, null] })
    );
    expect(getExercisePreferences()).toEqual([]);
  });

  it("is removed by the app's data reset", () => {
    setExercisePreference({ exerciseId: "one", level: "prefer" });
    clearAllData({ keepCustomExercises: true });
    expect(getExercisePreferences()).toEqual([]);
  });
});
