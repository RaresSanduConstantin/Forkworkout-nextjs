import { SHARE_TTL_SECONDS } from "@/lib/sharing/types";

const DEFAULT_MONTHLY_COMMAND_LIMIT = 500_000;
const DEFAULT_QUOTA_THRESHOLD = 0.8;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function ratio(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : fallback;
}

export type ShareServerConfig = {
  enabled: boolean;
  redisUrl?: string;
  redisToken?: string;
  databaseId?: string;
  developerEmail?: string;
  developerApiKey?: string;
  quotaGuardEnabled: boolean;
  monthlyCommandLimit: number;
  quotaThreshold: number;
  ttlSeconds: number;
};

export function getShareServerConfig(
  env: NodeJS.ProcessEnv = process.env
): ShareServerConfig {
  return {
    enabled: env.SHARE_SERVICE_ENABLED === "true",
    redisUrl: env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL,
    redisToken: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN,
    databaseId: env.UPSTASH_REDIS_DATABASE_ID,
    developerEmail: env.UPSTASH_DEVELOPER_EMAIL,
    developerApiKey: env.UPSTASH_DEVELOPER_API_KEY,
    quotaGuardEnabled: env.SHARE_QUOTA_GUARD_ENABLED !== "false",
    monthlyCommandLimit: positiveInteger(
      env.SHARE_MONTHLY_COMMAND_LIMIT,
      DEFAULT_MONTHLY_COMMAND_LIMIT
    ),
    quotaThreshold: ratio(env.SHARE_QUOTA_THRESHOLD, DEFAULT_QUOTA_THRESHOLD),
    ttlSeconds: positiveInteger(env.SHARE_TTL_SECONDS, SHARE_TTL_SECONDS),
  };
}

export function hasRedisConfiguration(config: ShareServerConfig): boolean {
  return !!config.redisUrl && !!config.redisToken;
}

export function hasQuotaConfiguration(config: ShareServerConfig): boolean {
  return (
    !config.quotaGuardEnabled ||
    (!!config.databaseId && !!config.developerEmail && !!config.developerApiKey)
  );
}

