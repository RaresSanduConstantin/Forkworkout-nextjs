import { describe, expect, it } from "vitest";

import { buildShareFile, parseShareFile, safeShareFilename } from "@/lib/sharing/file";

describe("ForkWorkout share files", () => {
  it("round-trips a portable reference", () => {
    const reference = { kind: "program" as const, encoded: "program-payload" };
    expect(parseShareFile(buildShareFile(reference))).toEqual(reference);
  });

  it("accepts a portable nutrition meal reference", () => {
    const reference = { kind: "nutrition-meal" as const, encoded: "meal-payload" };
    expect(parseShareFile(buildShareFile(reference))).toEqual(reference);
  });

  it("does not confuse backups or malformed JSON with share files", () => {
    expect(parseShareFile('{"version":1,"workouts":[]}')).toBeNull();
    expect(parseShareFile("broken")).toBeNull();
  });

  it("creates a safe extension and filename", () => {
    expect(safeShareFilename("My Push/Pull Plan! ")).toBe(
      "my-push-pull-plan.forkworkout"
    );
  });
});
