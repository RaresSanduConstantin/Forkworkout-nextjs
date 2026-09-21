import type {
  NutritionFood,
  StoredNutritionUsdaFoods,
} from "@/lib/nutrition/types";
import { STORAGE_KEYS } from "./keys";
import { normalizeNutritionFood } from "./nutrition-food-storage";
import { readJson, writeJson } from "./safe-storage";

export const MAX_CACHED_USDA_FOODS = 100;

function validFdcId(value: string): boolean {
  return /^\d{1,12}$/.test(value);
}

export function getCachedNutritionUsdaFoods(): NutritionFood[] {
  const stored = readJson<unknown>(STORAGE_KEYS.nutritionUsdaFoods, null);
  const raw =
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as StoredNutritionUsdaFoods).data)
      ? (stored as StoredNutritionUsdaFoods).data
      : Array.isArray(stored)
        ? stored
        : [];
  const unique = new Map<string, NutritionFood>();
  for (const candidate of raw) {
    const food = normalizeNutritionFood(candidate, "usda");
    if (!food || !validFdcId(food.id)) continue;
    const existing = unique.get(food.id);
    if (!existing || (food.updatedAt ?? "") > (existing.updatedAt ?? "")) {
      unique.set(food.id, food);
    }
  }
  return Array.from(unique.values())
    .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""))
    .slice(0, MAX_CACHED_USDA_FOODS);
}

export function saveCachedNutritionUsdaFoods(foods: NutritionFood[]): boolean {
  const unique = new Map<string, NutritionFood>();
  for (const candidate of foods) {
    const food = normalizeNutritionFood(candidate, "usda");
    if (food && validFdcId(food.id)) unique.set(food.id, food);
  }
  const data = Array.from(unique.values())
    .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""))
    .slice(0, MAX_CACHED_USDA_FOODS);
  return writeJson<StoredNutritionUsdaFoods>(STORAGE_KEYS.nutritionUsdaFoods, {
    version: 1,
    data,
  });
}

export function cacheNutritionUsdaFood(food: NutritionFood): NutritionFood | null {
  const normalized = normalizeNutritionFood(food, "usda");
  if (!normalized || !validFdcId(normalized.id)) return null;
  const foods = getCachedNutritionUsdaFoods();
  const existing = foods.find((candidate) => candidate.id === normalized.id);
  const now = new Date().toISOString();
  const cached = {
    ...normalized,
    createdAt: existing?.createdAt ?? normalized.createdAt ?? now,
    updatedAt: now,
  };
  return saveCachedNutritionUsdaFoods([
    cached,
    ...foods.filter((candidate) => candidate.id !== cached.id),
  ])
    ? cached
    : null;
}
