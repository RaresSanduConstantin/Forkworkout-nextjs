// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addCustomExercise,
  deleteCustomExercise,
  getCustomExercises,
  upsertCustomExercise,
} from "@/lib/storage/custom-exercises";
import { STORAGE_KEYS } from "@/lib/storage/keys";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("custom exercise storage", () => {
  it("keeps older saved exercises backward compatible", () => {
    localStorage.setItem(
      STORAGE_KEYS.customExercises,
      JSON.stringify([{ name: "Legacy move", defaultUnit: "bw", custom: true }])
    );

    expect(getCustomExercises()).toEqual([
      expect.objectContaining({
        name: "Legacy move",
        force: null,
        level: "beginner",
        mechanic: null,
        defaultUnit: "bw",
      }),
    ]);
  });

  it("preserves all bundled fields and override metadata", () => {
    const saved = addCustomExercise({
      name: "Bench Press",
      sourceName: "Bench Press",
      defaultUnit: "kg",
      force: "push",
      level: "intermediate",
      mechanic: "compound",
      equipment: "barbell",
      primaryMuscles: ["chest"],
      secondaryMuscles: ["triceps"],
      instructions: ["Lower the bar.", "Press it up."],
      category: "strength",
    });

    expect(saved).toEqual(
      expect.objectContaining({
        name: "Bench Press",
        sourceName: "Bench Press",
        force: "push",
        level: "intermediate",
        mechanic: "compound",
      })
    );
    expect(getCustomExercises()).toEqual([saved]);
  });

  it("keeps a stable id when a custom exercise is renamed", () => {
    const saved = addCustomExercise({ name: "My press", defaultUnit: "kg" })!;
    const renamed = upsertCustomExercise("My press", {
      name: "My favorite press",
      defaultUnit: "kg",
    })!;

    expect(renamed.id).toBe(saved.id);
    expect(renamed.name).toBe("My favorite press");
  });
});

describe("bundled exercise overrides", () => {
  it("uses the local version until it is reset", async () => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          exercises: [
            {
              name: "Bench Press",
              force: "push",
              level: "beginner",
              mechanic: "compound",
              equipment: "barbell",
              primaryMuscles: ["chest"],
              secondaryMuscles: [],
              instructions: ["Bundled instructions"],
              category: "strength",
            },
          ],
        }),
      })
    );

    addCustomExercise({
      name: "Bench Press",
      sourceName: "Bench Press",
      defaultUnit: "kg",
      force: "push",
      level: "expert",
      mechanic: "compound",
      equipment: "barbell",
      primaryMuscles: ["chest"],
      instructions: ["My instructions"],
      category: "powerlifting",
    });

    const { getCachedLibrary, loadExerciseLibrary } = await import("@/lib/exercises");
    const overridden = await loadExerciseLibrary();
    expect(overridden).toHaveLength(1);
    expect(overridden[0]).toEqual(
      expect.objectContaining({
        name: "Bench Press",
        custom: true,
        sourceName: "Bench Press",
        level: "expert",
        instructions: ["My instructions"],
      })
    );

    deleteCustomExercise("Bench Press");
    expect(getCachedLibrary()[0]).toEqual(
      expect.objectContaining({
        name: "Bench Press",
        level: "beginner",
        instructions: ["Bundled instructions"],
      })
    );
    expect(getCachedLibrary()[0].custom).toBeUndefined();
  });
});

describe("exercise video URLs", () => {
  it("turns a curated video into an editable YouTube URL", async () => {
    const { getExerciseVideoUrl } = await import("@/lib/exercise-videos");
    expect(getExerciseVideoUrl("Bench Press")).toBe(
      "https://www.youtube.com/watch?v=2KTA9fLY2PU"
    );
  });

  it("keeps a custom video URL exactly as entered", async () => {
    addCustomExercise({
      name: "Pool sprint",
      defaultUnit: "time",
      videoUrl: "https://youtu.be/qIyuxNyZ0NQ",
    });
    const { getExerciseVideoUrl } = await import("@/lib/exercise-videos");
    expect(getExerciseVideoUrl("Pool sprint")).toBe("https://youtu.be/qIyuxNyZ0NQ");
  });
});
