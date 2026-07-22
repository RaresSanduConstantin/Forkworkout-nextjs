// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";

import { buildExport, mergeImport } from "@/lib/storage/transfer";
import { getHomeEquipment, saveHomeEquipment } from "@/lib/storage/home-equipment";
import {
  getExercisePreferences,
  setExercisePreference,
} from "@/lib/storage/exercise-preferences";
import {
  addPerformanceFeedback,
  getPerformanceFeedback,
} from "@/lib/storage/performance-feedback";
import {
  getDailyTrainingState,
  saveDailyTrainingState,
} from "@/lib/storage/daily-training-state";

beforeEach(() => localStorage.clear());

describe("export/import — home equipment", () => {
  it("includes home equipment in the export bundle", () => {
    saveHomeEquipment({ owned: ["dumbbells"], dumbbellMaxKg: 8 });
    const bundle = buildExport();
    expect(bundle.homeEquipment?.owned).toEqual(["dumbbells"]);
    expect(bundle.homeEquipment?.dumbbellMaxKg).toBe(8);
  });

  it("restores home equipment on import when this device has none set", () => {
    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workouts: [],
      completedWorkouts: [],
      bodyMetrics: [],
      customExercises: [],
      homeEquipment: { owned: ["kettlebells"], kettlebellMaxKg: 12 },
    };
    const res = mergeImport(JSON.stringify(bundle));
    expect(res.homeEquipmentRestored).toBe(true);
    expect(getHomeEquipment().owned).toEqual(["kettlebells"]);
    expect(getHomeEquipment().kettlebellMaxKg).toBe(12);
  });

  it("does not overwrite home equipment already configured on this device", () => {
    saveHomeEquipment({ owned: ["dumbbells"], dumbbellMaxKg: 20 });
    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workouts: [],
      completedWorkouts: [],
      bodyMetrics: [],
      customExercises: [],
      homeEquipment: { owned: ["bands"] },
    };
    const res = mergeImport(JSON.stringify(bundle));
    expect(res.homeEquipmentRestored).toBe(false);
    expect(getHomeEquipment().owned).toEqual(["dumbbells"]);
  });
});

describe("export/import — exercise preferences", () => {
  it("includes and restores preferences by stable exercise id", () => {
    setExercisePreference({
      exerciseId: "builtin:bench-press:123",
      exerciseName: "Bench Press",
      level: "avoid",
      reason: "discomfort",
    });
    const bundle = buildExport();
    expect(bundle.exercisePreferences).toHaveLength(1);

    localStorage.clear();
    mergeImport(JSON.stringify(bundle));
    expect(getExercisePreferences()).toEqual([
      expect.objectContaining({
        exerciseId: "builtin:bench-press:123",
        level: "avoid",
        reason: "discomfort",
      }),
    ]);
  });
});

describe("export/import — performance feedback", () => {
  it("includes and restores valid feedback events", () => {
    addPerformanceFeedback({
      workoutId: "workout-1",
      exerciseId: "builtin:bench-press:123",
      completedAt: "2026-07-20T10:00:00.000Z",
      difficulty: "easy",
      completedWorkingSets: 3,
      plannedWorkingSets: 3,
      topWeightKg: 60,
    });
    const bundle = buildExport();
    expect(bundle.performanceFeedback).toHaveLength(1);

    localStorage.clear();
    mergeImport(JSON.stringify(bundle));
    expect(getPerformanceFeedback()).toEqual([
      expect.objectContaining({ difficulty: "easy", topWeightKg: 60 }),
    ]);
  });
});

describe("export/import — daily training state", () => {
  it("includes and restores recent local daily state", () => {
    saveDailyTrainingState({
      date: "2026-07-22",
      readiness: "tired",
      soreMuscles: ["quads"],
      avoidMuscles: ["shoulders"],
    });
    const bundle = buildExport();
    expect(bundle.dailyTrainingStates).toHaveLength(1);

    localStorage.clear();
    mergeImport(JSON.stringify(bundle));
    expect(getDailyTrainingState(new Date(2026, 6, 22))).toEqual(
      expect.objectContaining({ readiness: "tired", avoidMuscles: ["shoulders"] })
    );
  });
});
