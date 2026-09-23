import { v4 as uuidv4 } from "uuid";

import { dayKeyToDate, toDayKey } from "@/lib/date/day-key";
import {
  NUTRITION_MEALS,
  type NutritionDayAdjustment,
  type NutritionEntry,
  type NutritionEntryInput,
  type NutritionFoodSnapshot,
  type NutritionMeal,
  type NutritionNutrients,
  type NutritionQuantity,
  type NutritionSource,
  type NutritionTargetHistoryEntry,
  type NutritionTargets,
  type StoredNutritionEntries,
  type StoredNutritionDayAdjustments,
  type StoredNutritionTargets,
} from "@/lib/nutrition/types";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

const SOURCES: NutritionSource[] = [
  "quick_add",
  "builtin",
  "usda",
  "custom",
  "barcode",
  "label_ocr",
  "meal_photo",
];
const MAX_CALORIES = 100_000;
const MAX_MACRO_GRAMS = 10_000;

function boundedNumber(value: unknown, max: number): number | null {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(number) && number >= 0 && number <= max ? number : null;
}

function optionalBoundedNumber(value: unknown, max: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return boundedNumber(value, max) ?? undefined;
}

export function normalizeNutritionNutrients(raw: unknown): NutritionNutrients | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const caloriesKcal = boundedNumber(value.caloriesKcal, MAX_CALORIES);
  const proteinG = boundedNumber(value.proteinG, MAX_MACRO_GRAMS);
  const carbsG = boundedNumber(value.carbsG, MAX_MACRO_GRAMS);
  const fatG = boundedNumber(value.fatG, MAX_MACRO_GRAMS);
  if (caloriesKcal === null || proteinG === null || carbsG === null || fatG === null) {
    return null;
  }
  return {
    caloriesKcal,
    proteinG,
    carbsG,
    fatG,
    fibreG: optionalBoundedNumber(value.fibreG, MAX_MACRO_GRAMS),
    sugarG: optionalBoundedNumber(value.sugarG, MAX_MACRO_GRAMS),
    sodiumMg: optionalBoundedNumber(value.sodiumMg, 1_000_000),
  };
}

function normalizeDayKey(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = dayKeyToDate(value);
  return Number.isFinite(date.getTime()) && toDayKey(date) === value ? value : null;
}

export function normalizeNutritionDayAdjustment(
  raw: unknown
): NutritionDayAdjustment | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const dayKey = normalizeDayKey(value.dayKey);
  const updatedAt = normalizeDate(value.updatedAt);
  if (!dayKey || value.includeWorkoutCalories !== true || !updatedAt) return null;
  return { dayKey, includeWorkoutCalories: true, updatedAt };
}

function normalizeQuantity(raw: unknown): NutritionQuantity | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const amount = boundedNumber(value.amount, 1_000_000);
  const unit = value.unit;
  if (amount === null || amount <= 0 || (unit !== "g" && unit !== "ml" && unit !== "serving")) {
    return undefined;
  }
  return { amount, unit };
}

function normalizeFoodSnapshot(raw: unknown): NutritionFoodSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 160) : "";
  const basisAmount = boundedNumber(value.basisAmount, 10_000);
  const basisUnit = value.basisUnit;
  const nutrients = normalizeNutritionNutrients(value.nutrients);
  const source = value.source;
  if (
    !name ||
    basisAmount === null ||
    basisAmount <= 0 ||
    (basisUnit !== "g" && basisUnit !== "ml") ||
    !nutrients ||
    (source !== "builtin" &&
      source !== "usda" &&
      source !== "custom" &&
      source !== "barcode" &&
      source !== "label_ocr" &&
      source !== "meal_photo")
  ) {
    return undefined;
  }
  return {
    foodId: typeof value.foodId === "string" && value.foodId.trim() ? value.foodId.trim() : undefined,
    name,
    brand: typeof value.brand === "string" && value.brand.trim() ? value.brand.trim().slice(0, 120) : undefined,
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
        ? value.sourceReference.trim().slice(0, 240)
        : undefined,
  };
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function normalizeNutritionEntry(raw: unknown): NutritionEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const dayKey = normalizeDayKey(value.dayKey);
  const meal = value.meal as NutritionMeal;
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 160) : "";
  const source = SOURCES.includes(value.source as NutritionSource)
    ? (value.source as NutritionSource)
    : "quick_add";
  const nutrients = normalizeNutritionNutrients(value.nutrients);
  const createdAt = normalizeDate(value.createdAt);
  const updatedAt = normalizeDate(value.updatedAt) ?? createdAt;
  if (
    !id ||
    !dayKey ||
    !NUTRITION_MEALS.includes(meal) ||
    !name ||
    !nutrients ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }
  return {
    id,
    dayKey,
    meal,
    name,
    source,
    nutrients,
    quantity: normalizeQuantity(value.quantity),
    foodSnapshot: normalizeFoodSnapshot(value.foodSnapshot),
    confidence: optionalBoundedNumber(value.confidence, 1),
    createdAt,
    updatedAt,
  };
}

export function getNutritionEntries(): NutritionEntry[] {
  const stored = readJson<unknown>(STORAGE_KEYS.nutritionEntries, null);
  const raw =
    stored && typeof stored === "object" && Array.isArray((stored as StoredNutritionEntries).data)
      ? (stored as StoredNutritionEntries).data
      : Array.isArray(stored)
        ? stored
        : [];
  return raw
    .map(normalizeNutritionEntry)
    .filter((entry): entry is NutritionEntry => entry !== null)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function getNutritionEntriesForDay(dayKey: string): NutritionEntry[] {
  if (!normalizeDayKey(dayKey)) return [];
  return getNutritionEntries().filter((entry) => entry.dayKey === dayKey);
}

export function saveNutritionEntries(entries: NutritionEntry[]): boolean {
  const data = entries
    .map(normalizeNutritionEntry)
    .filter((entry): entry is NutritionEntry => entry !== null);
  return writeJson<StoredNutritionEntries>(STORAGE_KEYS.nutritionEntries, { version: 1, data });
}

export function addNutritionEntry(input: NutritionEntryInput): NutritionEntry | null {
  return addNutritionEntries([input])?.[0] ?? null;
}

/** Adds a confirmed multi-food result in one storage write, avoiding partial meals. */
export function addNutritionEntries(
  inputs: NutritionEntryInput[]
): NutritionEntry[] | null {
  if (inputs.length === 0 || inputs.length > 100) return null;
  const now = new Date().toISOString();
  const created = inputs.map((input) =>
    normalizeNutritionEntry({
      ...input,
      id: uuidv4(),
      source: input.source ?? "quick_add",
      createdAt: now,
      updatedAt: now,
    })
  );
  if (created.some((entry) => entry === null)) return null;
  const all = getNutritionEntries();
  all.push(...(created as NutritionEntry[]));
  return saveNutritionEntries(all) ? (created as NutritionEntry[]) : null;
}

export function updateNutritionEntry(
  id: string,
  input: NutritionEntryInput
): NutritionEntry | null {
  const all = getNutritionEntries();
  const index = all.findIndex((entry) => entry.id === id);
  if (index === -1) return null;
  const replacement = normalizeNutritionEntry({
    ...all[index],
    ...input,
    id: all[index].id,
    createdAt: all[index].createdAt,
    updatedAt: new Date().toISOString(),
  });
  if (!replacement) return null;
  all[index] = replacement;
  return saveNutritionEntries(all) ? replacement : null;
}

export function deleteNutritionEntry(id: string): boolean {
  const all = getNutritionEntries();
  const next = all.filter((entry) => entry.id !== id);
  return next.length !== all.length && saveNutritionEntries(next);
}

export function normalizeNutritionTargets(raw: unknown): NutritionTargets | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const caloriesKcal = boundedNumber(value.caloriesKcal, 20_000);
  const proteinG = boundedNumber(value.proteinG, 2_000);
  const carbsG = boundedNumber(value.carbsG, 2_000);
  const fatG = boundedNumber(value.fatG, 2_000);
  const updatedAt = normalizeDate(value.updatedAt);
  if (
    caloriesKcal === null ||
    caloriesKcal <= 0 ||
    proteinG === null ||
    carbsG === null ||
    fatG === null ||
    !updatedAt
  ) {
    return null;
  }
  const trainingValue =
    value.trainingDay && typeof value.trainingDay === "object"
      ? (value.trainingDay as Record<string, unknown>)
      : null;
  const trainingCalories = trainingValue
    ? boundedNumber(trainingValue.caloriesKcal, 20_000)
    : null;
  const trainingProtein = trainingValue
    ? boundedNumber(trainingValue.proteinG, 2_000)
    : null;
  const trainingCarbs = trainingValue
    ? boundedNumber(trainingValue.carbsG, 2_000)
    : null;
  const trainingFat = trainingValue
    ? boundedNumber(trainingValue.fatG, 2_000)
    : null;
  const trainingDay =
    trainingValue &&
    trainingCalories !== null &&
    trainingCalories > 0 &&
    trainingProtein !== null &&
    trainingCarbs !== null &&
    trainingFat !== null
      ? {
          caloriesKcal: trainingCalories,
          proteinG: trainingProtein,
          carbsG: trainingCarbs,
          fatG: trainingFat,
        }
      : undefined;
  return {
    caloriesKcal,
    proteinG,
    carbsG,
    fatG,
    fibreG: optionalBoundedNumber(value.fibreG, 2_000),
    sodiumMg: optionalBoundedNumber(value.sodiumMg, 1_000_000),
    trainingDay,
    updatedAt,
  };
}

export function getNutritionTargets(): NutritionTargets | null {
  const stored = readJson<unknown>(STORAGE_KEYS.nutritionTargets, null);
  const raw =
    stored && typeof stored === "object" && "data" in stored
      ? (stored as StoredNutritionTargets).data
      : stored;
  return normalizeNutritionTargets(raw);
}

export function normalizeNutritionTargetHistoryEntry(
  raw: unknown
): NutritionTargetHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const targets = normalizeNutritionTargets(value);
  const effectiveFrom = normalizeDayKey(value.effectiveFrom);
  return targets && effectiveFrom ? { ...targets, effectiveFrom } : null;
}

export function getNutritionTargetHistory(): NutritionTargetHistoryEntry[] {
  const stored = readJson<unknown>(STORAGE_KEYS.nutritionTargets, null);
  if (!stored || typeof stored !== "object") return [];
  const history = (stored as StoredNutritionTargets).history;
  if (!Array.isArray(history)) return [];
  const newestByDay = new Map<string, NutritionTargetHistoryEntry>();
  for (const candidate of history) {
    const entry = normalizeNutritionTargetHistoryEntry(candidate);
    if (!entry) continue;
    const existing = newestByDay.get(entry.effectiveFrom);
    if (!existing || entry.updatedAt > existing.updatedAt) {
      newestByDay.set(entry.effectiveFrom, entry);
    }
  }
  return Array.from(newestByDay.values()).sort((left, right) =>
    left.effectiveFrom.localeCompare(right.effectiveFrom)
  );
}

export function getNutritionTargetsForDay(dayKey: string): NutritionTargets | null {
  if (!normalizeDayKey(dayKey)) return null;
  const history = getNutritionTargetHistory();
  if (history.length === 0) return getNutritionTargets();
  const active = [...history]
    .reverse()
    .find((entry) => entry.effectiveFrom <= dayKey);
  if (!active) return null;
  return normalizeNutritionTargets(active);
}

export function saveNutritionTargetHistory(
  history: NutritionTargetHistoryEntry[]
): boolean {
  const current = getNutritionTargets();
  const normalized = history
    .map(normalizeNutritionTargetHistoryEntry)
    .filter((entry): entry is NutritionTargetHistoryEntry => entry !== null);
  const newestByDay = new Map<string, NutritionTargetHistoryEntry>();
  for (const entry of normalized) {
    const existing = newestByDay.get(entry.effectiveFrom);
    if (!existing || entry.updatedAt > existing.updatedAt) {
      newestByDay.set(entry.effectiveFrom, entry);
    }
  }
  return writeJson<StoredNutritionTargets>(STORAGE_KEYS.nutritionTargets, {
    version: 2,
    data: current,
    history: Array.from(newestByDay.values()).sort((left, right) =>
      left.effectiveFrom.localeCompare(right.effectiveFrom)
    ),
  });
}

export function saveNutritionTargets(
  targets: Omit<NutritionTargets, "updatedAt"> | NutritionTargets,
  options?: { effectiveFrom?: string }
): NutritionTargets | null {
  const effectiveFrom = options?.effectiveFrom ?? toDayKey();
  if (!normalizeDayKey(effectiveFrom)) return null;
  const previous = getNutritionTargets();
  const existingHistory = getNutritionTargetHistory();
  const normalized = normalizeNutritionTargets({
    ...targets,
    updatedAt: new Date().toISOString(),
  });
  if (!normalized) return null;
  const history = [...existingHistory];
  if (previous && history.length === 0) {
    history.push({ ...previous, effectiveFrom: "1970-01-01" });
  }
  const nextEntry = { ...normalized, effectiveFrom };
  const nextHistory = [
    ...history.filter((entry) => entry.effectiveFrom !== effectiveFrom),
    nextEntry,
  ].sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
  return writeJson<StoredNutritionTargets>(STORAGE_KEYS.nutritionTargets, {
    version: 2,
    data: normalized,
    history: nextHistory,
  })
    ? normalized
    : null;
}

export function getNutritionDayAdjustments(): NutritionDayAdjustment[] {
  const stored = readJson<unknown>(STORAGE_KEYS.nutritionDayAdjustments, null);
  const raw =
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as StoredNutritionDayAdjustments).data)
      ? (stored as StoredNutritionDayAdjustments).data
      : Array.isArray(stored)
        ? stored
        : [];
  const newestByDay = new Map<string, NutritionDayAdjustment>();
  for (const candidate of raw) {
    const adjustment = normalizeNutritionDayAdjustment(candidate);
    if (!adjustment) continue;
    const existing = newestByDay.get(adjustment.dayKey);
    if (!existing || adjustment.updatedAt > existing.updatedAt) {
      newestByDay.set(adjustment.dayKey, adjustment);
    }
  }
  return Array.from(newestByDay.values()).sort((left, right) =>
    left.dayKey.localeCompare(right.dayKey)
  );
}

export function saveNutritionDayAdjustments(
  adjustments: NutritionDayAdjustment[]
): boolean {
  const newestByDay = new Map<string, NutritionDayAdjustment>();
  for (const candidate of adjustments) {
    const adjustment = normalizeNutritionDayAdjustment(candidate);
    if (!adjustment) continue;
    const existing = newestByDay.get(adjustment.dayKey);
    if (!existing || adjustment.updatedAt > existing.updatedAt) {
      newestByDay.set(adjustment.dayKey, adjustment);
    }
  }
  return writeJson<StoredNutritionDayAdjustments>(STORAGE_KEYS.nutritionDayAdjustments, {
    version: 1,
    data: Array.from(newestByDay.values()),
  });
}

export function setNutritionWorkoutCaloriesIncluded(
  dayKey: string,
  included: boolean
): boolean {
  if (!normalizeDayKey(dayKey)) return false;
  const adjustments = getNutritionDayAdjustments().filter(
    (adjustment) => adjustment.dayKey !== dayKey
  );
  if (included) {
    adjustments.push({
      dayKey,
      includeWorkoutCalories: true,
      updatedAt: new Date().toISOString(),
    });
  }
  return saveNutritionDayAdjustments(adjustments);
}
