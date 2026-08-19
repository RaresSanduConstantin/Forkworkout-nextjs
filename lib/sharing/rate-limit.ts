import { createHash } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";

import type { ShareServerConfig } from "@/lib/sharing/config";
import { getRedisClient } from "@/lib/sharing/redis";

type ShareRateLimiters = {
  url: string;
  token: string;
  create: Ratelimit;
  read: Ratelimit;
};

let cached: ShareRateLimiters | undefined;

function rateLimiters(config: ShareServerConfig): ShareRateLimiters {
  if (
    cached &&
    cached.url === config.redisUrl &&
    cached.token === config.redisToken
  ) {
    return cached;
  }
  const redis = getRedisClient(config);
  const limiters = {
    url: config.redisUrl ?? "",
    token: config.redisToken ?? "",
    create: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "forkworkout:ratelimit:create",
      analytics: false,
    }),
    read: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, "1 m"),
      prefix: "forkworkout:ratelimit:read",
      analytics: false,
    }),
  };
  cached = limiters;
  return limiters;
}

function requestIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const value = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(value).digest("base64url").slice(0, 22);
}

export async function checkShareRateLimit(
  request: Request,
  config: ShareServerConfig,
  operation: "create" | "read"
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const limiters = rateLimiters(config);
  const limiter = operation === "create" ? limiters.create : limiters.read;
  const result = await limiter.limit(requestIdentifier(request));
  if (result.success) return { allowed: true };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
  };
}
