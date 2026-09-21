import { v4 as uuidv4 } from "uuid";

import type {
  NutritionFood,
  NutritionFoodPreference,
  StoredCustomNutritionFoods,
  StoredNutritionFoodPreferences,
} from "@/lib/nutrition/types";
import { STORAGE_KEYS } from "./keys";
import { normalizeNutritionNutrients } from "./nutrition-storage";
import { readJson, writeJson } from "./safe-storage";

const MAX_USE_COUNT = 1_000_000;

function normalizedDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export function nutritionFoodKey(food: Pick<NutritionFood, "id" | "source">): string {
  return `${food.source}:${food.id}`;
}

export function normalizeNutritionFood(
  raw: unknown,
  expectedSource?: NutritionFood["source"]
): NutritionFood | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id.trim().slice(0, 120) : "";
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 160) : "";
  const source = value.source;
  const basisAmount = Number(value.basisAmount);
  const basisUnit = value.basisUnit;
  const nutrients = normalizeNutritionNutrients(value.nutrients);
  if (
    !id ||
    !name ||
    (source !== "builtin" &&
      source !== "usda" &&
      source !== "custom" &&
      source !== "barcode") ||
    (expectedSource && source !== expectedSource) ||
    !Number.isFinite(basisAmount) ||
    basisAmount <= 0 ||
    basisAmount > 10_000 ||
    (basisUnit !== "g" && basisUnit !== "ml") ||
    !nutrients
  ) {
    return null;
  }
  const aliases = Array.isArray(value.aliases)
    ? Array.from(
        new Set(
          value.aliases
            .filter((alias): alias is string => typeof alias === "string")
            .map((alias) => alias.trim().slice(0, 120))
            .filter(Boolean)
        )
      ).slice(0, 20)
    : [];
  return {
    id,
    name,
    aliases,
    brand:
      typeof value.brand === "string" && value.brand.trim()
        ? value.brand.trim().slice(0, 120)
        : undefined,
    variant:
      typeof value.variant === "string" && value.variant.trim()
        ? value.variant.trim().slice(0, 120)
        : undefined,
    basisAmount,
    basisUnit,
    nutrients,
    source,
    sourceReference:
      typeof value.sourceReference === "string" && value.sourceReference.trim()
        ? value.sourceReference.trim().slice(0, 500)
        : undefined,
    createdAt: normalizedDate(value.createdAt),
    updatedAt: normalizedDate(value.updatedAt),
  };
}

export function getCustomNutritionFoods(): NutritionFood[] {
  const stored = readJson<unknown>(STORAGE_KEYS.customNutritionFoods, null);
  const raw =
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as StoredCustomNutritionFoods).data)
      ? (stored as StoredCustomNutritionFoods).data
      : Array.isArray(stored)
        ? stored
        : [];
  return raw
    .map((food) => normalizeNutritionFood(food, "custom"))
    .filter((food): food is NutritionFood => food !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function saveCustomNutritionFoods(foods: NutritionFood[]): boolean {
  const unique = new Map<string, NutritionFood>();
  for (const candidate of foods) {
    const food = normalizeNutritionFood(candidate, "custom");
    if (food) unique.set(food.id, food);
  }
  return writeJson<StoredCustomNutritionFoods>(STORAGE_KEYS.customNutritionFoods, {
    version: 1,
    data: Array.from(unique.values()),
  });
}

export function upsertCustomNutritionFood(
  input: Omit<NutritionFood, "id" | "source" | "createdAt" | "updatedAt">,
  id?: string
): NutritionFood | null {
  const foods = getCustomNutritionFoods();
  const existing = id ? foods.find((food) => food.id === id) : undefined;
  const now = new Date().toISOString();
  const food = normalizeNutritionFood(
    {
      ...input,
      id: existing?.id ?? id ?? uuidv4(),
      source: "custom",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
    "custom"
  );
  if (!food) return null;
  const duplicate = foods.some(
    (candidate) =>
      candidate.id !== food.id &&
      candidate.name.toLocaleLowerCase() === food.name.toLocaleLowerCase() &&
      (candidate.variant ?? "").toLocaleLowerCase() ===
        (food.variant ?? "").toLocaleLowerCase()
  );
  if (duplicate) return null;
  const next = existing
    ? foods.map((candidate) => (candidate.id === food.id ? food : candidate))
    : [...foods, food];
  return saveCustomNutritionFoods(next) ? food : null;
}

export function deleteCustomNutritionFood(id: string): boolean {
  const foods = getCustomNutritionFoods();
  const food = foods.find((candidate) => candidate.id === id);
  const next = foods.filter((food) => food.id !== id);
  if (!food || !saveCustomNutritionFoods(next)) return false;
  const key = nutritionFoodKey(food);
  saveNutritionFoodPreferences(
    getNutritionFoodPreferences().filter((preference) => preference.foodKey !== key)
  );
  return true;
}

export function normalizeNutritionFoodPreference(raw: unknown): NutritionFoodPreference | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const foodKey = typeof value.foodKey === "string" ? value.foodKey.trim().slice(0, 260) : "";
  const useCount = Number(value.useCount);
  const updatedAt = normalizedDate(value.updatedAt);
  const lastUsedAt = normalizedDate(value.lastUsedAt);
  if (
    !foodKey ||
    !Number.isInteger(useCount) ||
    useCount < 0 ||
    useCount > MAX_USE_COUNT ||
    !updatedAt
  ) {
    return null;
  }
  return {
    foodKey,
    favourite: value.favourite === true,
    useCount,
    lastUsedAt,
    updatedAt,
  };
}

export function getNutritionFoodPreferences(): NutritionFoodPreference[] {
  const stored = readJson<unknown>(STORAGE_KEYS.nutritionFoodPreferences, null);
  const raw =
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as StoredNutritionFoodPreferences).data)
      ? (stored as StoredNutritionFoodPreferences).data
      : Array.isArray(stored)
        ? stored
        : [];
  const unique = new Map<string, NutritionFoodPreference>();
  for (const candidate of raw) {
    const preference = normalizeNutritionFoodPreference(candidate);
    if (!preference) continue;
    const existing = unique.get(preference.foodKey);
    if (!existing || preference.updatedAt > existing.updatedAt) {
      unique.set(preference.foodKey, preference);
    }
  }
  return Array.from(unique.values());
}

export function saveNutritionFoodPreferences(
  preferences: NutritionFoodPreference[]
): boolean {
  const unique = new Map<string, NutritionFoodPreference>();
  for (const candidate of preferences) {
    const preference = normalizeNutritionFoodPreference(candidate);
    if (preference) unique.set(preference.foodKey, preference);
  }
  return writeJson<StoredNutritionFoodPreferences>(STORAGE_KEYS.nutritionFoodPreferences, {
    version: 1,
    data: Array.from(unique.values()),
  });
}

export function setNutritionFoodFavourite(foodKey: string, favourite: boolean): boolean {
  const preferences = getNutritionFoodPreferences();
  const existing = preferences.find((preference) => preference.foodKey === foodKey);
  const now = new Date().toISOString();
  const next: NutritionFoodPreference = {
    foodKey,
    favourite,
    useCount: existing?.useCount ?? 0,
    lastUsedAt: existing?.lastUsedAt,
    updatedAt: now,
  };
  return saveNutritionFoodPreferences([
    ...preferences.filter((preference) => preference.foodKey !== foodKey),
    next,
  ]);
}

export function recordNutritionFoodUse(foodKey: string): boolean {
  const preferences = getNutritionFoodPreferences();
  const existing = preferences.find((preference) => preference.foodKey === foodKey);
  const now = new Date().toISOString();
  const next: NutritionFoodPreference = {
    foodKey,
    favourite: existing?.favourite ?? false,
    useCount: Math.min(MAX_USE_COUNT, (existing?.useCount ?? 0) + 1),
    lastUsedAt: now,
    updatedAt: now,
  };
  return saveNutritionFoodPreferences([
    ...preferences.filter((preference) => preference.foodKey !== foodKey),
    next,
  ]);
}
