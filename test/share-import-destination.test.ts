import { describe, expect, it } from "vitest";

import { getShareImportDestination } from "@/lib/sharing/import-destination";
import { buildShortShareUrl } from "@/lib/sharing/link";
import { buildShareUrl } from "@/lib/storage/share";
import { buildNutritionMealShareUrl } from "@/lib/nutrition/meal-share";
import type { Workout } from "@/lib/types";

const workout: Workout = {
  id: "workout-1",
  title: "QR workout",
  exercises: [
    {
      name: "Squat",
      sets: [{ reps: 8, value: "80", unit: "kg" }],
    },
  ],
};

describe("share import destinations", () => {
  it("canonicalizes a scanned short link onto the current app origin", () => {
    const reference = {
      id: "Ab3xK91pQr5sT7uV",
      key: "A".repeat(43),
    };
    const scanned = buildShortShareUrl(reference, "https://sender.example");

    expect(getShareImportDestination(scanned, "https://receiver.example")).toBe(
      buildShortShareUrl(reference, "https://receiver.example")
    );
  });

  it("accepts a valid legacy workout QR payload", () => {
    const legacy = buildShareUrl(workout, "https://sender.example");
    expect(legacy).not.toBeNull();
    expect(getShareImportDestination(legacy!, "https://receiver.example")).toContain(
      "https://receiver.example/app#import="
    );
  });

  it("routes a valid meal payload to Nutrition", () => {
    const mealUrl = buildNutritionMealShareUrl(
      "Lunch",
      [
        {
          name: "Rice",
          source: "builtin",
          nutrients: { caloriesKcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
        },
      ],
      "https://sender.example"
    );
    expect(getShareImportDestination(mealUrl!, "https://receiver.example")).toContain(
      "https://receiver.example/nutrition#importMeal="
    );
  });

  it("rejects unrelated and malformed QR values", () => {
    expect(getShareImportDestination("https://example.com", "https://receiver.example")).toBeNull();
    expect(
      getShareImportDestination(
        "https://sender.example/app#import=not-a-workout",
        "https://receiver.example"
      )
    ).toBeNull();
  });
});
