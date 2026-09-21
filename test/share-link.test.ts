import { describe, expect, it } from "vitest";

import {
  buildSharedImportUrl,
  extractSharedImport,
} from "@/lib/storage/share-link";

describe("shared import links", () => {
  it("extracts workout, program, and meal payloads from links or surrounding text", () => {
    expect(extractSharedImport("https://forkworkout.test/app#import=workout-token")).toEqual({
      kind: "workout",
      encoded: "workout-token",
    });
    expect(
      extractSharedImport(
        "Try this routine: https://forkworkout.test/app#importProgram=program-token"
      )
    ).toEqual({ kind: "program", encoded: "program-token" });
    expect(
      extractSharedImport(
        "Try this meal: https://forkworkout.test/nutrition#importMeal=meal-token"
      )
    ).toEqual({ kind: "nutrition-meal", encoded: "meal-token" });
  });

  it("accepts a URL encoded by an operating-system share target", () => {
    const encoded = encodeURIComponent(
      "https://forkworkout.test/app#import=encoded-workout"
    );
    expect(extractSharedImport(encoded)).toEqual({
      kind: "workout",
      encoded: "encoded-workout",
    });
  });

  it("rejects unrelated text and rebuilds a canonical app link", () => {
    expect(extractSharedImport("ordinary message")).toBeNull();
    expect(
      buildSharedImportUrl(
        { kind: "program", encoded: "abc123" },
        "https://forkworkout.test/"
      )
    ).toBe("https://forkworkout.test/app#importProgram=abc123");
    expect(
      buildSharedImportUrl(
        { kind: "nutrition-meal", encoded: "meal123" },
        "https://forkworkout.test/"
      )
    ).toBe("https://forkworkout.test/nutrition#importMeal=meal123");
  });
});
