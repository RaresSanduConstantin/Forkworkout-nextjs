import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateWorkout, suggestStartingWeightKg } from "@/lib/workout-generator";
import type { LibraryExercise } from "@/lib/exercises";
import { resolveHomeEquipment } from "@/lib/storage/home-equipment";

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
