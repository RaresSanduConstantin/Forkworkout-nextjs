import { describe, it, expect } from "vitest";

import {
  MUSCLE_GROUPS,
  MUSCLE_TARGETS,
  TARGET_BY_KEY,
  targetsForGroup,
  libMusclesForTargets,
  matchesEquipment,
  allowsLevel,
  groupsForExercise,
  type LibraryExercise,
} from "@/lib/exercises";

function ex(partial: Partial<LibraryExercise>): LibraryExercise {
  return {
    name: "X",
    force: null,
    level: "beginner",
    mechanic: "compound",
    equipment: "barbell",
    primaryMuscles: [],
    secondaryMuscles: [],
    instructions: [],
    category: "strength",
    ...partial,
  };
}

describe("muscle targets", () => {
  it("every target belongs to a valid coarse group", () => {
    for (const t of MUSCLE_TARGETS) expect(MUSCLE_GROUPS).toContain(t.group);
  });

  it("targetsForGroup returns only that group's muscles", () => {
    const arms = targetsForGroup("Arms");
    expect(arms).toEqual(expect.arrayContaining(["biceps", "triceps", "forearms"]));
    expect(arms.every((k) => TARGET_BY_KEY.get(k)?.group === "Arms")).toBe(true);
  });

  it("libMusclesForTargets unions the library muscle names (lowercased)", () => {
    const s = libMusclesForTargets(["lats", "quads"]);
    expect(s.has("lats")).toBe(true);
    expect(s.has("middle back")).toBe(true);
    expect(s.has("quadriceps")).toBe(true);
    expect(s.has("chest")).toBe(false);
  });
});

describe("matchesEquipment", () => {
  it("gym allows everything", () => {
    expect(matchesEquipment(ex({ equipment: "barbell" }), "gym")).toBe(true);
  });

  it("none allows only body-only", () => {
    expect(matchesEquipment(ex({ equipment: "body only" }), "none")).toBe(true);
    expect(matchesEquipment(ex({ equipment: "dumbbell" }), "none")).toBe(false);
  });

  it("home allows body-only plus home equipment, not barbell", () => {
    expect(matchesEquipment(ex({ equipment: "dumbbell" }), "home")).toBe(true);
    expect(matchesEquipment(ex({ equipment: "body only" }), "home")).toBe(true);
    expect(matchesEquipment(ex({ equipment: "barbell" }), "home")).toBe(false);
  });
});

describe("allowsLevel", () => {
  it("beginner only allows beginner", () => {
    expect(allowsLevel("beginner", "beginner")).toBe(true);
    expect(allowsLevel("intermediate", "beginner")).toBe(false);
  });

  it("intermediate allows beginner + intermediate", () => {
    expect(allowsLevel("intermediate", "intermediate")).toBe(true);
    expect(allowsLevel("expert", "intermediate")).toBe(false);
  });

  it("advanced allows everything", () => {
    expect(allowsLevel("expert", "advanced")).toBe(true);
  });
});

describe("groupsForExercise", () => {
  it("maps primary muscles to coarse groups", () => {
    expect(groupsForExercise(ex({ primaryMuscles: ["triceps"] }))).toEqual(["Arms"]);
    expect(groupsForExercise(ex({ primaryMuscles: ["quadriceps", "chest"] })).sort()).toEqual([
      "Chest",
      "Legs",
    ]);
  });
});
