// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NutritionDateNavigation } from "@/components/nutrition/NutritionDateNavigation";
import { NutritionLibrary } from "@/components/nutrition/NutritionLibrary";
import { NutritionDashboard } from "@/components/nutrition/NutritionDashboard";
import { FoodPickerSheet } from "@/components/nutrition/FoodPickerSheet";
import { MealActionsSheet } from "@/components/nutrition/MealActionsSheet";
import { nutritionLibraryFoods } from "@/lib/nutrition/library";
import type { NutritionFood } from "@/lib/nutrition/types";
import { dayKeyToDate, toDayKey } from "@/lib/date/day-key";
import { addNutritionEntry, getNutritionEntries } from "@/lib/storage/nutrition-storage";
import { getCustomNutritionFoods, getNutritionFoodPreferences, nutritionFoodKey, upsertCustomNutritionFood } from "@/lib/storage/nutrition-food-storage";
import { cacheNutritionBarcodeProduct, getCachedNutritionBarcodeProduct } from "@/lib/storage/nutrition-barcode-storage";
import { getNutritionSavedMeals, saveMealFromItems, setNutritionSavedMealFavourite } from "@/lib/storage/nutrition-meal-storage";
import { runtimeStorageCache } from "@/lib/storage/runtime-cache";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const nutrients = { caloriesKcal: 200, proteinG: 12, carbsG: 20, fatG: 8, fibreG: 3, sugarG: 4, sodiumMg: 120 };
const food: NutritionFood = { id: "042100005264", name: "Test oats", brand: "Test brand", aliases: ["Ovăz"], basisAmount: 100, basisUnit: "g", source: "barcode", nutrients };
const dayKey = "2026-10-22";
const mealItem = { name: food.name, source: food.source, nutrients, quantity: { amount: 100, unit: "g" as const }, foodSnapshot: { ...food, foodId: food.id } };
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  runtimeStorageCache.reset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 1, foods: [] }) }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function render(element: React.ReactNode) {
  await act(async () => root.render(element));
}
async function click(text: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent?.trim() === text);
  expect(button, `Button: ${text}`).toBeDefined();
  await act(async () => button!.click());
}
async function clickLabel(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.getAttribute("aria-label") === label);
  expect(button, `Button label: ${label}`).toBeDefined();
  await act(async () => button!.click());
}
function edit(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  expect(input, id).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("nutrition library", () => {
  it("recovers used products from snapshots and prefers the current editable record", () => {
    const entry = addNutritionEntry({ ...mealItem, dayKey, meal: "lunch" })!;
    const builtin = { ...food, id: "unused", source: "builtin" as const };
    expect(nutritionLibraryFoods([builtin], [entry], []).map(nutritionFoodKey)).toEqual([nutritionFoodKey(food)]);
    const updated = { ...food, name: "Updated oats", nutrients: { ...nutrients, caloriesKcal: 250 } };
    expect(nutritionLibraryFoods([builtin, updated], [entry], [])).toEqual([updated]);
    expect(getNutritionEntries()[0].nutrients.caloriesKcal).toBe(200);
  });

  it("shows all saved recipes and used products, persists stars, and filters favourites", async () => {
    const meal = saveMealFromItems("Oat bowl", [mealItem], undefined, { kind: "recipe", servings: 2 })!;
    const entry = addNutritionEntry({ ...mealItem, dayKey, meal: "lunch" })!;
    const onEditMeal = vi.fn();
    const onEditFood = vi.fn();
    const props = { entries: [entry], revision: 0, onEditMeal, onEditFood, onCreateRecipe: vi.fn(), onCreateFood: vi.fn() };
    await render(React.createElement(NutritionLibrary, { ...props, tab: "recipes" }));
    expect(container.textContent).toContain("Oat bowl");
    expect(container.textContent).toContain("100 kcal per serving");
    await clickLabel("Add Oat bowl to favourites");
    expect(getNutritionSavedMeals()[0].favourite).toBe(true);
    await click("Edit recipe");
    expect(onEditMeal).toHaveBeenCalledWith(expect.objectContaining({ id: meal.id }));
    await render(React.createElement(NutritionLibrary, { ...props, tab: "products" }));
    await clickLabel("Add Test oats to favourites");
    expect(getNutritionFoodPreferences()[0].favourite).toBe(true);
    await click("Edit product");
    expect(onEditFood).toHaveBeenCalledWith(expect.objectContaining({ id: food.id }));
    await render(React.createElement(NutritionLibrary, { ...props, tab: "favourites" }));
    expect(container.textContent).toContain("Oat bowl");
    expect(container.textContent).toContain("Test oats");
    await clickLabel("Remove Test oats from favourites");
    expect(container.querySelector('[aria-label="Food products"]')).toBeNull();
    await clickLabel("Remove Oat bowl from favourites");
    expect(container.textContent).toContain("No favourites yet");
  });

  it("edits a barcode product without logging food or changing previous snapshots", async () => {
    cacheNutritionBarcodeProduct(food);
    addNutritionEntry({ ...mealItem, dayKey, meal: "lunch" });
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    await render(React.createElement(FoodPickerSheet, { open: true, onOpenChange, dayKey, initialMeal: "lunch", mode: "manage", initialFood: food, onSaved, onPhotoScan: vi.fn(), onSavedMeal: vi.fn() }));
    expect(document.activeElement?.tagName).not.toBe("INPUT");
    edit("custom-food-name", "Updated oats");
    edit("custom-food-calories", "250");
    await click("Save product");
    expect(getCachedNutritionBarcodeProduct(food.id)).toEqual(expect.objectContaining({ name: "Updated oats", brand: "Test brand", nutrients: { ...nutrients, caloriesKcal: 250 } }));
    expect(getNutritionEntries()).toHaveLength(1);
    expect(getNutritionEntries()[0].foodSnapshot?.name).toBe("Test oats");
    expect(getNutritionEntries()[0].nutrients.caloriesKcal).toBe(200);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("preserves optional nutrients on custom edits and saves catalog edits as custom products", async () => {
    const custom = upsertCustomNutritionFood(food)!;
    const props = { open: true, onOpenChange: vi.fn(), dayKey, initialMeal: "lunch" as const, mode: "manage" as const, onSaved: vi.fn(), onPhotoScan: vi.fn(), onSavedMeal: vi.fn() };
    await render(React.createElement(FoodPickerSheet, { ...props, initialFood: custom }));
    edit("custom-food-name", "Custom oats");
    await click("Save product");
    expect(getCustomNutritionFoods()[0]).toEqual(expect.objectContaining({ brand: food.brand, nutrients }));
    await render(React.createElement(FoodPickerSheet, { ...props, initialFood: { ...food, source: "builtin", id: "catalog-oats" } }));
    edit("custom-food-name", "My catalog oats");
    await click("Save as custom product");
    expect(getCustomNutritionFoods()).toHaveLength(2);
    expect(getNutritionEntries()).toHaveLength(0);
  });

  it.each(["recipe", undefined] as const)("edits a saved %s without changing its kind, stars, or food history", async (kind) => {
    const meal = saveMealFromItems("Oat bowl", [mealItem], undefined, { kind, servings: kind ? 2 : undefined, yieldGrams: kind ? 300 : undefined, instructions: ["Mix"], description: "Breakfast" })!;
    setNutritionSavedMealFavourite(meal.id, true);
    await render(React.createElement(MealActionsSheet, { open: true, onOpenChange: vi.fn(), dayKey, initialMeal: "breakfast", initialSavedMealId: meal.id, startEditing: true, entries: [], onSaved: vi.fn() }));
    edit("builder-meal-name", "New oat bowl");
    await click(kind ? "Update recipe" : "Update meal");
    expect(getNutritionSavedMeals()[0]).toEqual(expect.objectContaining({ id: meal.id, name: "New oat bowl", favourite: true, kind, servings: kind ? 2 : undefined, yieldGrams: kind ? 300 : undefined, instructions: ["Mix"], description: "Breakfast" }));
    expect(getNutritionEntries()).toHaveLength(0);
  });
});

describe("nutrition calendar", () => {
  it("updates the dashboard tracking when a calendar day is selected", async () => {
    const today = toDayKey();
    const yesterday = dayKeyToDate(today);
    yesterday.setDate(yesterday.getDate() - 1);
    addNutritionEntry({ dayKey: today, meal: "breakfast", name: "Today's breakfast", nutrients });
    addNutritionEntry({ dayKey: toDayKey(yesterday), meal: "lunch", name: "Yesterday's lunch", nutrients });
    await render(React.createElement(NutritionDashboard));
    expect(container.textContent).toContain("Today's breakfast");
    expect(container.textContent).not.toContain("Yesterday's lunch");
    await click("Browse calendar");
    const day = [...container.querySelectorAll<HTMLButtonElement>('[data-slot="calendar"] button')].find((node) => node.getAttribute("aria-label")?.startsWith(`${yesterday.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}: food logged`));
    expect(day).toBeDefined();
    await act(async () => day!.click());
    expect(container.textContent).toContain("Yesterday's lunch");
    expect(container.textContent).not.toContain("Today's breakfast");
    await clickLabel("Return to today");
    expect(container.textContent).toContain("Today's breakfast");
    expect(container.textContent).not.toContain("Yesterday's lunch");
  });

  it("expands, selects a logged day in another month, and keeps the week and today shortcut synchronized", async () => {
    const onChange = vi.fn();
    function Harness() {
      const [selected, setSelected] = React.useState(dayKey);
      return React.createElement(NutritionDateNavigation, { dayKey: selected, loggedDayKeys: new Set(["2026-09-15"]), onDayChange: (next) => { onChange(next); setSelected(next); } });
    }
    await render(React.createElement(Harness));
    expect(container.querySelector('[data-slot="calendar"]')).toBeNull();
    await click("Browse calendar");
    await clickLabel("Go to the Previous Month");
    await clickLabel("Tuesday, September 15, 2026: food logged");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-15");
    expect(container.querySelector('[aria-current="date"]')?.getAttribute("aria-label")).toBe("Tuesday, September 15: food logged");
    await clickLabel("Next day");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-16");
    await clickLabel("Return to today");
    expect(onChange).toHaveBeenLastCalledWith(toDayKey());
  });
});
