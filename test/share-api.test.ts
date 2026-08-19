import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/shares/[id]/route";
import { POST } from "@/app/api/shares/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("share API guardrails", () => {
  it("fails closed when cloud sharing is disabled", async () => {
    vi.stubEnv("SHARE_SERVICE_ENABLED", "false");
    const response = await POST(
      new Request("http://localhost/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envelope: {} }),
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "share_unavailable" });
  });

  it("fails closed when the quota guard has no management credentials", async () => {
    vi.stubEnv("SHARE_SERVICE_ENABLED", "true");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("SHARE_QUOTA_GUARD_ENABLED", "true");
    vi.stubEnv("UPSTASH_REDIS_DATABASE_ID", "");
    vi.stubEnv("UPSTASH_DEVELOPER_EMAIL", "");
    vi.stubEnv("UPSTASH_DEVELOPER_API_KEY", "");

    const response = await POST(
      new Request("http://localhost/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envelope: {} }),
      })
    );

    expect(response.status).toBe(503);
  });

  it("returns a generic 404 for malformed share IDs without reading storage", async () => {
    vi.stubEnv("SHARE_SERVICE_ENABLED", "true");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");

    const response = await GET(new Request("http://localhost/api/shares/bad"), {
      params: Promise.resolve({ id: "bad" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "share_not_found" });
  });
});
