import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ShareServerConfig } from "@/lib/sharing/config";
import {
  clearShareQuotaCacheForTests,
  getShareQuotaStatus,
} from "@/lib/sharing/quota";

const config: ShareServerConfig = {
  enabled: true,
  redisUrl: "https://redis.test",
  redisToken: "token",
  databaseId: "db-id",
  developerEmail: "owner@example.com",
  developerApiKey: "api-key",
  quotaGuardEnabled: true,
  monthlyCommandLimit: 500_000,
  quotaThreshold: 0.8,
  ttlSeconds: 2_592_000,
};

beforeEach(clearShareQuotaCacheForTests);

describe("share quota guard", () => {
  it("allows creation below the configured threshold", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ total_monthly_requests: 399_999 }), { status: 200 })
    );
    await expect(
      getShareQuotaStatus(config, { fetcher, bypassCache: true })
    ).resolves.toEqual(
      expect.objectContaining({ allowCreates: true, usage: 399_999 })
    );
  });

  it("stops new links at the threshold and automatically allows a reset value", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_monthly_requests: 400_000 }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_monthly_requests: 10 }), { status: 200 })
      );

    await expect(
      getShareQuotaStatus(config, { fetcher, bypassCache: true })
    ).resolves.toEqual(expect.objectContaining({ allowCreates: false, reason: "quota" }));
    await expect(
      getShareQuotaStatus(config, { fetcher, bypassCache: true })
    ).resolves.toEqual(expect.objectContaining({ allowCreates: true, usage: 10 }));
  });

  it("fails closed when statistics cannot be checked", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(
      getShareQuotaStatus(config, { fetcher, bypassCache: true })
    ).resolves.toEqual(expect.objectContaining({ allowCreates: false, reason: "unavailable" }));
  });
});

