import { v4 as uuidv4 } from "uuid";

import { nutrientsForQuantity } from "@/lib/nutrition/calculations";
import type {
  NutritionEntry,
  NutritionMeal,
  NutritionSavedMeal,
  NutritionSavedMealItem,
  StoredNutritionSavedMeals,
} from "@/lib/nutrition/types";
import { STORAGE_KEYS } from "./keys";
import {
  getNutritionEntries,
  normalizeNutritionEntry,
  saveNutritionEntries,
} from "./nutrition-storage";
import { readJson, writeJson } from "./safe-storage";

export type NutritionCopyResult = {
  added: number;
  skipped: number;
  saved: boolean;
};

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizeSavedMealItem(raw: unknown): NutritionSavedMealItem | null {
  if (!raw || typeof raw !== "object") return null;
  const normalized = normalizeNutritionEntry({
    ...(raw as Record<string, unknown>),
    id: "saved-meal-item",
    dayKey: "2000-01-01",
    meal: "breakfast",
    createdAt: "2000-01-01T00:00:00.000Z",
    updatedAt: "2000-01-01T00:00:00.000Z",
  });
  if (!normalized) return null;
  return {
    name: normalized.name,
    source: normalized.source,
    nutrients: normalized.nutrients,
    quantity: normalized.quantity,
    foodSnapshot: normalized.foodSnapshot,
    confidence: normalized.confidence,
  };
}

export function normalizeNutritionSavedMeal(raw: unknown): NutritionSavedMeal | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 120) : "";
  const createdAt = normalizeDate(value.createdAt);
  const updatedAt = normalizeDate(value.updatedAt) ?? createdAt;
  const items = Array.isArray(value.items)
    ? value.items
        .map(normalizeSavedMealItem)
        .filter((item): item is NutritionSavedMealItem => item !== null)
        .slice(0, 100)
    : [];
  if (!id || !name || !createdAt || !updatedAt || items.length === 0) return null;
  const kind = value.kind === "recipe" ? "recipe" : undefined;
  const rawServings =
    typeof value.servings === "number" ? value.servings : Number(value.servings);
  const servings =
    kind === "recipe" &&
    Number.isFinite(rawServings) &&
    rawServings > 0 &&
    rawServings <= 1_000
      ? rawServings
      : undefined;
  const rawYieldGrams =
    typeof value.yieldGrams === "number" ? value.yieldGrams : Number(value.yieldGrams);
  const yieldGrams =
    kind === "recipe" &&
    Number.isFinite(rawYieldGrams) &&
    rawYieldGrams > 0 &&
    rawYieldGrams <= 1_000_000
      ? rawYieldGrams
      : undefined;
  const description =
    typeof value.description === "string"
      ? value.description.trim().slice(0, 500) || undefined
      : undefined;
  const instructions = Array.isArray(value.instructions)
    ? value.instructions
        .map((instruction) =>
          typeof instruction === "string" ? instruction.trim().slice(0, 240) : ""
        )
        .filter(Boolean)
        .slice(0, 20)
    : undefined;
  const rawPrepMinutes =
    typeof value.prepMinutes === "number"
      ? value.prepMinutes
      : Number(value.prepMinutes);
  const prepMinutes =
    Number.isFinite(rawPrepMinutes) && rawPrepMinutes >= 0 && rawPrepMinutes <= 1_440
      ? Math.round(rawPrepMinutes)
      : undefined;
  return {
    id,
    name,
    items,
    kind,
    servings,
    yieldGrams,
    description,
    instructions: instructions?.length ? instructions : undefined,
    prepMinutes,
    createdAt,
    updatedAt,
  };
}

export function getNutritionSavedMeals(): NutritionSavedMeal[] {
  const stored = readJson<unknown>(STORAGE_KEYS.nutritionSavedMeals, null);
  const raw =
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as StoredNutritionSavedMeals).data)
      ? (stored as StoredNutritionSavedMeals).data
      : Array.isArray(stored)
        ? stored
        : [];
  return raw
    .map(normalizeNutritionSavedMeal)
    .filter((meal): meal is NutritionSavedMeal => meal !== null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function saveNutritionSavedMeals(meals: NutritionSavedMeal[]): boolean {
  const unique = new Map<string, NutritionSavedMeal>();
  for (const candidate of meals) {
    const meal = normalizeNutritionSavedMeal(candidate);
    if (meal) unique.set(meal.id, meal);
  }
  return writeJson<StoredNutritionSavedMeals>(STORAGE_KEYS.nutritionSavedMeals, {
    version: 1,
    data: Array.from(unique.values()),
  });
}

export function saveMealFromEntries(
  name: string,
  entries: NutritionEntry[],
  id?: string
): NutritionSavedMeal | null {
  return saveMealFromItems(
    name,
    entries.map((entry) => ({
      name: entry.name,
      source: entry.source,
      nutrients: entry.nutrients,
      quantity: entry.quantity,
      foodSnapshot: entry.foodSnapshot,
      confidence: entry.confidence,
    })),
    id
  );
}

export function saveMealFromItems(
  name: string,
  items: NutritionSavedMealItem[],
  id?: string,
  options?: {
    kind?: "recipe";
    servings?: number;
    yieldGrams?: number;
    description?: string;
    instructions?: string[];
    prepMinutes?: number;
  }
): NutritionSavedMeal | null {
  const trimmedName = name.trim().slice(0, 120);
  if (!trimmedName || items.length === 0) return null;
  const meals = getNutritionSavedMeals();
  const existing = id ? meals.find((meal) => meal.id === id) : undefined;
  const duplicate = meals.some(
    (meal) => meal.id !== id && meal.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase()
  );
  if (duplicate) return null;
  const now = new Date().toISOString();
  const meal = normalizeNutritionSavedMeal({
    id: existing?.id ?? id ?? uuidv4(),
    name: trimmedName,
    items,
    kind: options?.kind,
    servings: options?.servings,
    yieldGrams: options?.yieldGrams,
    description: options?.description,
    instructions: options?.instructions,
    prepMinutes: options?.prepMinutes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  if (!meal) return null;
  const next = existing
    ? meals.map((candidate) => (candidate.id === meal.id ? meal : candidate))
    : [meal, ...meals];
  return saveNutritionSavedMeals(next) ? meal : null;
}

export function deleteNutritionSavedMeal(id: string): boolean {
  const meals = getNutritionSavedMeals();
  const next = meals.filter((meal) => meal.id !== id);
  return next.length !== meals.length && saveNutritionSavedMeals(next);
}

/** Imports a shared meal with a fresh id and a non-conflicting local name. */
export function importNutritionSavedMeal(
  candidate: NutritionSavedMeal
): NutritionSavedMeal | null {
  const normalized = normalizeNutritionSavedMeal(candidate);
  if (!normalized) return null;
  const meals = getNutritionSavedMeals();
  const existingNames = new Set(meals.map((meal) => meal.name.toLocaleLowerCase()));
  const baseName = normalized.name;
  let name = baseName;
  let suffix = 2;
  while (existingNames.has(name.toLocaleLowerCase())) {
    name = `${baseName} (${suffix})`.slice(0, 120);
    suffix += 1;
  }
  const now = new Date().toISOString();
  const imported = normalizeNutritionSavedMeal({
    ...normalized,
    id: uuidv4(),
    name,
    createdAt: now,
    updatedAt: now,
  });
  if (!imported) return null;
  return saveNutritionSavedMeals([imported, ...meals]) ? imported : null;
}

function entrySignature(
  entry: Pick<NutritionEntry, "meal" | "name" | "source" | "nutrients" | "quantity" | "foodSnapshot">
): string {
  return JSON.stringify({
    meal: entry.meal,
    name: entry.name,
    source: entry.source,
    foodId: entry.foodSnapshot?.foodId,
    quantity: entry.quantity,
    nutrients: entry.nutrients,
  });
}

export function copyNutritionItemsToDay(
  items: NutritionSavedMealItem[],
  dayKey: string,
  meal: NutritionMeal,
  multiplier = 1,
  options?: { allowDuplicates?: boolean }
): NutritionCopyResult {
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 100) {
    return { added: 0, skipped: 0, saved: false };
  }
  const entries = getNutritionEntries();
  const existingSignatureCounts = new Map<string, number>();
  for (const entry of entries.filter((candidate) => candidate.dayKey === dayKey)) {
    const signature = entrySignature(entry);
    existingSignatureCounts.set(signature, (existingSignatureCounts.get(signature) ?? 0) + 1);
  }
  const sourceSignatureCounts = new Map<string, number>();
  const now = new Date().toISOString();
  const additions: NutritionEntry[] = [];
  let skipped = 0;
  for (const item of items) {
    const nutrients = nutrientsForQuantity(item.nutrients, multiplier, 1);
    const candidate = normalizeNutritionEntry({
      ...item,
      nutrients,
      quantity: item.quantity
        ? { ...item.quantity, amount: item.quantity.amount * multiplier }
        : undefined,
      id: uuidv4(),
      dayKey,
      meal,
      createdAt: now,
      updatedAt: now,
    });
    if (!candidate) {
      skipped += 1;
      continue;
    }
    const signature = entrySignature(candidate);
    const sourceOccurrence = (sourceSignatureCounts.get(signature) ?? 0) + 1;
    sourceSignatureCounts.set(signature, sourceOccurrence);
    if (
      !options?.allowDuplicates &&
      (existingSignatureCounts.get(signature) ?? 0) >= sourceOccurrence
    ) {
      skipped += 1;
      continue;
    }
    additions.push(candidate);
  }
  if (additions.length === 0) {
    return { added: 0, skipped, saved: true };
  }
  const saved = saveNutritionEntries([...entries, ...additions]);
  return { added: saved ? additions.length : 0, skipped, saved };
}

export function copyNutritionEntriesToDay(
  sourceEntries: NutritionEntry[],
  dayKey: string,
  destinationMeal?: NutritionMeal
): NutritionCopyResult {
  const grouped = new Map<NutritionMeal, NutritionSavedMealItem[]>();
  for (const entry of sourceEntries) {
    const meal = destinationMeal ?? entry.meal;
    const items = grouped.get(meal) ?? [];
    items.push({
      name: entry.name,
      source: entry.source,
      nutrients: entry.nutrients,
      quantity: entry.quantity,
      foodSnapshot: entry.foodSnapshot,
    });
    grouped.set(meal, items);
  }
  let added = 0;
  let skipped = 0;
  for (const [meal, items] of grouped) {
    const result = copyNutritionItemsToDay(items, dayKey, meal);
    if (!result.saved) return { added, skipped, saved: false };
    added += result.added;
    skipped += result.skipped;
  }
  return { added, skipped, saved: true };
}
