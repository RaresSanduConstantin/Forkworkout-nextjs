import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GET,
  POST,
} from "@/app/api/nutrition/recommendations/route";
import { POST as UNLOCK } from "@/app/api/nutrition/analyze-photo/unlock/route";
import {
  normalizeMealRecommendations,
  type RecommendationCandidate,
} from "@/lib/nutrition/recommendations";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const candidates: RecommendationCandidate[] = [
  {
    id: "food-0",
    name: "Greek yogurt",
    kind: "food",
    baseAmount: 100,
    baseUnit: "g",
    nutrients: { caloriesKcal: 90, proteinG: 10, carbsG: 4, fatG: 3 },
  },
  {
    id: "food-1",
    name: "Banana",
    kind: "food",
    baseAmount: 100,
    baseUnit: "g",
    nutrients: { caloriesKcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3 },
  },
];

const modelOutput = {
  suggestions: [
    {
      title: "Yogurt and banana",
      kind: "snack",
      summary: "A protein-focused snack with carbohydrates.",
      prepMinutes: 5,
      instructions: ["Slice the banana over the yogurt."],
      selections: [
        { candidateId: "food-0", multiplier: 2 },
        { candidateId: "food-1", multiplier: 1 },
      ],
    },
  ],
};

function enableRecommendations(overrides: Record<string, string> = {}) {
  vi.stubEnv("AI_FOOD_SCANNER_ENABLED", "true");
  vi.stubEnv("AI_MEAL_RECOMMENDATIONS_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "private-openai-key");
  vi.stubEnv("AI_SCAN_REQUIRE_REDIS", "false");
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
}

function recommendationRequest({
  deviceId = crypto.randomUUID(),
  ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
  cookie,
}: {
  deviceId?: string;
  ip?: string;
  cookie?: string;
} = {}) {
  return new Request("http://localhost/api/nutrition/recommendations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({
      anonymousDeviceId: deviceId,
      remaining: { caloriesKcal: 500, proteinG: 35, carbsG: 55, fatG: 15 },
      meal: "snacks",
      preferences: "no peanuts",
      pantryFoods: "Greek yogurt, bananas",
      candidates,
    }),
  });
}

function usageRequest(deviceId: string, cookie?: string) {
  return new Request("http://localhost/api/nutrition/recommendations", {
    headers: {
      "x-forkworkout-installation-id": deviceId,
      ...(cookie ? { cookie } : {}),
    },
  });
}

function unlockRequest(deviceId: string, key: string) {
  return new Request("http://localhost/api/nutrition/analyze-photo/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.77" },
    body: JSON.stringify({ anonymousDeviceId: deviceId, key }),
  });
}

function mockOpenAI() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    new Response(
      JSON.stringify({
        output: [
          {
            content: [{ type: "output_text", text: JSON.stringify(modelOutput) }],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  );
}

describe("meal recommendation normalization", () => {
  it("rejects unknown candidates and calculates totals from known nutrition", () => {
    const normalized = normalizeMealRecommendations(modelOutput, candidates);
    expect(normalized).toEqual([
      expect.objectContaining({
        title: "Yogurt and banana",
        prepMinutes: 5,
        total: { caloriesKcal: 269, proteinG: 21.1, carbsG: 31, fatG: 6.3 },
      }),
    ]);
    expect(
      normalizeMealRecommendations(
        {
          suggestions: [
            {
              ...modelOutput.suggestions[0],
              selections: [{ candidateId: "invented-food", multiplier: 1 }],
            },
          ],
        },
        candidates
      )
    ).toBeNull();
  });
});

describe("meal recommendation API", () => {
  it("uses structured output and enforces a separate daily allowance", async () => {
    enableRecommendations({
      AI_RECOMMENDATION_DAILY_DEVICE_LIMIT: "1",
      AI_RECOMMENDATION_HOURLY_IP_LIMIT: "20",
    });
    const upstream = mockOpenAI();
    const deviceId = crypto.randomUUID();

    await expect((await GET(usageRequest(deviceId))).json()).resolves.toMatchObject({
      enabled: true,
      dailyLimit: 1,
      dailyRemaining: 1,
    });
    const response = await POST(recommendationRequest({ deviceId }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      recommendations: [
        expect.objectContaining({ total: { caloriesKcal: 269, proteinG: 21.1, carbsG: 31, fatG: 6.3 } }),
      ],
    });
    const outbound = JSON.parse(String(upstream.mock.calls[0][1]?.body));
    expect(outbound.store).toBe(false);
    expect(outbound.text.format).toMatchObject({
      type: "json_schema",
      name: "forkworkout_meal_recommendations",
      strict: true,
    });
    expect(outbound.text.format.schema.properties.suggestions.items.required).toContain(
      "prepMinutes"
    );
    const prompt = JSON.parse(outbound.input[0].content[0].text);
    expect(prompt.foodsAvailable).toBe("Greek yogurt, bananas");
    expect((await POST(recommendationRequest({ deviceId }))).status).toBe(429);
  });

  it("uses the owner cookie for unlimited recommendation requests", async () => {
    const ownerKey = "owner-only-random-key-that-is-longer-than-32-characters";
    enableRecommendations({
      AI_RECOMMENDATION_DAILY_DEVICE_LIMIT: "1",
      AI_RECOMMENDATION_HOURLY_IP_LIMIT: "1",
      AI_SCAN_UNLIMITED_KEY: ownerKey,
    });
    const deviceId = crypto.randomUUID();
    const unlock = await UNLOCK(unlockRequest(deviceId, ownerKey));
    const setCookie = unlock.headers.get("set-cookie") ?? "";
    const cookie = setCookie.split(";")[0];
    expect(setCookie).toContain("Path=/api/nutrition");
    await expect((await GET(usageRequest(deviceId, cookie))).json()).resolves.toMatchObject({
      unlimited: true,
    });

    mockOpenAI();
    expect((await POST(recommendationRequest({ deviceId, cookie }))).status).toBe(200);
    expect((await POST(recommendationRequest({ deviceId, cookie }))).status).toBe(200);
  });
});
