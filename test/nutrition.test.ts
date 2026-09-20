// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  nutrientProgress,
  nutrientsForQuantity,
  sumNutrients,
  workoutCaloriesForDay,
} from "@/lib/nutrition/calculations";
import { buildExport, mergeImport } from "@/lib/storage/transfer";
import {
  addNutritionEntry,
  deleteNutritionEntry,
  getNutritionDayAdjustments,
  getNutritionEntries,
  getNutritionEntriesForDay,
  getNutritionTargets,
  saveNutritionTargets,
  setNutritionWorkoutCaloriesIncluded,
  updateNutritionEntry,
} from "@/lib/storage/nutrition-storage";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import foodCatalog from "@/public/json/foods.json";
import {
  filterAndRankNutritionFoods,
  normalizeFoodSearchText,
} from "@/lib/nutrition/foods";
import {
  deleteCustomNutritionFood,
  getCustomNutritionFoods,
  getNutritionFoodPreferences,
  normalizeNutritionFood,
  nutritionFoodKey,
  recordNutritionFoodUse,
  setNutritionFoodFavourite,
  upsertCustomNutritionFood,
} from "@/lib/storage/nutrition-food-storage";

beforeEach(() => localStorage.clear());

const quickAdd = {
  dayKey: "2026-09-20",
  meal: "breakfast" as const,
  name: "Morning coffee",
  nutrients: { caloriesKcal: 80, proteinG: 2, carbsG: 10, fatG: 3 },
};

describe("nutrition calculations", () => {
  it("sums and rounds consumed nutrients", () => {
    expect(
      sumNutrients([
        quickAdd.nutrients,
        { caloriesKcal: 120.25, proteinG: 5.25, carbsG: 15.25, fatG: 4.25 },
      ])
    ).toEqual({ caloriesKcal: 200.3, proteinG: 7.3, carbsG: 25.3, fatG: 7.3 });
  });

  it("scales per-100g nutrition without deriving calories from macros", () => {
    expect(
      nutrientsForQuantity(
        { caloriesKcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, sodiumMg: 74 },
        150
      )
    ).toEqual({
      caloriesKcal: 247.5,
      proteinG: 46.5,
      carbsG: 0,
      fatG: 5.4,
      fibreG: undefined,
      sugarG: undefined,
      sodiumMg: 111,
    });
  });

  it("clamps displayed progress while retaining over-target totals", () => {
    expect(nutrientProgress(120, 100)).toBe(100);
    expect(nutrientProgress(40, 100)).toBe(40);
    expect(nutrientProgress(40)).toBe(0);
  });

  it("treats workout calories as a day-level informational total", () => {
    expect(
      workoutCaloriesForDay(
        [
          { workoutId: "a", title: "A", date: "2026-09-20T08:00:00.000Z", dayKey: "2026-09-20", calories: 240 },
          { workoutId: "b", title: "B", date: "2026-09-20T17:00:00.000Z", dayKey: "2026-09-20", calories: 110 },
          { workoutId: "c", title: "C", date: "2026-09-19T08:00:00.000Z", dayKey: "2026-09-19", calories: 500 },
        ],
        "2026-09-20"
      )
    ).toBe(350);
  });
});

describe("nutrition storage", () => {
  it("adds, updates, moves, and deletes a quick entry", () => {
    const created = addNutritionEntry(quickAdd);
    expect(created).not.toBeNull();
    expect(getNutritionEntriesForDay("2026-09-20")).toHaveLength(1);

    const updated = updateNutritionEntry(created!.id, {
      ...quickAdd,
      meal: "snacks",
      name: "Coffee with milk",
      nutrients: { ...quickAdd.nutrients, caloriesKcal: 95 },
    });
    expect(updated).toEqual(
      expect.objectContaining({ meal: "snacks", name: "Coffee with milk" })
    );
    expect(updated?.nutrients.caloriesKcal).toBe(95);

    expect(deleteNutritionEntry(created!.id)).toBe(true);
    expect(getNutritionEntries()).toEqual([]);
  });

  it("skips corrupted entries instead of crashing", () => {
    localStorage.setItem(
      STORAGE_KEYS.nutritionEntries,
      JSON.stringify({
        version: 1,
        data: [
          { ...quickAdd, id: "bad-date", dayKey: "2026-02-31", createdAt: "bad" },
          {
            ...quickAdd,
            id: "valid",
            source: "quick_add",
            createdAt: "2026-09-20T08:00:00.000Z",
            updatedAt: "2026-09-20T08:00:00.000Z",
          },
        ],
      })
    );

    expect(getNutritionEntries().map((entry) => entry.id)).toEqual(["valid"]);
  });

  it("round-trips manual targets and rejects invalid targets", () => {
    expect(
      saveNutritionTargets({ caloriesKcal: 2300, proteinG: 160, carbsG: 250, fatG: 70 })
    ).toEqual(expect.objectContaining({ caloriesKcal: 2300, proteinG: 160 }));
    expect(getNutritionTargets()).toEqual(
      expect.objectContaining({ caloriesKcal: 2300, proteinG: 160, carbsG: 250, fatG: 70 })
    );
    expect(
      saveNutritionTargets({ caloriesKcal: 0, proteinG: 160, carbsG: 250, fatG: 70 })
    ).toBeNull();
  });

  it("remembers and removes a per-day workout calorie adjustment", () => {
    expect(setNutritionWorkoutCaloriesIncluded("2026-09-20", true)).toBe(true);
    expect(getNutritionDayAdjustments()).toEqual([
      expect.objectContaining({
        dayKey: "2026-09-20",
        includeWorkoutCalories: true,
      }),
    ]);

    expect(setNutritionWorkoutCaloriesIncluded("2026-09-20", false)).toBe(true);
    expect(getNutritionDayAdjustments()).toEqual([]);
    expect(setNutritionWorkoutCaloriesIncluded("not-a-day", true)).toBe(false);
  });

  it("includes nutrition entries and targets in backup recovery", () => {
    const created = addNutritionEntry(quickAdd);
    saveNutritionTargets({ caloriesKcal: 2200, proteinG: 150, carbsG: 240, fatG: 65 });
    setNutritionWorkoutCaloriesIncluded("2026-09-20", true);
    const customFood = upsertCustomNutritionFood({
      name: "Backup food",
      aliases: [],
      basisAmount: 100,
      basisUnit: "g",
      nutrients: { caloriesKcal: 123, proteinG: 4, carbsG: 5, fatG: 6 },
    })!;
    setNutritionFoodFavourite(nutritionFoodKey(customFood), true);
    const bundle = buildExport();

    localStorage.clear();
    const result = mergeImport(JSON.stringify(bundle), {
      restoreSettings: true,
      restoreNutritionData: true,
    });

    expect(result.nutritionEntriesAdded).toBe(1);
    expect(result.nutritionTargetsRestored).toBe(true);
    expect(result.nutritionDayAdjustmentsRestored).toBe(1);
    expect(result.customNutritionFoodsAdded).toBe(1);
    expect(result.nutritionFoodPreferencesRestored).toBe(1);
    expect(getNutritionEntries()[0].id).toBe(created?.id);
    expect(getNutritionTargets()?.caloriesKcal).toBe(2200);
    expect(getNutritionDayAdjustments()[0]?.dayKey).toBe("2026-09-20");
    expect(getCustomNutritionFoods()[0]?.name).toBe("Backup food");
  });

  it("restores an edited nutrition entry when recovering a backup", () => {
    const created = addNutritionEntry(quickAdd)!;
    const bundle = buildExport();
    updateNutritionEntry(created.id, {
      ...quickAdd,
      name: "Changed locally",
      nutrients: { ...quickAdd.nutrients, caloriesKcal: 999 },
    });

    const result = mergeImport(JSON.stringify(bundle), { restoreNutritionData: true });

    expect(result.nutritionEntriesUpdated).toBe(1);
    expect(getNutritionEntries()[0].name).toBe("Morning coffee");
    expect(getNutritionEntries()[0].nutrients.caloriesKcal).toBe(80);
  });
});

describe("nutrition food catalog", () => {
  it("ships a valid offline starter catalog with raw and cooked variants", () => {
    const foods = foodCatalog.foods
      .map((food) => normalizeNutritionFood(food, "builtin"))
      .filter((food) => food !== null);

    expect(foods).toHaveLength(foodCatalog.foods.length);
    expect(foods.length).toBeGreaterThanOrEqual(30);
    expect(
      foods.filter((food) => food?.name === "White rice").map((food) => food?.variant)
    ).toEqual(expect.arrayContaining(["Dry, uncooked", "Cooked"]));
  });

  it("matches Romanian aliases without requiring diacritics", () => {
    const foods = foodCatalog.foods
      .map((food) => normalizeNutritionFood(food, "builtin"))
      .filter((food): food is NonNullable<typeof food> => food !== null);

    expect(normalizeFoodSearchText("PÂINE integrală")).toBe("paine integrala");
    expect(filterAndRankNutritionFoods(foods, [], "cartofi copti")[0]?.name).toBe(
      "Potato"
    );
  });

  it("creates, updates, favourites, remembers, and deletes a custom food", () => {
    const food = upsertCustomNutritionFood({
      name: "Protein pancakes",
      aliases: ["clatite proteice"],
      basisAmount: 100,
      basisUnit: "g",
      nutrients: { caloriesKcal: 210, proteinG: 18, carbsG: 22, fatG: 6 },
    });
    expect(food).not.toBeNull();
    const key = nutritionFoodKey(food!);
    expect(setNutritionFoodFavourite(key, true)).toBe(true);
    expect(recordNutritionFoodUse(key)).toBe(true);
    expect(getNutritionFoodPreferences()).toEqual([
      expect.objectContaining({ foodKey: key, favourite: true, useCount: 1 }),
    ]);

    const validUpdate = upsertCustomNutritionFood(
      {
        name: "Protein oat pancakes",
        aliases: food!.aliases,
        basisAmount: 100,
        basisUnit: "g",
        nutrients: { ...food!.nutrients, caloriesKcal: 220 },
      },
      food!.id
    );
    expect(validUpdate?.nutrients.caloriesKcal).toBe(220);
    expect(getCustomNutritionFoods()[0]?.name).toBe("Protein oat pancakes");
    expect(deleteCustomNutritionFood(food!.id)).toBe(true);
    expect(getCustomNutritionFoods()).toEqual([]);
    expect(getNutritionFoodPreferences()).toEqual([]);
  });
});
