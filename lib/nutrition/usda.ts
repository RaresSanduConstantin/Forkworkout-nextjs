import type { NutritionFood } from "@/lib/nutrition/types";
import { normalizeNutritionFood } from "@/lib/storage/nutrition-food-storage";

type NutrientValue = {
  id?: number;
  name: string;
  unit: string;
  value: number;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNonNegative(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function nutrientsFrom(raw: unknown): NutrientValue[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const value = candidate as Record<string, unknown>;
    const nested =
      value.nutrient && typeof value.nutrient === "object"
        ? (value.nutrient as Record<string, unknown>)
        : {};
    const amount = finiteNonNegative(value.value ?? value.amount);
    if (amount === undefined) return [];
    const idValue = value.nutrientId ?? nested.id;
    const id = Number.isFinite(Number(idValue)) ? Number(idValue) : undefined;
    return [
      {
        id,
        name: text(value.nutrientName ?? nested.name).toLocaleLowerCase(),
        unit: text(value.unitName ?? nested.unitName).toLocaleLowerCase(),
        value: amount,
      },
    ];
  });
}

function nutrientValue(
  nutrients: NutrientValue[],
  ids: number[],
  names: string[]
): NutrientValue | undefined {
  for (const id of ids) {
    const match = nutrients.find((nutrient) => nutrient.id === id);
    if (match) return match;
  }
  return nutrients.find((nutrient) =>
    names.some((name) => nutrient.name === name || nutrient.name.includes(name))
  );
}

/** Converts an FDC search result into ForkWorkout's per-100g food contract. */
export function normalizeUsdaSearchFood(raw: unknown): NutritionFood | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const fdcId = Number(value.fdcId);
  const name = text(value.description);
  if (!Number.isInteger(fdcId) || fdcId <= 0 || !name) return null;

  const nutrients = nutrientsFrom(value.foodNutrients);
  const energy = nutrientValue(nutrients, [1008, 2047, 2048], ["energy"]);
  const protein = nutrientValue(nutrients, [1003], ["protein"]);
  const carbs = nutrientValue(
    nutrients,
    [1005],
    ["carbohydrate, by difference", "carbohydrate"]
  );
  const fat = nutrientValue(nutrients, [1004], ["total lipid", "total fat"]);
  if (!energy || !protein || !carbs || !fat) return null;

  const caloriesKcal = energy.unit.includes("kj") ? energy.value / 4.184 : energy.value;
  const fibre = nutrientValue(nutrients, [1079], ["fiber, total dietary", "fibre"]);
  const sugar = nutrientValue(nutrients, [2000], ["sugars, total", "total sugars"]);
  const sodium = nutrientValue(nutrients, [1093], ["sodium"]);
  const aliases = [text(value.additionalDescriptions), text(value.scientificName)].filter(
    Boolean
  );

  return normalizeNutritionFood(
    {
      id: String(fdcId),
      name,
      aliases,
      basisAmount: 100,
      basisUnit: "g",
      nutrients: {
        caloriesKcal,
        proteinG: protein.value,
        carbsG: carbs.value,
        fatG: fat.value,
        fibreG: fibre?.value,
        sugarG: sugar?.value,
        sodiumMg:
          sodium === undefined
            ? undefined
            : sodium.unit.includes("g") && !sodium.unit.includes("mg")
              ? sodium.value * 1000
              : sodium.value,
      },
      source: "usda",
      sourceReference: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${fdcId}/nutrients`,
    },
    "usda"
  );
}

export type OnlineFoodSearchSources = {
  usda: "ok" | "not_configured" | "unavailable";
  openFoodFacts: "ok" | "unavailable";
};

export type OnlineFoodSearchResult = {
  foods: NutritionFood[];
  sources: OnlineFoodSearchSources;
};

function sourceStatus(
  value: unknown,
  allowed: readonly string[],
  fallback: string
): string {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

export async function searchOnlineFoods(
  query: string,
  signal?: AbortSignal
): Promise<OnlineFoodSearchResult> {
  const term = query.trim().slice(0, 120);
  if (term.length < 2) {
    return {
      foods: [],
      sources: { usda: "unavailable", openFoodFacts: "unavailable" },
    };
  }
  const response = await fetch(`/api/nutrition/search?q=${encodeURIComponent(term)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  const body = (await response.json().catch(() => null)) as
    | { foods?: unknown; message?: unknown; sources?: unknown }
    | null;
  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Online food search is unavailable right now."
    );
  }
  const rawSources =
    body && "sources" in body && body.sources && typeof body.sources === "object"
      ? (body.sources as Record<string, unknown>)
      : {};
  const sources: OnlineFoodSearchSources = {
    usda: sourceStatus(
      rawSources.usda,
      ["ok", "not_configured", "unavailable"],
      "unavailable"
    ) as OnlineFoodSearchSources["usda"],
    openFoodFacts: sourceStatus(
      rawSources.openFoodFacts,
      ["ok", "unavailable"],
      "unavailable"
    ) as OnlineFoodSearchSources["openFoodFacts"],
  };
  const foods = Array.isArray(body?.foods)
    ? body.foods
        .map((food) => normalizeNutritionFood(food))
        .filter(
          (food): food is NutritionFood =>
            food !== null && (food.source === "usda" || food.source === "barcode")
        )
    : [];
  return { foods, sources };
}
