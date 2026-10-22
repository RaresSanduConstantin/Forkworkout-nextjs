import type { NutritionEntry, NutritionFood, NutritionFoodPreference } from "./types";
import { normalizeNutritionFood, nutritionFoodKey } from "@/lib/storage/nutrition-food-storage";

/** Recover used products from log snapshots, including products evicted from caches. */
export function nutritionLibraryFoods(
  foods: NutritionFood[],
  entries: NutritionEntry[],
  preferences: NutritionFoodPreference[]
): NutritionFood[] {
  const personalKeys = new Set(
    preferences
      .filter((preference) => preference.favourite || preference.useCount > 0)
      .map((preference) => preference.foodKey)
  );
  const library = new Map<string, NutritionFood>();
  for (const entry of [...entries].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))) {
    const snapshot = entry.foodSnapshot;
    if (!snapshot) continue;
    const food = normalizeNutritionFood({
      ...snapshot,
      id: snapshot.foodId ?? `logged-${entry.id}`,
      aliases: [],
      source: snapshot.source === "meal_photo" || snapshot.source === "label_ocr"
        ? "custom"
        : snapshot.source,
    });
    if (food) library.set(nutritionFoodKey(food), food);
  }
  for (const food of foods) {
    const key = nutritionFoodKey(food);
    if (food.source !== "builtin" || personalKeys.has(key) || library.has(key)) {
      library.set(key, food);
    }
  }
  return Array.from(library.values());
}
