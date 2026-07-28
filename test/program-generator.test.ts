import { describe, expect, it } from "vitest";

import { planProgramDays } from "@/lib/program-generator";

describe("program day planning", () => {
  it("builds the familiar three-day push/pull/legs split", () => {
    const days = planProgramDays(
      ["chest", "triceps", "lats", "biceps", "quads", "hamstrings", "abs"],
      3
    );
    expect(days.map((day) => day.title)).toEqual(["Push", "Pull", "Legs & Core"]);
    expect(days[0].targetMuscles).toEqual(["chest", "triceps"]);
    expect(days[1].targetMuscles).toEqual(["lats", "biceps"]);
    expect(days[2].targetMuscles).toEqual(["quads", "hamstrings", "abs"]);
  });

  it("keeps every requested day usable for narrow muscle selections", () => {
    const days = planProgramDays(["chest"], 4);
    expect(days).toHaveLength(4);
    expect(days.every((day) => day.targetMuscles.length > 0)).toBe(true);
  });

  it("clamps program length to two through six days", () => {
    expect(planProgramDays(["chest"], 1)).toHaveLength(2);
    expect(planProgramDays(["chest"], 10)).toHaveLength(6);
  });
});
