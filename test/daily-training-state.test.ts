// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { STORAGE_KEYS } from "@/lib/storage/keys";
import {
  getDailyTrainingState,
  getDailyTrainingStates,
  saveDailyTrainingState,
} from "@/lib/storage/daily-training-state";
import {
  getExercisePreferences,
  setExercisePreference,
} from "@/lib/storage/exercise-preferences";

beforeEach(() => localStorage.clear());

describe("daily training state storage", () => {
  it("defaults to normal readiness for a new day", () => {
    expect(getDailyTrainingState(new Date(2026, 6, 22))).toEqual({
      date: "2026-07-22",
      readiness: "normal",
      soreMuscles: [],
      avoidMuscles: [],
    });
  });

  it("round-trips validated readiness and muscle selections", () => {
    expect(
      saveDailyTrainingState({
        date: "2026-07-22",
        readiness: "tired",
        soreMuscles: ["chest", "chest"],
        avoidMuscles: ["shoulders"],
      })
    ).toBe(true);
    expect(getDailyTrainingState(new Date(2026, 6, 22))).toEqual({
      date: "2026-07-22",
      readiness: "tired",
      soreMuscles: ["chest"],
      avoidMuscles: ["shoulders"],
    });
  });

  it("falls back safely for corrupt storage and unknown values", () => {
    localStorage.setItem(STORAGE_KEYS.dailyTrainingState, "broken");
    expect(getDailyTrainingStates()).toEqual([]);
    localStorage.setItem(
      STORAGE_KEYS.dailyTrainingState,
      JSON.stringify({
        version: 1,
        data: [
          {
            date: "2026-07-22",
            readiness: "superhuman",
            soreMuscles: ["chest", "unknown"],
            avoidMuscles: null,
          },
        ],
      })
    );
    expect(getDailyTrainingState(new Date(2026, 6, 22))).toEqual({
      date: "2026-07-22",
      readiness: "normal",
      soreMuscles: ["chest"],
      avoidMuscles: [],
    });
  });

  it("does not overwrite long-term exercise preferences", () => {
    setExercisePreference({ exerciseId: "exercise-1", level: "prefer" });
    saveDailyTrainingState({
      date: "2026-07-22",
      readiness: "very-tired",
      soreMuscles: ["quads"],
      avoidMuscles: ["shoulders"],
    });
    expect(getExercisePreferences()).toEqual([
      expect.objectContaining({ exerciseId: "exercise-1", level: "prefer" }),
    ]);
  });
});
