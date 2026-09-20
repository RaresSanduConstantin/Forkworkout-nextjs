import type { NutritionFood, NutritionFoodPreference } from "./types";
import {
  getCustomNutritionFoods,
  normalizeNutritionFood,
  nutritionFoodKey,
} from "@/lib/storage/nutrition-food-storage";
import { getCachedNutritionBarcodeProducts } from "@/lib/storage/nutrition-barcode-storage";

type BundledFoodCatalog = {
  version: number;
  foods: unknown[];
};

let bundledCache: NutritionFood[] | null = null;
let inflight: Promise<NutritionFood[]> | null = null;

function withLocalFoods(bundled: NutritionFood[]): NutritionFood[] {
  return [
    ...getCustomNutritionFoods(),
    ...getCachedNutritionBarcodeProducts(),
    ...bundled,
  ];
}

export function normalizeFoodSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function loadNutritionFoods(): Promise<NutritionFood[]> {
  if (bundledCache) return Promise.resolve(withLocalFoods(bundledCache));
  if (!inflight) {
    inflight = fetch("/json/foods.json")
      .then((response) => {
        if (!response.ok) throw new Error("Food catalog unavailable");
        return response.json() as Promise<BundledFoodCatalog>;
      })
      .then((catalog) => {
        bundledCache = Array.isArray(catalog.foods)
          ? catalog.foods
              .map((food) => normalizeNutritionFood(food, "builtin"))
              .filter((food): food is NutritionFood => food !== null)
          : [];
        return withLocalFoods(bundledCache);
      })
      .catch(() => {
        bundledCache = [];
        return withLocalFoods(bundledCache);
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function refreshNutritionFoods(): Promise<NutritionFood[]> {
  if (bundledCache) return Promise.resolve(withLocalFoods(bundledCache));
  return loadNutritionFoods();
}

export function filterAndRankNutritionFoods(
  foods: NutritionFood[],
  preferences: NutritionFoodPreference[],
  query: string
): NutritionFood[] {
  const preferenceByKey = new Map(
    preferences.map((preference) => [preference.foodKey, preference])
  );
  const normalizedQuery = normalizeFoodSearchText(query);
  const terms = normalizedQuery.split(" ").filter(Boolean);
  return foods
    .filter((food) => {
      if (terms.length === 0) return true;
      const searchable = normalizeFoodSearchText(
        [food.name, food.variant, ...food.aliases].filter(Boolean).join(" ")
      );
      return terms.every((term) => searchable.includes(term));
    })
    .sort((left, right) => {
      const leftPreference = preferenceByKey.get(nutritionFoodKey(left));
      const rightPreference = preferenceByKey.get(nutritionFoodKey(right));
      if (leftPreference?.favourite !== rightPreference?.favourite) {
        return leftPreference?.favourite ? -1 : 1;
      }
      const recency = (rightPreference?.lastUsedAt ?? "").localeCompare(
        leftPreference?.lastUsedAt ?? ""
      );
      if (recency !== 0) return recency;
      const frequency = (rightPreference?.useCount ?? 0) - (leftPreference?.useCount ?? 0);
      if (frequency !== 0) return frequency;
      if (left.aliases.length !== right.aliases.length) {
        return right.aliases.length - left.aliases.length;
      }
      return `${left.name} ${left.variant ?? ""}`.localeCompare(
        `${right.name} ${right.variant ?? ""}`
      );
    });
}
