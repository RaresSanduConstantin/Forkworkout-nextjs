import { Redis } from "@upstash/redis";

import type { ShareServerConfig } from "@/lib/sharing/config";

let cached:
  | { url: string; token: string; client: Redis }
  | undefined;

export function getRedisClient(config: ShareServerConfig): Redis {
  if (!config.redisUrl || !config.redisToken) {
    throw new Error("Short-share Redis is not configured.");
  }
  if (cached?.url === config.redisUrl && cached.token === config.redisToken) {
    return cached.client;
  }
  const client = new Redis({ url: config.redisUrl, token: config.redisToken });
  cached = { url: config.redisUrl, token: config.redisToken, client };
  return client;
}

