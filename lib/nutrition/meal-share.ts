import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { v4 as uuidv4 } from "uuid";

import type {
  NutritionEntry,
  NutritionSavedMeal,
  NutritionSavedMealItem,
} from "@/lib/nutrition/types";
import { normalizeNutritionSavedMeal } from "@/lib/storage/nutrition-meal-storage";

const MAX_ENCODED_LENGTH = 8_000;
const MAX_MESSAGE_LENGTH = 280;

type NutritionMealSharePayload = {
  v: 1;
  name: string;
  msg?: string;
  items: NutritionSavedMealItem[];
  kind?: "recipe";
  servings?: number;
  yieldGrams?: number;
  description?: string;
  instructions?: string[];
  prepMinutes?: number;
};

export type DecodedNutritionMealShare = {
  meal: NutritionSavedMeal;
  message?: string;
};

export function mealItemsFromEntries(entries: NutritionEntry[]): NutritionSavedMealItem[] {
  return entries.map((entry) => ({
    name: entry.name,
    source: entry.source,
    nutrients: entry.nutrients,
    quantity: entry.quantity,
    foodSnapshot: entry.foodSnapshot,
    confidence: entry.confidence,
  }));
}

export function encodeNutritionMeal(
  name: string,
  items: NutritionSavedMealItem[],
  message?: string,
  maxEncodedLength = MAX_ENCODED_LENGTH,
  recipe?: Pick<
    NutritionSavedMeal,
    "kind" | "servings" | "yieldGrams" | "description" | "instructions" | "prepMinutes"
  >
): string | null {
  const payload: NutritionMealSharePayload = {
    v: 1,
    name: name.trim().slice(0, 120) || "Shared meal",
    msg: message?.trim().slice(0, MAX_MESSAGE_LENGTH) || undefined,
    items,
    kind: recipe?.kind,
    servings: recipe?.servings,
    yieldGrams: recipe?.yieldGrams,
    description: recipe?.description,
    instructions: recipe?.instructions,
    prepMinutes: recipe?.prepMinutes,
  };
  const encoded = compressToEncodedURIComponent(JSON.stringify(payload));
  return encoded.length <= maxEncodedLength ? encoded : null;
}

export function decodeNutritionMeal(encoded: string): DecodedNutritionMealShare | null {
  let raw: unknown;
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1 || !Array.isArray(payload.items)) return null;
  const now = new Date().toISOString();
  const meal = normalizeNutritionSavedMeal({
    id: uuidv4(),
    name: payload.name,
    items: payload.items,
    kind: payload.kind,
    servings: payload.servings,
    yieldGrams: payload.yieldGrams,
    description: payload.description,
    instructions: payload.instructions,
    prepMinutes: payload.prepMinutes,
    createdAt: now,
    updatedAt: now,
  });
  if (!meal) return null;
  const message =
    typeof payload.msg === "string" && payload.msg.trim()
      ? payload.msg.trim().slice(0, MAX_MESSAGE_LENGTH)
      : undefined;
  return { meal, message };
}

export function buildNutritionMealShareUrl(
  name: string,
  items: NutritionSavedMealItem[],
  origin: string,
  message?: string
): string | null {
  const encoded = encodeNutritionMeal(name, items, message);
  return encoded
    ? `${origin.replace(/\/$/, "")}/nutrition#importMeal=${encoded}`
    : null;
}
