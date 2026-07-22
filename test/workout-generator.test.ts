import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateWorkout, suggestStartingWeightKg } from "@/lib/workout-generator";
import { getExerciseStableId, type LibraryExercise } from "@/lib/exercises";
import { resolveHomeEquipment } from "@/lib/storage/home-equipment";
import { estimateWorkoutSeconds } from "@/lib/workout";

const dir = path.dirname(fileURLToPath(import.meta.url));

let library: LibraryExercise[];
let byName: Map<string, LibraryExercise>;

beforeAll(() => {
  const json = JSON.parse(
    readFileSync(path.join(dir, "..", "public", "json", "exercises.json"), "utf8")
  );
  library = json.exercises as LibraryExercise[];
  byName = new Map(library.map((e) => [e.name.toLowerCase(), e]));
});

const base = {
  equipment: "gym" as const,
  experience: "intermediate" as const,
  minutes: 30,
  sex: "male" as const,
  historyWeightKg: () => null,
};

const workingSets = (sets: { type?: string }[]) => sets.filter((s) => s.type !== "warmup");
const libOf = (name: string) => byName.get(name.toLowerCase())!;

describe("generateWorkout — targeting", () => {
  it("only picks exercises that hit the chosen muscle as a primary mover", () => {
    const w = generateWorkout(library, { ...base, targetMuscles: ["triceps"], goal: "muscle" });
    expect(w.exercises.length).toBeGreaterThan(0);
    for (const ex of w.exercises) {
      const primaries = libOf(ex.name).primaryMuscles.map((m) => m.toLowerCase());
      expect(primaries).toContain("triceps");
    }
  });

  it("selects oblique-specific exercises separately from rectus-ab exercises", () => {
    const w = generateWorkout(library, {
      ...base,
      targetMuscles: ["obliques"],
      goal: "muscle",
    });
    expect(w.exercises.length).toBeGreaterThan(0);
    for (const exercise of w.exercises) {
      expect(libOf(exercise.name).primaryMuscles).toContain("obliques");
    }
    expect(libOf("Russian Twist").primaryMuscles).toContain("obliques");
    expect(libOf("Crunches").primaryMuscles).toContain("abdominals");
    expect(libOf("Crunches").primaryMuscles).not.toContain("obliques");
  });

  it("covers each selected muscle across the workout", () => {
    const w = generateWorkout(library, {
      ...base,
      targetMuscles: ["biceps", "forearms"],
      goal: "muscle",
    });
    const hits = new Set<string>();
    for (const ex of w.exercises) {
      for (const m of libOf(ex.name).primaryMuscles) hits.add(m.toLowerCase());
    }
    expect(hits.has("biceps")).toBe(true);
    expect(hits.has("forearms")).toBe(true);
  });

  it("returns no exercises when nothing is targeted", () => {
    const w = generateWorkout(library, { ...base, targetMuscles: [] });
    expect(w.exercises).toHaveLength(0);
  });
});

describe("generateWorkout — goal schemes", () => {
  it("strength uses 5 reps and a long rest", () => {
    const w = generateWorkout(library, { ...base, targetMuscles: ["chest"], goal: "strength" });
    expect(w.rest).toBe("150");
    expect(workingSets(w.exercises[0].sets)[0].reps).toBe(5);
  });

  it("fat loss uses 15 reps and a short rest", () => {
    const w = generateWorkout(library, { ...base, targetMuscles: ["chest"], goal: "fatloss" });
    expect(w.rest).toBe("40");
    expect(workingSets(w.exercises[0].sets)[0].reps).toBe(15);
  });
});

describe("generateWorkout — warm-up + ordering", () => {
  it("adds a warm-up to the first (compound) lift for strength", () => {
    const w = generateWorkout(library, { ...base, targetMuscles: ["chest"], goal: "strength" });
    const first = w.exercises[0];
    const bodyweight = (libOf(first.name).equipment ?? "body only").toLowerCase() === "body only";
    if (!bodyweight) {
      expect(first.sets.some((s) => s.type === "warmup")).toBe(true);
    }
  });

  it("orders compounds before isolations", () => {
    const w = generateWorkout(library, {
      ...base,
      targetMuscles: ["chest", "triceps"],
      goal: "muscle",
    });
    const mechanics = w.exercises.map((ex) => libOf(ex.name).mechanic);
    const lastCompound = mechanics.lastIndexOf("compound");
    const firstIsolation = mechanics.findIndex((m) => m === "isolation");
    if (lastCompound !== -1 && firstIsolation !== -1) {
      expect(lastCompound).toBeLessThan(firstIsolation);
    }
  });
});

describe("generateWorkout — weights", () => {
  it("prefers a known history weight for weighted lifts", () => {
    const w = generateWorkout(library, {
      ...base,
      targetMuscles: ["chest"],
      goal: "muscle",
      historyWeightKg: (n) => (n ? 42.5 : null),
    });
    const weighted = w.exercises.find(
      (ex) => (libOf(ex.name).equipment ?? "body only").toLowerCase() !== "body only"
    );
    if (weighted) {
      expect(workingSets(weighted.sets)[0].value).toBe("42.5");
    }
  });

  it("caps loads to owned home equipment and only uses body-only + that gear", () => {
    const home = resolveHomeEquipment({ owned: ["dumbbells"], dumbbellMaxKg: 8 });
    const w = generateWorkout(library, {
      ...base,
      equipment: "home",
      homeEquipment: home,
      targetMuscles: ["chest"],
      goal: "muscle",
      historyWeightKg: () => 40, // way over the 8kg cap
    });
    expect(w.exercises.length).toBeGreaterThan(0);
    for (const ex of w.exercises) {
      const eq = (libOf(ex.name).equipment ?? "body only").toLowerCase();
      expect(["body only", "none", "dumbbell", "e-z curl bar"]).toContain(eq);
      for (const s of ex.sets) {
        if (s.unit === "kg") expect(Number(s.value)).toBeLessThanOrEqual(8);
      }
    }
  });

  it("only produces bodyweight work when useWeights is false", () => {
    const w = generateWorkout(library, {
      ...base,
      targetMuscles: ["chest"],
      goal: "muscle",
      useWeights: false,
    });
    for (const ex of w.exercises) {
      expect((libOf(ex.name).equipment ?? "body only").toLowerCase()).toBe("body only");
    }
  });
});

describe("generateWorkout — pull-up bar gate", () => {
  const BAR_RE = /pull-?up|chin-?up|muscle-?up|hanging/i;

  it("excludes bar-requiring moves at home without a pull-up bar", () => {
    const home = resolveHomeEquipment({ owned: [] });
    const w = generateWorkout(library, {
      ...base,
      equipment: "home",
      homeEquipment: home,
      targetMuscles: ["lats"],
      goal: "muscle",
    });
    for (const ex of w.exercises) expect(BAR_RE.test(ex.name)).toBe(false);
  });

  it("allows pull-ups once a pull-up bar is owned", () => {
    const home = resolveHomeEquipment({ owned: ["pullupBar"] });
    const w = generateWorkout(library, {
      ...base,
      equipment: "home",
      homeEquipment: home,
      targetMuscles: ["lats"],
      goal: "muscle",
    });
    expect(w.exercises.some((ex) => BAR_RE.test(ex.name))).toBe(true);
  });
});

describe("generateWorkout — variants", () => {
  it("different seeds yield different selections when the pool is large", () => {
    const opts = { ...base, targetMuscles: ["chest", "triceps"], goal: "muscle" as const };
    const a = generateWorkout(library, opts, 0).exercises.map((e) => e.name).join("|");
    const b = generateWorkout(library, opts, 3).exercises.map((e) => e.name).join("|");
    expect(a).not.toBe(b);
  });
});

describe("generateWorkout — exercise preferences", () => {
  it("excludes an avoided exercise when alternatives exist", () => {
    const initial = generateWorkout(library, {
      ...base,
      targetMuscles: ["chest"],
      goal: "muscle",
    });
    const avoidedName = initial.exercises[0].name;
    const avoided = libOf(avoidedName);
    const next = generateWorkout(library, {
      ...base,
      targetMuscles: ["chest"],
      goal: "muscle",
      preferences: [
        {
          exerciseId: getExerciseStableId(avoided),
          exerciseName: avoidedName,
          level: "avoid",
          reason: "discomfort",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(next.exercises.length).toBeGreaterThan(0);
    expect(next.exercises.map((exercise) => exercise.name)).not.toContain(avoidedName);
  });

  it("shows a preferred exercise more often while retaining a variety seed", () => {
    const fixture: LibraryExercise[] = ["Alpha", "Beta", "Delta", "Epsilon", "Gamma", "Zulu"].map(
      (name) => ({
        name,
        force: "push",
        level: "beginner",
        mechanic: "isolation",
        equipment: "dumbbell",
        primaryMuscles: ["chest"],
        secondaryMuscles: [],
        instructions: [],
        category: "strength",
      })
    );
    const zuluId = getExerciseStableId(fixture.at(-1)!);
    const countZulu = (preferred: boolean) =>
      Array.from({ length: 6 }, (_, seed) =>
        generateWorkout(
          fixture,
          {
            ...base,
            minutes: 5,
            targetMuscles: ["chest"],
            preferences: preferred
              ? [
                  {
                    exerciseId: zuluId,
                    exerciseName: "Zulu",
                    level: "prefer" as const,
                    updatedAt: "2026-01-01T00:00:00.000Z",
                  },
                ]
              : [],
          },
          seed
        ).exercises.some((exercise) => exercise.name === "Zulu")
      ).filter(Boolean).length;

    expect(countZulu(true)).toBeGreaterThan(countZulu(false));
    expect(countZulu(true)).toBeLessThan(6);
  });
});

describe("generateWorkout — daily readiness", () => {
  const firstWorkingSetCount = (readiness: "great" | "normal" | "tired" | "very-tired") => {
    const workout = generateWorkout(library, {
      ...base,
      targetMuscles: ["chest"],
      goal: "fitness",
      readiness,
    });
    return workingSets(workout.exercises[0].sets).length;
  };

  it("changes working-set volume predictably", () => {
    expect(firstWorkingSetCount("great")).toBe(4);
    expect(firstWorkingSetCount("normal")).toBe(3);
    expect(firstWorkingSetCount("tired")).toBe(2);
    expect(firstWorkingSetCount("very-tired")).toBe(1);
  });

  it("reduces sore-muscle volume without excluding the muscle", () => {
    const workout = generateWorkout(library, {
      ...base,
      targetMuscles: ["chest"],
      goal: "fitness",
      readiness: "normal",
      soreMuscles: ["chest"],
    });
    expect(workout.exercises.length).toBeGreaterThan(0);
    expect(workingSets(workout.exercises[0].sets)).toHaveLength(2);
  });

  it("does not directly train a muscle marked Avoid today", () => {
    const workout = generateWorkout(library, {
      ...base,
      targetMuscles: ["chest", "triceps"],
      goal: "fitness",
      avoidMuscles: ["chest"],
    });
    expect(workout.exercises.length).toBeGreaterThan(0);
    for (const generated of workout.exercises) {
      expect(libOf(generated.name).primaryMuscles.map((muscle) => muscle.toLowerCase())).not.toContain(
        "chest"
      );
    }
  });
});

describe("generateWorkout — intentional strategies", () => {
  const strategyLibrary: LibraryExercise[] = [
    ...["History Barbell Press", "History Incline Press"].map((name) => ({
      name,
      force: "push",
      level: "beginner",
      mechanic: "compound",
      equipment: "barbell",
      primaryMuscles: ["chest"],
      secondaryMuscles: ["triceps"],
      instructions: [],
      category: "strength",
    } as LibraryExercise)),
    ...["Machine Fly", "Cable Fly", "Dumbbell Fly", "Machine Press"].map((name) => ({
      name,
      force: "push",
      level: "beginner",
      mechanic: "isolation",
      equipment: name.startsWith("Machine") ? "machine" : name.startsWith("Cable") ? "cable" : "dumbbell",
      primaryMuscles: ["chest"],
      secondaryMuscles: [],
      instructions: [],
      category: "strength",
    } as LibraryExercise)),
  ];

  const generateStrategy = (strategy: "balanced" | "progressive" | "low-fatigue", seed: number) =>
    generateWorkout(
      strategyLibrary,
      {
        ...base,
        minutes: 5,
        targetMuscles: ["chest"],
        goal: "fitness",
        strategy,
        historyWeightKg: (name) => (name.startsWith("History") ? 40 : null),
      },
      seed
    );

  it("stores the selected strategy and its summary on the workout", () => {
    const workout = generateStrategy("progressive", 1);
    expect(workout.strategy).toBe("progressive");
    expect(workout.recommendationSummary).toContain("performance history");
  });

  it("progressive favors useful history while low-fatigue favors stable isolation", () => {
    const progressive = generateStrategy("progressive", 1);
    const lowFatigue = generateStrategy("low-fatigue", 2);
    const progressiveHistory = progressive.exercises.filter((item) =>
      item.name.startsWith("History")
    ).length;
    const lowFatigueHistory = lowFatigue.exercises.filter((item) =>
      item.name.startsWith("History")
    ).length;
    expect(progressiveHistory).toBeGreaterThan(lowFatigueHistory);
    expect(
      lowFatigue.exercises.every(
        (item) => strategyLibrary.find((exercise) => exercise.name === item.name)?.mechanic === "isolation"
      )
    ).toBe(true);
  });

  it("low-fatigue uses fewer working sets", () => {
    const balanced = generateStrategy("balanced", 0);
    const lowFatigue = generateStrategy("low-fatigue", 2);
    expect(workingSets(lowFatigue.exercises[0].sets).length).toBeLessThan(
      workingSets(balanced.exercises[0].sets).length
    );
  });
});

describe("generateWorkout — movement composition and time budget", () => {
  it("limits reviewed duplicate movement patterns", () => {
    const fixture: LibraryExercise[] = [
      ...["Press A", "Press B", "Press C"].map((name) => ({
        name,
        force: "push",
        level: "beginner",
        mechanic: "isolation",
        equipment: "machine",
        primaryMuscles: ["chest"],
        secondaryMuscles: [],
        instructions: [],
        category: "strength",
        movementPattern: "horizontal-push" as const,
      })),
      ...["Fly A", "Fly B", "Fly C"].map((name) => ({
        name,
        force: "push",
        level: "beginner",
        mechanic: "isolation",
        equipment: "cable",
        primaryMuscles: ["chest"],
        secondaryMuscles: [],
        instructions: [],
        category: "strength",
        movementPattern: "shoulder-isolation" as const,
      })),
    ];
    const workout = generateWorkout(fixture, {
      ...base,
      minutes: 15,
      targetMuscles: ["chest"],
      strategy: "low-fatigue",
      goal: "fitness",
    });
    const patterns = workout.exercises.map(
      (item) => fixture.find((exercise) => exercise.name === item.name)?.movementPattern
    );
    expect(patterns.filter((pattern) => pattern === "horizontal-push")).toHaveLength(1);
    expect(patterns.filter((pattern) => pattern === "shoulder-isolation")).toHaveLength(1);
  });

  for (const minutes of [15, 30, 45, 60]) {
    it(`keeps a ${minutes}-minute fitness workout under the 10% upper tolerance`, () => {
      const workout = generateWorkout(library, {
        ...base,
        minutes,
        targetMuscles: ["chest", "lats", "quads"],
        strategy: "balanced",
        goal: "fitness",
      });
      expect(workout.exercises.length).toBeGreaterThan(0);
      const estimated = estimateWorkoutSeconds(workout.exercises, workout.rest);
      expect(estimated).toBeLessThanOrEqual(minutes * 60 * 1.1);
      expect(estimated).toBeGreaterThanOrEqual(minutes * 60 * 0.9);
    });
  }
});

describe("suggestStartingWeightKg", () => {
  it("scales down for female and up for advanced experience", () => {
    const bench = library.find(
      (e) => e.name.toLowerCase().includes("bench press") && e.mechanic === "compound"
    )!;
    const male = suggestStartingWeightKg(bench, {
      experience: "intermediate",
      sex: "male",
      bodyweightKg: 80,
    });
    const female = suggestStartingWeightKg(bench, {
      experience: "intermediate",
      sex: "female",
      bodyweightKg: 80,
    });
    const advanced = suggestStartingWeightKg(bench, {
      experience: "advanced",
      sex: "male",
      bodyweightKg: 80,
    });
    expect(female).toBeLessThan(male);
    expect(advanced).toBeGreaterThan(male);
    expect(male % 2.5).toBe(0); // rounded to 2.5kg
  });
});
