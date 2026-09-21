import { afterEach, describe, expect, it, vi } from "vitest";

import {
  normalizeUsdaSearchFood,
  searchOnlineFoods,
} from "@/lib/nutrition/usda";

afterEach(() => vi.restoreAllMocks());

const rawPolenta = {
  fdcId: 2341644,
  description: "Cornmeal mush, cooked, made with water",
  dataType: "Survey (FNDDS)",
  foodNutrients: [
    { nutrientId: 1008, nutrientName: "Energy", unitName: "KCAL", value: 70 },
    { nutrientId: 1003, nutrientName: "Protein", unitName: "G", value: 1.5 },
    {
      nutrientId: 1005,
      nutrientName: "Carbohydrate, by difference",
      unitName: "G",
      value: 15,
    },
    { nutrientId: 1004, nutrientName: "Total lipid (fat)", unitName: "G", value: 0.4 },
    { nutrientId: 1093, nutrientName: "Sodium, Na", unitName: "MG", value: 120 },
  ],
};

describe("online nutrition search", () => {
  it("normalizes an FDC search result into a per-100g food", () => {
    expect(normalizeUsdaSearchFood(rawPolenta)).toEqual(
      expect.objectContaining({
        id: "2341644",
        name: "Cornmeal mush, cooked, made with water",
        source: "usda",
        basisAmount: 100,
        basisUnit: "g",
        nutrients: expect.objectContaining({
          caloriesKcal: 70,
          proteinG: 1.5,
          carbsG: 15,
          fatG: 0.4,
          sodiumMg: 120,
        }),
      })
    );
  });

  it("searches through ForkWorkout's server route without exposing a key", async () => {
    const food = normalizeUsdaSearchFood(rawPolenta)!;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          foods: [food],
          sources: { usda: "ok", openFoodFacts: "ok" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(searchOnlineFoods("mamaliga")).resolves.toEqual({
      foods: [food],
      sources: { usda: "ok", openFoodFacts: "ok" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/nutrition/search?q=mamaliga",
      expect.objectContaining({ method: "GET" })
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("api_key");
  });

  it("does not call the API for an undersized query", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(searchOnlineFoods("p")).resolves.toEqual({
      foods: [],
      sources: { usda: "unavailable", openFoodFacts: "unavailable" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
