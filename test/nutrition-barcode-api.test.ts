import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/nutrition/barcode/route";

afterEach(() => vi.restoreAllMocks());

const openFoodFactsResponse = {
  code: "4056489232872",
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
  status: 1,
};

describe("nutrition barcode API route", () => {
  it("proxies a valid barcode with a server-side User-Agent", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(openFoodFactsResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const response = await GET(
      new Request(
        "http://localhost/api/nutrition/barcode?code=4056489232872"
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject(openFoodFactsResponse);
    expect(String(upstream.mock.calls[0][0])).toContain(
      "/api/v2/product/4056489232872.json"
    );
    expect(upstream.mock.calls[0][1]?.headers).toMatchObject({
      "User-Agent": expect.stringContaining("ForkWorkout"),
    });
  });

  it("rejects invalid barcodes without contacting Open Food Facts", async () => {
    const upstream = vi.spyOn(globalThis, "fetch");
    const response = await GET(
      new Request("http://localhost/api/nutrition/barcode?code=1234")
    );

    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("returns a product-not-found response for a catalog miss", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: 0 }), { status: 404 })
    );
    const response = await GET(
      new Request(
        "http://localhost/api/nutrition/barcode?code=4056489232872"
      )
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "product_not_found",
    });
  });

  it("does not turn an upstream failure into a catalog miss", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("temporarily unavailable", { status: 503 })
    );
    const response = await GET(
      new Request(
        "http://localhost/api/nutrition/barcode?code=4056489232872"
      )
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: "lookup_unavailable",
    });
  });
});
