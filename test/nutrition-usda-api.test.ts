import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/nutrition/search/route";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const openFoodFactsProduct = {
  code: "3017620422003",
  product_name: "Porchetta",
  brands: "Example brand",
  nutrition_data_per: "100g",
  nutriments: {
    "energy-kcal_100g": 280,
    proteins_100g: 17,
    carbohydrates_100g: 2,
    fat_100g: 23,
  },
};

describe("combined nutrition API route", () => {
  it("still searches Open Food Facts when the USDA key is missing", async () => {
    vi.stubEnv("USDA_FDC_API_KEY", "");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ products: [openFoodFactsProduct] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const response = await GET(
      new Request("http://localhost/api/nutrition/search?q=porchetta", {
        headers: { "x-forwarded-for": "192.0.2.41" },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      foods: [expect.objectContaining({ name: "Porchetta", source: "barcode" })],
      sources: { usda: "not_configured", openFoodFacts: "ok" },
    });
  });

  it("combines both providers and never returns the private USDA key", async () => {
    vi.stubEnv("USDA_FDC_API_KEY", "private-test-key");
    const upstream = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("api.nal.usda.gov")) {
        return new Response(
          JSON.stringify({
            foods: [
              {
                fdcId: 2341644,
                description: "Cornmeal mush, cooked, made with water",
                foodNutrients: [
                  { nutrientId: 1008, unitName: "KCAL", value: 70 },
                  { nutrientId: 1003, unitName: "G", value: 1.5 },
                  { nutrientId: 1005, unitName: "G", value: 15 },
                  { nutrientId: 1004, unitName: "G", value: 0.4 },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ products: [openFoodFactsProduct] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const response = await GET(
      new Request("http://localhost/api/nutrition/search?q=polenta", {
        headers: { "x-forwarded-for": "192.0.2.42" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.foods).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "2341644", source: "usda" }),
      expect.objectContaining({ id: "3017620422003", source: "barcode" }),
    ]));
    expect(body.sources).toEqual({ usda: "ok", openFoodFacts: "ok" });
    expect(JSON.stringify(body)).not.toContain("private-test-key");
    const usdaCall = upstream.mock.calls.find(([input]) =>
      String(input).includes("api.nal.usda.gov")
    );
    const openFoodFactsCall = upstream.mock.calls.find(([input]) =>
      String(input).includes("openfoodfacts.org")
    );
    expect(String(usdaCall?.[0])).toContain("api_key=private-test-key");
    expect(JSON.parse(String(usdaCall?.[1]?.body))).toMatchObject({
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
    });
    expect(String(openFoodFactsCall?.[0])).toContain("search_terms=polenta");
    expect(openFoodFactsCall?.[1]?.headers).toMatchObject({
      "User-Agent": expect.stringContaining("ForkWorkout"),
    });
  });
});
