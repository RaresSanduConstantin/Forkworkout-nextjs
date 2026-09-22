import { createHash } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import {
  normalizeAIPhotoAnalysis,
  type AIPhotoAnalysis,
} from "@/lib/nutrition/ai-photo";

const DEFAULT_DEVICE_DAILY_LIMIT = 20;
const DEFAULT_IP_HOURLY_LIMIT = 20;
const DEFAULT_MAX_IMAGE_SIZE_MB = 4;
const DEFAULT_MODEL = "gpt-4.1-mini";

function positiveInteger(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}

export type AIPhotoServerConfig = {
  enabled: boolean;
  apiKey?: string;
  projectId?: string;
  model: string;
  deviceDailyLimit: number;
  ipHourlyLimit: number;
  maxImageBytes: number;
  redisUrl?: string;
  redisToken?: string;
  requireRedis: boolean;
};

export function getAIPhotoServerConfig(
  env: NodeJS.ProcessEnv = process.env
): AIPhotoServerConfig {
  const maxImageMb = positiveInteger(env.AI_MAX_IMAGE_SIZE_MB, DEFAULT_MAX_IMAGE_SIZE_MB, 20);
  return {
    enabled: env.AI_FOOD_SCANNER_ENABLED === "true",
    apiKey: env.OPENAI_API_KEY?.trim() || undefined,
    projectId: env.OPENAI_PROJECT_ID?.trim() || undefined,
    model: env.AI_FOOD_MODEL?.trim() || DEFAULT_MODEL,
    deviceDailyLimit: positiveInteger(
      env.AI_SCAN_DAILY_DEVICE_LIMIT,
      DEFAULT_DEVICE_DAILY_LIMIT,
      1_000
    ),
    ipHourlyLimit: positiveInteger(
      env.AI_SCAN_HOURLY_IP_LIMIT,
      DEFAULT_IP_HOURLY_LIMIT,
      1_000
    ),
    maxImageBytes: maxImageMb * 1024 * 1024,
    redisUrl: env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL,
    redisToken: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN,
    requireRedis:
      env.AI_SCAN_REQUIRE_REDIS === "true" ||
      (env.AI_SCAN_REQUIRE_REDIS !== "false" && env.NODE_ENV === "production"),
  };
}

export function isAIPhotoConfigured(config: AIPhotoServerConfig): boolean {
  return (
    config.enabled &&
    !!config.apiKey &&
    (!config.requireRedis || (!!config.redisUrl && !!config.redisToken))
  );
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 32);
}

export function requestIpIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return hash(forwarded || request.headers.get("x-real-ip") || "unknown");
}

type CachedLimiters = {
  signature: string;
  device: Ratelimit;
  ip: Ratelimit;
};

let cachedLimiters: CachedLimiters | undefined;
const memoryDeviceBuckets = new Map<string, { count: number; resetAt: number }>();
const memoryIpBuckets = new Map<string, { count: number; resetAt: number }>();

function durableLimiters(config: AIPhotoServerConfig): CachedLimiters | null {
  if (!config.redisUrl || !config.redisToken) return null;
  const signature = [
    config.redisUrl,
    config.redisToken,
    config.deviceDailyLimit,
    config.ipHourlyLimit,
  ].join(":");
  if (cachedLimiters?.signature === signature) return cachedLimiters;
  const redis = new Redis({ url: config.redisUrl, token: config.redisToken });
  cachedLimiters = {
    signature,
    device: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(config.deviceDailyLimit, "1 d"),
      prefix: "forkworkout:ai-photo:device",
      analytics: false,
    }),
    ip: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(config.ipHourlyLimit, "1 h"),
      prefix: "forkworkout:ai-photo:ip",
      analytics: false,
    }),
  };
  return cachedLimiters;
}

function checkMemoryBucket(
  buckets: Map<string, { count: number; resetAt: number }>,
  key: string,
  limit: number,
  windowMs: number,
  now: number
): { allowed: boolean; retryAfterSeconds?: number } {
  if (buckets.size > 2_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }
  current.count += 1;
  return { allowed: true };
}

export async function checkAIPhotoRateLimit({
  request,
  anonymousDeviceId,
  config,
}: {
  request: Request;
  anonymousDeviceId: string;
  config: AIPhotoServerConfig;
}): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const ipKey = requestIpIdentifier(request);
  const deviceKey = hash(anonymousDeviceId);
  const limiters = durableLimiters(config);
  if (limiters) {
    const [device, ip] = await Promise.all([
      limiters.device.limit(deviceKey),
      limiters.ip.limit(ipKey),
    ]);
    if (device.success && ip.success) return { allowed: true };
    const resets = [device.success ? 0 : device.reset, ip.success ? 0 : ip.reset];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((Math.max(...resets) - Date.now()) / 1_000)
      ),
    };
  }

  // Useful for local development and tests. Production defaults to requiring
  // Redis because process-local counters do not protect a serverless fleet.
  const now = Date.now();
  const device = checkMemoryBucket(
    memoryDeviceBuckets,
    deviceKey,
    config.deviceDailyLimit,
    24 * 60 * 60 * 1_000,
    now
  );
  const ip = checkMemoryBucket(
    memoryIpBuckets,
    ipKey,
    config.ipHourlyLimit,
    60 * 60 * 1_000,
    now
  );
  if (device.allowed && ip.allowed) return { allowed: true };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(device.retryAfterSeconds ?? 0, ip.retryAfterSeconds ?? 0, 1),
  };
}

const FOOD_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    foods: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          estimatedWeightGrams: { type: "number", minimum: 0 },
          caloriesKcal: { type: "number", minimum: 0 },
          proteinG: { type: "number", minimum: 0 },
          carbsG: { type: "number", minimum: 0 },
          fatG: { type: "number", minimum: 0 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: [
          "name",
          "estimatedWeightGrams",
          "caloriesKcal",
          "proteinG",
          "carbsG",
          "fatG",
          "confidence",
        ],
        additionalProperties: false,
      },
    },
    total: {
      type: "object",
      properties: {
        caloriesKcal: { type: "number", minimum: 0 },
        proteinG: { type: "number", minimum: 0 },
        carbsG: { type: "number", minimum: 0 },
        fatG: { type: "number", minimum: 0 },
      },
      required: ["caloriesKcal", "proteinG", "carbsG", "fatG"],
      additionalProperties: false,
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["foods", "total", "confidence"],
  additionalProperties: false,
} as const;

type OpenAIResponseBody = {
  error?: {
    code?: unknown;
    type?: unknown;
  };
  output?: Array<{
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
};

function responseText(body: OpenAIResponseBody): string | null {
  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return null;
}

type OpenAIPhotoErrorKind =
  | "budget"
  | "billing"
  | "provider_rate_limit"
  | "invalid"
  | "failed";

function providerErrorCode(body: OpenAIResponseBody | null): string | undefined {
  const code = body?.error?.code;
  return typeof code === "string" && /^[a-z0-9_-]{1,80}$/i.test(code)
    ? code.toLowerCase()
    : undefined;
}

function providerErrorType(body: OpenAIResponseBody | null): string | undefined {
  const type = body?.error?.type;
  return typeof type === "string" && /^[a-z0-9_-]{1,80}$/i.test(type)
    ? type.toLowerCase()
    : undefined;
}

function classifyOpenAIError(
  status: number,
  body: OpenAIResponseBody | null
): { kind: OpenAIPhotoErrorKind; code?: string } {
  const code = providerErrorCode(body);
  const type = providerErrorType(body);
  if (
    code === "project_spend_limit_exceeded" ||
    code === "organization_spend_limit_exceeded" ||
    code === "billing_hard_limit_reached"
  ) {
    return { kind: "budget", code };
  }
  if (
    code === "credit_balance_exhausted" ||
    code === "organization_usage_limit_exceeded" ||
    code === "insufficient_quota" ||
    type === "insufficient_quota"
  ) {
    return { kind: "billing", code: code ?? type };
  }
  if (status === 429) return { kind: "provider_rate_limit", code: code ?? type };
  return { kind: "failed", code: code ?? type };
}

export class OpenAIPhotoError extends Error {
  constructor(
    readonly kind: OpenAIPhotoErrorKind,
    message: string,
    readonly providerCode?: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "OpenAIPhotoError";
  }
}

export async function requestOpenAIPhotoAnalysis({
  image,
  mimeType,
  weightGrams,
  anonymousDeviceId,
  config,
}: {
  image: Buffer;
  mimeType: string;
  weightGrams?: number;
  anonymousDeviceId: string;
  config: AIPhotoServerConfig;
}): Promise<AIPhotoAnalysis> {
  if (!config.apiKey) throw new OpenAIPhotoError("failed", "OpenAI is not configured.");
  const knownWeight = weightGrams
    ? `The user weighed the complete pictured portion at ${weightGrams} grams. Allocate that total across identified foods.`
    : "The user did not provide a weight. Estimate visible edible portion weights conservatively.";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(config.projectId ? { "OpenAI-Project": config.projectId } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        store: false,
        max_output_tokens: 1_200,
        safety_identifier: hash(anonymousDeviceId),
        instructions:
          "You estimate nutrition from food photos for a workout tracking app. Identify only visible foods. Return approximate consumed values for each pictured portion, not per-100g values. Be conservative and never claim medical precision. If the image does not clearly contain food, return an empty foods array.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Analyze this food photo. ${knownWeight}`,
              },
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${image.toString("base64")}`,
                detail: "low",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "forkworkout_food_photo",
            strict: true,
            schema: FOOD_ANALYSIS_SCHEMA,
          },
        },
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as OpenAIResponseBody | null;
    if (!response.ok) {
      const classified = classifyOpenAIError(response.status, body);
      const retryAfter = Number(response.headers.get("Retry-After"));
      throw new OpenAIPhotoError(
        classified.kind,
        `OpenAI returned ${response.status}.`,
        classified.code,
        Number.isFinite(retryAfter) ? retryAfter : undefined
      );
    }
    const text = body ? responseText(body) : null;
    const raw = text ? JSON.parse(text) : null;
    if (
      raw &&
      typeof raw === "object" &&
      Array.isArray((raw as { foods?: unknown }).foods) &&
      (raw as { foods: unknown[] }).foods.length === 0
    ) {
      throw new OpenAIPhotoError("invalid", "No food was detected in the image.");
    }
    const parsed = normalizeAIPhotoAnalysis(raw);
    if (!parsed) throw new OpenAIPhotoError("failed", "OpenAI returned invalid nutrition data.");
    return parsed;
  } catch (error) {
    if (error instanceof OpenAIPhotoError) throw error;
    throw new OpenAIPhotoError(
      "failed",
      error instanceof Error ? error.message : "The AI analysis failed."
    );
  } finally {
    clearTimeout(timeout);
  }
}
