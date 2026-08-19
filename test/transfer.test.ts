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
import {
  createProgram,
  getProgramState,
  skipNextProgramWorkout,
} from "@/lib/storage/program-storage";
import { saveWorkouts } from "@/lib/storage/workout-storage";
import { getSettings, saveSettings } from "@/lib/storage/settings";

beforeEach(() => localStorage.clear());

describe("export/import — settings", () => {
  it("restores device settings when recovering a backup", () => {
    saveSettings({
      weeklyGoal: 6,
      onboardingDone: true,
      restVibration: false,
      restSound: false,
    });
    const bundle = buildExport();

    localStorage.clear();
    const result = mergeImport(JSON.stringify(bundle), { restoreSettings: true });

    expect(result.settingsRestored).toBe(true);
    expect(getSettings()).toEqual(bundle.settings);
  });

  it("keeps device settings during a regular merge import", () => {
    saveSettings({
      weeklyGoal: 2,
      onboardingDone: true,
      restVibration: true,
      restSound: true,
    });
    const incoming = {
      ...buildExport(),
      settings: {
        weeklyGoal: 7,
        onboardingDone: false,
        restVibration: false,
        restSound: false,
      },
    };

    const result = mergeImport(JSON.stringify(incoming));

    expect(result.settingsRestored).toBe(false);
    expect(getSettings().weeklyGoal).toBe(2);
  });
});

describe("export/import — programs", () => {
  it("backs up and restores program order and the active program", () => {
    saveWorkouts([
      { id: "push", title: "Push", exercises: [] },
      { id: "pull", title: "Pull", exercises: [] },
    ]);
    const created = createProgram("Push Pull", ["push", "pull"]);
    const bundle = buildExport();
    expect(bundle.programs?.[0].workoutIds).toEqual(["push", "pull"]);

    localStorage.clear();
    const result = mergeImport(JSON.stringify(bundle));
    expect(result.programsAdded).toBe(1);
    expect(getProgramState()).toEqual(
      expect.objectContaining({
        activeProgramId: created?.id,
        programs: [expect.objectContaining({ title: "Push Pull", workoutIds: ["push", "pull"] })],
      })
    );
  });

  it("backs up and restores skipped program progress", () => {
    const workouts = [
      { id: "push", title: "Push", exercises: [] },
      { id: "pull", title: "Pull", exercises: [] },
    ];
    saveWorkouts(workouts);
    const created = createProgram("Push Pull", ["push", "pull"]);
    skipNextProgramWorkout(
      created!.id,
      workouts,
      [],
      new Date("2026-07-24T10:00:00.000Z")
    );
    const bundle = buildExport();

    localStorage.clear();
    mergeImport(JSON.stringify(bundle));

    expect(getProgramState().progressByProgramId?.[created!.id]).toEqual({
      nextWorkoutId: "pull",
      advancedAt: "2026-07-24T10:00:00.000Z",
    });
  });
});

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
