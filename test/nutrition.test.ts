// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  nutrientProgress,
  nutrientsForQuantity,
  sumNutrients,
  workoutCaloriesForDay,
} from "@/lib/nutrition/calculations";
import { nutritionProgressSummary } from "@/lib/nutrition/progress";
import { buildExport, mergeImport } from "@/lib/storage/transfer";
import {
  addNutritionEntries,
  addNutritionEntry,
  deleteNutritionEntry,
  getNutritionDayAdjustments,
  getNutritionEntries,
  getNutritionEntriesForDay,
  getNutritionTargets,
  getNutritionTargetHistory,
  getNutritionTargetsForDay,
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
  barcodeDraftToFood,
  barcodeLookupCandidates,
  fetchOpenFoodFactsProduct,
  isValidGtin,
  normalizeBarcode,
  normalizeOpenFoodFactsProduct,
} from "@/lib/nutrition/barcodes";
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
import {
  copyNutritionEntriesToDay,
  copyNutritionItemsToDay,
  deleteNutritionSavedMeal,
  getNutritionSavedMeals,
  saveMealFromEntries,
  saveMealFromItems,
} from "@/lib/storage/nutrition-meal-storage";
import {
  MAX_CACHED_BARCODE_PRODUCTS,
  cacheNutritionBarcodeProduct,
  getCachedNutritionBarcodeProducts,
} from "@/lib/storage/nutrition-barcode-storage";
import {
  cacheNutritionUsdaFood,
  getCachedNutritionUsdaFoods,
} from "@/lib/storage/nutrition-usda-storage";

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

  it("sums optional nutrients while preserving unavailable values", () => {
    expect(
      sumNutrients([
        { ...quickAdd.nutrients, fibreG: 4.25, sugarG: 2, sodiumMg: 101.6 },
        { ...quickAdd.nutrients, fibreG: 1.25, sodiumMg: 50.2 },
      ])
    ).toEqual(
      expect.objectContaining({ fibreG: 5.5, sugarG: 2, sodiumMg: 152 })
    );
    expect(sumNutrients([quickAdd.nutrients]).fibreG).toBeUndefined();
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

  it("scales nutrition entered for a non-100g label serving", () => {
    expect(
      nutrientsForQuantity(
        { caloriesKcal: 160, proteinG: 8, carbsG: 20, fatG: 4 },
        100,
        40
      )
    ).toEqual(
      expect.objectContaining({ caloriesKcal: 400, proteinG: 20, carbsG: 50, fatG: 10 })
    );
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

  it("calculates progress averages from logged days without treating missing days as zero", () => {
    const entries = [
      {
        id: "one",
        ...quickAdd,
        nutrients: { caloriesKcal: 1800, proteinG: 140, carbsG: 180, fatG: 60 },
        source: "quick_add" as const,
        createdAt: "2026-09-20T08:00:00.000Z",
        updatedAt: "2026-09-20T08:00:00.000Z",
      },
      {
        id: "two",
        ...quickAdd,
        dayKey: "2026-09-22",
        nutrients: { caloriesKcal: 2200, proteinG: 160, carbsG: 220, fatG: 70 },
        source: "quick_add" as const,
        createdAt: "2026-09-22T08:00:00.000Z",
        updatedAt: "2026-09-22T08:00:00.000Z",
      },
    ];
    const summary = nutritionProgressSummary(entries, "2026-09-23", 7, () => ({
      caloriesKcal: 2000,
      proteinG: 150,
      carbsG: 200,
      fatG: 65,
      updatedAt: "2026-09-01T00:00:00.000Z",
    }));

    expect(summary.loggedDays).toBe(2);
    expect(summary.average).toEqual(
      expect.objectContaining({ caloriesKcal: 2000, proteinG: 150 })
    );
    expect(summary.calorieRangeDays).toBe(2);
    expect(summary.proteinReachedDays).toBe(1);
  });
});

describe("nutrition storage", () => {
  it("saves a confirmed multi-food photo estimate atomically", () => {
    const saved = addNutritionEntries([
      {
        ...quickAdd,
        name: "Chicken",
        source: "meal_photo",
        quantity: { amount: 180, unit: "g" },
      },
      {
        ...quickAdd,
        name: "Rice",
        source: "meal_photo",
        quantity: { amount: 170, unit: "g" },
      },
    ]);
    expect(saved).toHaveLength(2);
    expect(getNutritionEntries()).toEqual([
      expect.objectContaining({ name: "Chicken", source: "meal_photo" }),
      expect.objectContaining({ name: "Rice", source: "meal_photo" }),
    ]);

    expect(
      addNutritionEntries([
        { ...quickAdd, name: "Valid" },
        { ...quickAdd, name: "", source: "meal_photo" },
      ])
    ).toBeNull();
    expect(getNutritionEntries()).toHaveLength(2);
  });

  it("preserves a per-100g basis for editable photo estimates", () => {
    const saved = addNutritionEntry({
      ...quickAdd,
      name: "Photo pasta",
      source: "meal_photo",
      quantity: { amount: 250, unit: "g" },
      nutrients: { caloriesKcal: 400, proteinG: 15, carbsG: 60, fatG: 10 },
      foodSnapshot: {
        name: "Photo pasta",
        basisAmount: 100,
        basisUnit: "g",
        nutrients: { caloriesKcal: 160, proteinG: 6, carbsG: 24, fatG: 4 },
        source: "meal_photo",
      },
    });

    expect(saved?.foodSnapshot?.source).toBe("meal_photo");
    expect(saved?.foodSnapshot?.nutrients.caloriesKcal).toBe(160);
  });

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
      saveNutritionTargets({
        caloriesKcal: 2300,
        proteinG: 160,
        carbsG: 250,
        fatG: 70,
        fibreG: 30,
        sodiumMg: 2300,
        trainingDay: { caloriesKcal: 2500, proteinG: 165, carbsG: 300, fatG: 70 },
      })
    ).toEqual(
      expect.objectContaining({
        caloriesKcal: 2300,
        proteinG: 160,
        fibreG: 30,
        sodiumMg: 2300,
        trainingDay: expect.objectContaining({ caloriesKcal: 2500 }),
      })
    );
    expect(getNutritionTargets()).toEqual(
      expect.objectContaining({ caloriesKcal: 2300, proteinG: 160, carbsG: 250, fatG: 70 })
    );
    expect(
      saveNutritionTargets({ caloriesKcal: 0, proteinG: 160, carbsG: 250, fatG: 70 })
    ).toBeNull();
  });

  it("retains confidence for AI-derived nutrition entries", () => {
    const saved = addNutritionEntry({
      ...quickAdd,
      source: "label_ocr",
      confidence: 0.94,
      quantity: { amount: 60, unit: "g" },
    });

    expect(saved?.confidence).toBe(0.94);
    expect(getNutritionEntries()[0]?.confidence).toBe(0.94);
  });

  it("keeps effective-dated targets so old nutrition days retain their original goal", () => {
    saveNutritionTargets(
      { caloriesKcal: 2300, proteinG: 160, carbsG: 250, fatG: 70 },
      { effectiveFrom: "2026-09-01" }
    );
    saveNutritionTargets(
      { caloriesKcal: 2000, proteinG: 170, carbsG: 190, fatG: 65 },
      { effectiveFrom: "2026-09-15" }
    );

    expect(getNutritionTargetHistory()).toHaveLength(2);
    expect(getNutritionTargetsForDay("2026-09-10")?.caloriesKcal).toBe(2300);
    expect(getNutritionTargetsForDay("2026-09-20")?.caloriesKcal).toBe(2000);
  });

  it("treats a target from an older backup as the baseline for imported past days", () => {
    const legacyBundle = {
      version: 1,
      exportedAt: "2026-08-01T00:00:00.000Z",
      workouts: [],
      completedWorkouts: [],
      bodyMetrics: [],
      customExercises: [],
      nutritionTargets: {
        caloriesKcal: 2100,
        proteinG: 150,
        carbsG: 220,
        fatG: 70,
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    };

    mergeImport(JSON.stringify(legacyBundle), { restoreSettings: true });

    expect(getNutritionTargetsForDay("2025-12-01")?.caloriesKcal).toBe(2100);
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
    saveMealFromEntries("Backup breakfast", [created!]);
    cacheNutritionBarcodeProduct(
      barcodeDraftToFood(
        {
          barcode: "3017620422003",
          name: "Hazelnut spread",
          brand: "Example brand",
          basisUnit: "g",
          sourceReference: "https://world.openfoodfacts.org/product/3017620422003",
        },
        { caloriesKcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9 }
      )
    );
    cacheNutritionUsdaFood({
      id: "2341644",
      name: "Cornmeal mush, cooked",
      aliases: ["mamaliga"],
      basisAmount: 100,
      basisUnit: "g",
      nutrients: { caloriesKcal: 70, proteinG: 1.5, carbsG: 15, fatG: 0.4 },
      source: "usda",
      sourceReference:
        "https://fdc.nal.usda.gov/fdc-app.html#/food-details/2341644/nutrients",
    });
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
    expect(result.nutritionSavedMealsAdded).toBe(1);
    expect(result.nutritionBarcodeProductsRestored).toBe(1);
    expect(result.nutritionUsdaFoodsRestored).toBe(1);
    expect(getNutritionEntries()[0].id).toBe(created?.id);
    expect(getNutritionTargets()?.caloriesKcal).toBe(2200);
    expect(getNutritionTargetHistory()).toHaveLength(1);
    expect(getNutritionDayAdjustments()[0]?.dayKey).toBe("2026-09-20");
    expect(getCustomNutritionFoods()[0]?.name).toBe("Backup food");
    expect(getNutritionSavedMeals()[0]?.name).toBe("Backup breakfast");
    expect(getCachedNutritionBarcodeProducts()[0]?.id).toBe("3017620422003");
    expect(getCachedNutritionUsdaFoods()[0]?.id).toBe("2341644");
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

  it("saves and reuses a meal with portion multipliers and fresh entry ids", () => {
    const source = addNutritionEntry({
      ...quickAdd,
      quantity: { amount: 100, unit: "g" as const },
    })!;
    const meal = saveMealFromEntries("Usual breakfast", [source]);
    expect(meal?.items).toHaveLength(1);

    const result = copyNutritionItemsToDay(meal!.items, "2026-09-21", "lunch", 1.5);
    expect(result).toEqual({ added: 1, skipped: 0, saved: true });
    const copied = getNutritionEntriesForDay("2026-09-21")[0];
    expect(copied.id).not.toBe(source.id);
    expect(copied.meal).toBe("lunch");
    expect(copied.quantity?.amount).toBe(150);
    expect(copied.nutrients.caloriesKcal).toBe(120);

    expect(copyNutritionItemsToDay(meal!.items, "2026-09-21", "lunch", 1.5)).toEqual({
      added: 0,
      skipped: 1,
      saved: true,
    });
    expect(
      copyNutritionItemsToDay(meal!.items, "2026-09-21", "lunch", 1.5, {
        allowDuplicates: true,
      })
    ).toEqual({ added: 1, skipped: 0, saved: true });
    expect(getNutritionEntriesForDay("2026-09-21")).toHaveLength(2);
    expect(deleteNutritionSavedMeal(meal!.id)).toBe(true);
    expect(getNutritionSavedMeals()).toEqual([]);
  });

  it("creates a reusable meal directly from catalog foods with gram quantities", () => {
    const meal = saveMealFromItems("Chicken bowl", [
      {
        name: "Chicken breast",
        source: "builtin",
        quantity: { amount: 180, unit: "g" },
        nutrients: { caloriesKcal: 297, proteinG: 55.8, carbsG: 0, fatG: 6.5 },
        foodSnapshot: {
          foodId: "chicken-breast-cooked",
          name: "Chicken breast",
          variant: "Cooked",
          basisAmount: 100,
          basisUnit: "g",
          nutrients: { caloriesKcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
          source: "builtin",
        },
      },
    ]);

    expect(meal?.items[0].quantity).toEqual({ amount: 180, unit: "g" });
    expect(getNutritionSavedMeals()[0]?.items[0].quantity?.amount).toBe(180);

    const result = copyNutritionItemsToDay(meal!.items, "2026-09-22", "dinner", 0.5);
    expect(result).toEqual({ added: 1, skipped: 0, saved: true });
    expect(getNutritionEntriesForDay("2026-09-22")[0]?.quantity).toEqual({
      amount: 90,
      unit: "g",
    });
  });

  it("stores a full recipe and logs an arbitrary fraction as one portion", () => {
    const recipe = saveMealFromItems(
      "Pasta bolognese",
      [
        {
          name: "Ground beef",
          source: "builtin",
          quantity: { amount: 500, unit: "g" },
          nutrients: { caloriesKcal: 1000, proteinG: 100, carbsG: 0, fatG: 60 },
        },
      ],
      undefined,
      {
        kind: "recipe",
        servings: 3,
        yieldGrams: 1500,
        description: "A family pasta recipe.",
        instructions: ["Cook the pasta.", "Simmer the sauce."],
        prepMinutes: 45,
      }
    );

    expect(recipe).toMatchObject({
      kind: "recipe",
      servings: 3,
      yieldGrams: 1500,
      description: "A family pasta recipe.",
      instructions: ["Cook the pasta.", "Simmer the sauce."],
      prepMinutes: 45,
    });
    expect(copyNutritionItemsToDay(recipe!.items, "2026-09-23", "lunch", 1 / 3)).toEqual({
      added: 1,
      skipped: 0,
      saved: true,
    });
    const portion = getNutritionEntriesForDay("2026-09-23")[0];
    expect(portion.quantity?.amount).toBeCloseTo(166.67, 1);
    expect(portion.nutrients.caloriesKcal).toBe(333.3);

    const updated = saveMealFromItems(
      recipe!.name,
      [
        {
          ...recipe!.items[0],
          quantity: { amount: 600, unit: "g" },
          nutrients: { caloriesKcal: 1200, proteinG: 120, carbsG: 0, fatG: 72 },
        },
        {
          name: "Tomato sauce",
          source: "builtin",
          quantity: { amount: 400, unit: "g" },
          nutrients: { caloriesKcal: 120, proteinG: 6, carbsG: 24, fatG: 1 },
        },
      ],
      recipe!.id,
      {
        kind: recipe!.kind,
        servings: recipe!.servings,
        yieldGrams: recipe!.yieldGrams,
        description: recipe!.description,
        instructions: recipe!.instructions,
        prepMinutes: recipe!.prepMinutes,
      }
    );
    expect(updated).toMatchObject({
      id: recipe!.id,
      kind: "recipe",
      servings: 3,
      yieldGrams: 1500,
      description: "A family pasta recipe.",
      instructions: ["Cook the pasta.", "Simmer the sauce."],
      prepMinutes: 45,
    });
    expect(updated?.createdAt).toBe(recipe?.createdAt);
    expect(updated?.items).toHaveLength(2);
    expect(getNutritionSavedMeals()[0]?.items[0].quantity?.amount).toBe(600);
    expect(getNutritionSavedMeals()[0]?.items[0].nutrients.caloriesKcal).toBe(1200);
    expect(getNutritionSavedMeals()[0]?.items[1].name).toBe("Tomato sauce");

    expect(copyNutritionItemsToDay(recipe!.items, "2026-09-24", "dinner", 420 / 1500)).toEqual({
      added: 1,
      skipped: 0,
      saved: true,
    });
    expect(getNutritionEntriesForDay("2026-09-24")[0]?.quantity?.amount).toBe(140);
  });

  it("copies a complete previous day while preserving meals and skipping duplicates", () => {
    const breakfast = addNutritionEntry(quickAdd)!;
    const dinner = addNutritionEntry({
      ...quickAdd,
      meal: "dinner",
      name: "Dinner meal",
      nutrients: { caloriesKcal: 500, proteinG: 30, carbsG: 50, fatG: 20 },
    })!;

    expect(
      copyNutritionEntriesToDay([breakfast, dinner], "2026-09-21")
    ).toEqual({ added: 2, skipped: 0, saved: true });
    expect(getNutritionEntriesForDay("2026-09-21").map((entry) => entry.meal)).toEqual([
      "breakfast",
      "dinner",
    ]);
    expect(
      copyNutritionEntriesToDay([breakfast, dinner], "2026-09-21")
    ).toEqual({ added: 0, skipped: 2, saved: true });
  });

  it("preserves intentional duplicate foods while preventing a repeated copy", () => {
    const source = addNutritionEntry(quickAdd)!;
    const duplicate = { ...source, id: "second-source-entry" };

    expect(copyNutritionEntriesToDay([source, duplicate], "2026-09-21")).toEqual({
      added: 2,
      skipped: 0,
      saved: true,
    });
    expect(getNutritionEntriesForDay("2026-09-21")).toHaveLength(2);
    expect(copyNutritionEntriesToDay([source, duplicate], "2026-09-21")).toEqual({
      added: 0,
      skipped: 2,
      saved: true,
    });
  });
});

describe("nutrition food catalog", () => {
  it("ships a valid offline starter catalog with raw and cooked variants", () => {
    const foods = foodCatalog.foods
      .map((food) => normalizeNutritionFood(food, "builtin"))
      .filter((food) => food !== null);

    expect(foods).toHaveLength(foodCatalog.foods.length);
    expect(foods).toHaveLength(1000);
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

describe("nutrition barcodes", () => {
  const gtin13 = (body: string) => {
    const digits = body.split("").map(Number).reverse();
    const sum = digits.reduce(
      (total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1),
      0
    );
    return `${body}${(10 - (sum % 10)) % 10}`;
  };

  it("normalizes and validates EAN and UPC check digits", () => {
    expect(normalizeBarcode("3017 6204-22003")).toBe("3017620422003");
    expect(isValidGtin("3017620422003")).toBe(true);
    expect(isValidGtin("04210007")).toBe(true);
    expect(barcodeLookupCandidates("04210007")).toEqual([
      "04210007",
      "042000001007",
    ]);
    expect(isValidGtin("3017620422004")).toBe(false);
    expect(isValidGtin("1234")).toBe(false);
  });

  it("normalizes Open Food Facts macros and converts sodium to milligrams", () => {
    expect(
      normalizeOpenFoodFactsProduct(
        {
          product: {
            code: "3017620422003",
            product_name: "Chocolate spread",
            brands: "Example",
            nutrition_data_per: "100ml",
            nutriments: {
              "energy-kcal_100g": 120,
              proteins_100g: 3.2,
              carbohydrates_100g: 18,
              fat_100g: 4.5,
              fiber_100g: 1.1,
              sugars_100g: 12,
              sodium_100g: 0.08,
            },
          },
        },
        "3017620422003"
      )
    ).toEqual(
      expect.objectContaining({
        barcode: "3017620422003",
        name: "Chocolate spread",
        brand: "Example",
        basisUnit: "ml",
        caloriesKcal: 120,
        proteinG: 3.2,
        carbsG: 18,
        fatG: 4.5,
        sodiumMg: 80,
      })
    );
  });

  it("looks up barcodes through the same-origin nutrition API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          product: {
            code: "4056489232872",
            product_name: "Cacao",
            brands: "Belbake",
            nutrition_data_per: "100g",
            nutriments: {
              "energy-kcal_100g": 389,
              proteins_100g: 23.3,
              carbohydrates_100g: 14,
              fat_100g: 21,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(fetchOpenFoodFactsProduct("4056489232872")).resolves.toMatchObject({
      barcode: "4056489232872",
      name: "Cacao",
      brand: "Belbake",
      caloriesKcal: 389,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/nutrition/barcode?code=4056489232872",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  it("keeps a confirmed barcode product available offline", () => {
    const cached = cacheNutritionBarcodeProduct(
      barcodeDraftToFood(
        {
          barcode: "3017620422003",
          name: "Chocolate spread",
          brand: "Example",
          basisUnit: "g",
        },
        { caloriesKcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9 }
      )
    );

    expect(cached).not.toBeNull();
    expect(getCachedNutritionBarcodeProducts()).toEqual([
      expect.objectContaining({
        id: "3017620422003",
        source: "barcode",
        brand: "Example",
      }),
    ]);
  });

  it("evicts old barcode products when the local cache reaches its bound", () => {
    for (let index = 0; index <= MAX_CACHED_BARCODE_PRODUCTS; index += 1) {
      const barcode = gtin13(String(index + 1).padStart(12, "0"));
      cacheNutritionBarcodeProduct(
        barcodeDraftToFood(
          { barcode, name: `Product ${index}`, brand: "", basisUnit: "g" },
          { caloriesKcal: index, proteinG: 1, carbsG: 2, fatG: 3 }
        )
      );
    }

    const products = getCachedNutritionBarcodeProducts();
    expect(products).toHaveLength(MAX_CACHED_BARCODE_PRODUCTS);
    expect(products.some((product) => product.name === "Product 100")).toBe(true);
  });
});
