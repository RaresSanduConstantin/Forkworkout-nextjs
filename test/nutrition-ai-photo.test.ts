import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/nutrition/analyze-photo/route";
import { POST as UNLOCK } from "@/app/api/nutrition/analyze-photo/unlock/route";
import { normalizeAIPhotoAnalysis } from "@/lib/nutrition/ai-photo";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function enableScanner(overrides: Record<string, string> = {}) {
  vi.stubEnv("AI_FOOD_SCANNER_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "private-openai-key");
  vi.stubEnv("AI_SCAN_REQUIRE_REDIS", "false");
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
}

function request({
  deviceId = crypto.randomUUID(),
  ip = `192.0.2.${Math.floor(Math.random() * 200) + 1}`,
  type = "image/jpeg",
  cookie,
}: {
  deviceId?: string;
  ip?: string;
  type?: string;
  cookie?: string;
} = {}) {
  const form = new FormData();
  form.append("image", new Blob(["image-bytes"], { type }), "meal.jpg");
  form.append("anonymousDeviceId", deviceId);
  form.append("weightGrams", "350");
  return new Request("http://localhost/api/nutrition/analyze-photo", {
    method: "POST",
    headers: {
      "x-forwarded-for": ip,
      ...(cookie ? { cookie } : {}),
    },
    body: form,
  });
}

const modelAnalysis = {
  foods: [
    {
      name: "Grilled chicken",
      estimatedWeightGrams: 180,
      caloriesKcal: 297,
      proteinG: 55.8,
      carbsG: 0,
      fatG: 6.4,
      confidence: 0.88,
    },
  ],
  total: { caloriesKcal: 297, proteinG: 55.8, carbsG: 0, fatG: 6.4 },
  confidence: "high",
};

function usageRequest(deviceId: string, cookie?: string) {
  return new Request("http://localhost/api/nutrition/analyze-photo", {
    headers: {
      "x-forkworkout-installation-id": deviceId,
      ...(cookie ? { cookie } : {}),
    },
  });
}

function unlockRequest(deviceId: string, key: string, ip = "203.0.113.10") {
  return new Request("http://localhost/api/nutrition/analyze-photo/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ anonymousDeviceId: deviceId, key }),
  });
}

describe("AI photo nutrition normalization", () => {
  it("validates rows and derives a trustworthy total from them", () => {
    expect(
      normalizeAIPhotoAnalysis({
        ...modelAnalysis,
        total: { caloriesKcal: 9999, proteinG: 0, carbsG: 0, fatG: 0 },
      })
    ).toEqual({
      foods: [
        {
          name: "Grilled chicken",
          estimatedWeightGrams: 180,
          nutrients: { caloriesKcal: 297, proteinG: 55.8, carbsG: 0, fatG: 6.4 },
          confidence: 0.88,
        },
      ],
      total: { caloriesKcal: 297, proteinG: 55.8, carbsG: 0, fatG: 6.4 },
      confidence: "high",
    });
  });

  it("accepts the normalized API response shape used by the browser", () => {
    const normalized = normalizeAIPhotoAnalysis(modelAnalysis);
    expect(normalized).not.toBeNull();
    expect(normalizeAIPhotoAnalysis(normalized)).toEqual(normalized);
  });

  it("rejects malformed or unsafe model values", () => {
    expect(normalizeAIPhotoAnalysis({ ...modelAnalysis, foods: [] })).toBeNull();
    expect(
      normalizeAIPhotoAnalysis({
        ...modelAnalysis,
        foods: [{ ...modelAnalysis.foods[0], caloriesKcal: -1 }],
      })
    ).toBeNull();
    expect(
      normalizeAIPhotoAnalysis({
        ...modelAnalysis,
        foods: [
          {
            name: "Invalid nested result",
            estimatedWeightGrams: 100,
            nutrients: { caloriesKcal: -1, proteinG: 1, carbsG: 1, fatG: 1 },
            confidence: 0.8,
          },
        ],
      })
    ).toBeNull();
  });
});

describe("AI photo nutrition API", () => {
  it("reports daily device usage without consuming a scan", async () => {
    enableScanner({ AI_SCAN_DAILY_DEVICE_LIMIT: "2", AI_SCAN_HOURLY_IP_LIMIT: "20" });
    const deviceId = crypto.randomUUID();

    const before = await GET(usageRequest(deviceId));
    expect(before.status).toBe(200);
    await expect(before.json()).resolves.toMatchObject({
      enabled: true,
      dailyLimit: 2,
      dailyRemaining: 2,
    });
    await expect((await GET(usageRequest(deviceId))).json()).resolves.toMatchObject({
      dailyRemaining: 2,
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              content: [{ type: "output_text", text: JSON.stringify(modelAnalysis) }],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    expect((await POST(request({ deviceId }))).status).toBe(200);
    await expect((await GET(usageRequest(deviceId))).json()).resolves.toMatchObject({
      dailyLimit: 2,
      dailyRemaining: 1,
    });
  });

  it("fails closed while the optional scanner is disabled", async () => {
    vi.stubEnv("AI_FOOD_SCANNER_ENABLED", "false");
    const response = await POST(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "SCANNER_UNAVAILABLE" });
  });

  it("fails closed in production when durable rate limiting is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_FOOD_SCANNER_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "private-openai-key");
    vi.stubEnv("AI_SCAN_REQUIRE_REDIS", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const upstream = vi.spyOn(globalThis, "fetch");
    const response = await POST(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "SCANNER_UNAVAILABLE" });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects unsupported files before contacting OpenAI", async () => {
    enableScanner();
    const upstream = vi.spyOn(globalThis, "fetch");
    const response = await POST(request({ type: "image/gif" }));
    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ error: "INVALID_IMAGE" });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("keeps the key server-side and returns validated nutrition", async () => {
    enableScanner({ OPENAI_PROJECT_ID: "project-test" });
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              content: [{ type: "output_text", text: JSON.stringify(modelAnalysis) }],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.analysis).toMatchObject({
      foods: [expect.objectContaining({ name: "Grilled chicken" })],
      total: { caloriesKcal: 297, proteinG: 55.8, carbsG: 0, fatG: 6.4 },
    });
    expect(JSON.stringify(body)).not.toContain("private-openai-key");
    expect(upstream).toHaveBeenCalledOnce();
    const [, options] = upstream.mock.calls[0];
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer private-openai-key",
      "OpenAI-Project": "project-test",
    });
    const outbound = JSON.parse(String(options?.body));
    expect(outbound.store).toBe(false);
    expect(outbound.input[0].content[1].image_url).toMatch(/^data:image\/jpeg;base64,/);
    expect(outbound.text.format).toMatchObject({ type: "json_schema", strict: true });
  });

  it("maps an exhausted API credit balance separately from a monthly spend limit", async () => {
    enableScanner();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "credit_balance_exhausted",
            type: "insufficient_quota",
            message: "billing limit",
          },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      )
    );
    const response = await POST(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "AI_BILLING_UNAVAILABLE",
      reason: "credit_balance_exhausted",
    });
  });

  it("maps only explicit project or organization spend errors to the monthly budget", async () => {
    enableScanner();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "project_spend_limit_exceeded",
            type: "insufficient_quota",
            message: "project limit",
          },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      )
    );
    const response = await POST(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "MONTHLY_BUDGET_REACHED",
      reason: "project_spend_limit_exceeded",
    });
  });

  it("returns a predictable invalid-image error when no food is detected", async () => {
    enableScanner();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    foods: [],
                    total: { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
                    confidence: "low",
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const response = await POST(request());
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: "INVALID_IMAGE" });
  });

  it("enforces both anonymous-device and IP application limits", async () => {
    enableScanner({ AI_SCAN_DAILY_DEVICE_LIMIT: "1", AI_SCAN_HOURLY_IP_LIMIT: "1" });
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              content: [{ type: "output_text", text: JSON.stringify(modelAnalysis) }],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const deviceId = crypto.randomUUID();
    const ip = "198.51.100.222";
    expect((await POST(request({ deviceId, ip }))).status).toBe(200);
    const limited = await POST(request({ deviceId, ip }));
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({ error: "RATE_LIMITED" });
  });

  it("exchanges the server-only owner key for an installation-bound unlimited cookie", async () => {
    const ownerKey = "owner-only-random-key-that-is-longer-than-32-characters";
    enableScanner({
      AI_SCAN_DAILY_DEVICE_LIMIT: "1",
      AI_SCAN_HOURLY_IP_LIMIT: "1",
      AI_SCAN_UNLIMITED_KEY: ownerKey,
    });
    const deviceId = crypto.randomUUID();
    const unlock = await UNLOCK(unlockRequest(deviceId, ownerKey));
    const cookie = unlock.headers.get("set-cookie")?.split(";")[0];

    expect(unlock.status).toBe(200);
    expect(cookie).toContain("forkworkout-ai-unlimited=");
    await expect((await GET(usageRequest(deviceId, cookie))).json()).resolves.toMatchObject({
      unlimited: true,
    });
    await expect((await GET(usageRequest(crypto.randomUUID(), cookie))).json()).resolves.toMatchObject({
      unlimited: false,
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              content: [{ type: "output_text", text: JSON.stringify(modelAnalysis) }],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const ip = "203.0.113.11";
    expect((await POST(request({ deviceId, ip, cookie }))).status).toBe(200);
    expect((await POST(request({ deviceId, ip, cookie }))).status).toBe(200);
  });

  it("does not set an owner cookie for an invalid key", async () => {
    enableScanner({
      AI_SCAN_UNLIMITED_KEY: "owner-only-random-key-that-is-longer-than-32-characters",
    });
    const response = await UNLOCK(
      unlockRequest(crypto.randomUUID(), "wrong-key", "203.0.113.12")
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
