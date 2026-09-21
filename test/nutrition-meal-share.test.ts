// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  buildNutritionMealShareUrl,
  decodeNutritionMeal,
  encodeNutritionMeal,
} from "@/lib/nutrition/meal-share";
import { extractSharedImport } from "@/lib/storage/share-link";
import {
  getNutritionSavedMeals,
  importNutritionSavedMeal,
} from "@/lib/storage/nutrition-meal-storage";

const items = [
  {
    name: "Eggs",
    source: "builtin" as const,
    quantity: { amount: 100, unit: "g" as const },
    nutrients: { caloriesKcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5 },
  },
  {
    name: "Bread",
    source: "custom" as const,
    quantity: { amount: 40, unit: "g" as const },
    nutrients: { caloriesKcal: 98, proteinG: 3.6, carbsG: 18, fatG: 1.2 },
  },
];

beforeEach(() => localStorage.clear());

describe("nutrition meal sharing", () => {
  it("round-trips selected meal items and an optional message with fresh ids", () => {
    const encoded = encodeNutritionMeal("Breakfast · Sep 21", items, "Try this");
    expect(encoded).not.toBeNull();
    const first = decodeNutritionMeal(encoded!);
    const second = decodeNutritionMeal(encoded!);

    expect(first?.meal.name).toBe("Breakfast · Sep 21");
    expect(first?.meal.items).toEqual(items);
    expect(first?.message).toBe("Try this");
    expect(first?.meal.id).not.toBe(second?.meal.id);
  });

  it("builds a nutrition import link understood by the shared-link parser", () => {
    const url = buildNutritionMealShareUrl(
      "Breakfast",
      items,
      "https://forkworkout.test/"
    );
    expect(url).toContain("https://forkworkout.test/nutrition#importMeal=");
    const reference = extractSharedImport(url);
    expect(reference?.kind).toBe("nutrition-meal");
    expect(decodeNutritionMeal(reference!.encoded)?.meal.items).toHaveLength(2);
  });

  it("imports shared meals with a new id and a unique local name", () => {
    const decoded = decodeNutritionMeal(encodeNutritionMeal("Breakfast", items)!)!;
    const first = importNutritionSavedMeal(decoded.meal);
    const second = importNutritionSavedMeal(decoded.meal);

    expect(first?.name).toBe("Breakfast");
    expect(second?.name).toBe("Breakfast (2)");
    expect(second?.id).not.toBe(first?.id);
    expect(getNutritionSavedMeals()).toHaveLength(2);
  });

  it("rejects malformed or empty payloads", () => {
    expect(decodeNutritionMeal("not-a-meal")).toBeNull();
    expect(encodeNutritionMeal("Empty", [])).not.toBeNull();
    expect(decodeNutritionMeal(encodeNutritionMeal("Empty", [])!)).toBeNull();
  });
});
