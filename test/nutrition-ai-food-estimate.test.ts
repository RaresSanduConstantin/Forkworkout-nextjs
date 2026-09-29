import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/nutrition/estimate-food/route";
import { normalizeAIFoodEstimate } from "@/lib/nutrition/ai-food-estimate";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function enableEstimator() {
  vi.stubEnv("AI_FOOD_SCANNER_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "private-openai-key");
  vi.stubEnv("AI_SCAN_REQUIRE_REDIS", "false");
}

function request(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/nutrition/estimate-food", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
    },
    body: JSON.stringify({
      query: "homemade pea soup",
      details: "peas, carrots and a little olive oil",
      basisAmount: 250,
      basisUnit: "g",
      anonymousDeviceId: crypto.randomUUID(),
      ...overrides,
    }),
  });
}

const modelEstimate = {
  name: "Homemade pea soup",
  caloriesKcal: 190,
  proteinG: 10.5,
  carbsG: 31,
  fatG: 4.2,
  confidence: "medium",
};

describe("AI food estimate normalization", () => {
  it("accepts the provider and public response shapes", () => {
    const provider = normalizeAIFoodEstimate({
      ...modelEstimate,
      basisAmount: 250,
      basisUnit: "g",
    });
    expect(provider).toEqual({
      name: "Homemade pea soup",
      basisAmount: 250,
      basisUnit: "g",
      nutrients: { caloriesKcal: 190, proteinG: 10.5, carbsG: 31, fatG: 4.2 },
      confidence: "medium",
    });
    expect(normalizeAIFoodEstimate(provider)).toEqual(provider);
  });

  it("rejects negative nutrients and invalid units", () => {
    expect(
      normalizeAIFoodEstimate({
        ...modelEstimate,
        basisAmount: 100,
        basisUnit: "serving",
      })
    ).toBeNull();
    expect(
      normalizeAIFoodEstimate({
        ...modelEstimate,
        basisAmount: 100,
        basisUnit: "g",
        caloriesKcal: -1,
      })
    ).toBeNull();
  });
});

describe("AI food estimate API", () => {
  it("fails closed while AI nutrition is disabled", async () => {
    vi.stubEnv("AI_FOOD_SCANNER_ENABLED", "false");
    const upstream = vi.spyOn(globalThis, "fetch");
    const response = await POST(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "ESTIMATOR_UNAVAILABLE" });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects invalid input before contacting OpenAI", async () => {
    enableEstimator();
    const upstream = vi.spyOn(globalThis, "fetch");
    const response = await POST(request({ query: "x", basisAmount: -10 }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "INVALID_REQUEST" });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("keeps credentials server-side and returns a validated editable estimate", async () => {
    enableEstimator();
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              content: [{ type: "output_text", text: JSON.stringify(modelEstimate) }],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.estimate).toEqual({
      name: "Homemade pea soup",
      basisAmount: 250,
      basisUnit: "g",
      nutrients: { caloriesKcal: 190, proteinG: 10.5, carbsG: 31, fatG: 4.2 },
      confidence: "medium",
    });
    expect(JSON.stringify(body)).not.toContain("private-openai-key");
    expect(upstream).toHaveBeenCalledOnce();
    const [, options] = upstream.mock.calls[0];
    expect(options?.headers).toMatchObject({ Authorization: "Bearer private-openai-key" });
    const outbound = JSON.parse(String(options?.body));
    expect(outbound.store).toBe(false);
    expect(outbound.safety_identifier).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(outbound.text.format).toMatchObject({
      type: "json_schema",
      strict: true,
      schema: { additionalProperties: false },
    });
    expect(outbound.input[0].content[0].text).toContain("homemade pea soup");
  });
});
